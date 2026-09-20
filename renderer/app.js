'use strict';
const api = window.jmn;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#0B5D3B');
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmtDate = (t) => new Date(t).toLocaleString('pt-BR');

let S = { data: { projetos: [], missionarios: [], favoritos: [], eventos: [], auditoria: [] }, isAdmin: false, hasPassword: false };
let view = 'map', adminTab = 'mis';
let filters = { projetoId: '', estadoId: '', municipio: '', lider: '', texto: '' };
let map, cluster, polys, draft = null, pending = null, sheetId = null;

// ---------------------------------------------------------------- utilidades
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 3500);
}
async function call(name, arg) {
  const r = await api[name](arg);
  if (r.state) S = r.state;
  if (!r.ok) toast(r.error || 'Erro.');
  return r;
}
const proj = (id) => S.data.projetos.find((p) => p.id === id);
const mis = (id) => S.data.missionarios.find((m) => m.id === id);
const isFav = (id) => S.data.favoritos.includes(id);
const initials = (n) => esc((n || '?').trim().charAt(0).toUpperCase());
const avatar = (m, cls = '') => m.foto ? `<img class="avatar ${cls}" src="${m.foto}" alt="">` : `<div class="avatar ${cls}">${initials(m.nomeExibicao)}</div>`;

function openModal(html, cls = '') {
  const m = $('#modal'); m.innerHTML = `<div class="dlg ${cls}">${html}</div>`; m.classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; draft = null; }
function confirmBox(text) {
  return new Promise((res) => {
    openModal(`<p>${esc(text)}</p><div class="actions"><button class="b sec" data-act="cf-no">Cancelar</button><button class="b red" data-act="cf-yes">Confirmar</button></div>`, 'small');
    confirmBox.res = res;
  });
}
function readImage(file, max = 700) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------- filtros em cascata
const active = () => S.data.missionarios.filter((m) => m.ativo);
function filtered() {
  const f = filters, t = fold(f.texto);
  return active().filter((m) =>
    (!f.projetoId || m.projetoId === f.projetoId) && (!f.estadoId || m.estadoId === f.estadoId) &&
    (!f.municipio || m.municipioNome === f.municipio) && (!f.lider || m.liderNome === f.lider) &&
    (!t || fold(m.nomeExibicao).includes(t) || fold(m.nome).includes(t)));
}
function renderFilters() {
  const f = filters, uniq = (a) => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  const l1 = active().filter((m) => !f.projetoId || m.projetoId === f.projetoId);
  const estados = uniq(l1.map((m) => m.estadoId));
  const l2 = l1.filter((m) => !f.estadoId || m.estadoId === f.estadoId);
  const muns = uniq(l2.map((m) => m.municipioNome));
  const l3 = l2.filter((m) => !f.municipio || m.municipioNome === f.municipio);
  const lids = uniq(l3.map((m) => m.liderNome));
  const sel = (id, label, opts, val) => `<select data-filter="${id}"><option value="">${label}: todos</option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  $('#filters').innerHTML =
    sel('projetoId', 'Projeto', S.data.projetos.filter((p) => p.ativo).map((p) => [p.id, p.nome]), f.projetoId) +
    sel('estadoId', 'Estado', estados.map((e) => [e, e]), f.estadoId) +
    sel('municipio', 'Município', muns.map((e) => [e, e]), f.municipio) +
    sel('lider', 'Líder', lids.map((e) => [e, e]), f.lider) +
    `<button class="b sec" data-act="clear-filters">Limpar</button>`;
}

// ---------------------------------------------------------------- mapa
function initMap() {
  map = L.map('map', { center: [-14.2, -51.9], zoom: 4, worldCopyJump: true });
  const blank = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  // 1) tiles locais (pasta "tiles" na pasta de dados) — funciona 100% offline se você colocar tiles lá
  L.tileLayer('jmn-tiles://tiles/{z}/{x}/{y}.png', { maxZoom: 18, errorTileUrl: blank }).addTo(map);
  // 2) tiles online por cima, quando houver internet
  const online = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, errorTileUrl: blank, attribution: '© OpenStreetMap',
  }).addTo(map);
  online.on('tileerror', () => $('#net').classList.remove('hidden'));
  online.on('tileload', () => $('#net').classList.add('hidden'));
  cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 55 });
  polys = L.layerGroup().addTo(map);
  map.addLayer(cluster);
  if (!navigator.onLine) $('#net').classList.remove('hidden');
}
function updateMap() {
  if (!map) return;
  cluster.clearLayers(); polys.clearLayers();
  for (const p of S.data.projetos) {
    if (!p.ativo || p.poligono.length < 3 || (filters.projetoId && filters.projetoId !== p.id)) continue;
    const c = safeColor(p.cor);
    L.polygon(p.poligono, { color: c, weight: 2, fillColor: c, fillOpacity: 0.12 }).addTo(polys);
  }
  const pts = [];
  for (const m of filtered()) {
    const c = safeColor(proj(m.projetoId)?.cor);
    const html = `<div class="pin" style="border-color:${c}">${m.foto ? `<img src="${m.foto}" alt="">` : initials(m.nomeExibicao)}</div>`;
    const mk = L.marker([m.latitude, m.longitude], { icon: L.divIcon({ html, className: '', iconSize: [46, 46], iconAnchor: [23, 23] }) });
    mk.on('click', () => showSheet(m.id));
    cluster.addLayer(mk); pts.push([m.latitude, m.longitude]);
  }
  if (pts.length && (filters.projetoId || filters.estadoId || filters.municipio || filters.lider || filters.texto)) {
    map.fitBounds(pts, { padding: [60, 60], maxZoom: 12 });
  }
}
function showSheet(id) {
  const m = mis(id), s = $('#sheet');
  if (!m) { s.classList.add('hidden'); sheetId = null; return; }
  sheetId = id;
  s.classList.remove('hidden');
  s.innerHTML = `<div class="row">${avatar(m)}<div style="flex:1"><b>${esc(m.nomeExibicao)}</b><br>
    <span class="muted">${esc(m.municipioNome)}${m.estadoId ? ' - ' + esc(m.estadoId) : ''}<br>${esc(proj(m.projetoId)?.nome || '')}</span></div>
    <button class="icon" data-act="fav" data-id="${m.id}" title="Favoritar">${isFav(m.id) ? '❤️' : '🤍'}</button>
    <button class="icon" data-act="close-sheet" title="Fechar">✕</button></div>
    <div class="actions"><button class="b" data-act="profile" data-id="${m.id}">Ver perfil</button></div>`;
}

// ---------------------------------------------------------------- cartões / lista
function card(m) {
  return `<div class="card" data-act="profile" data-id="${m.id}"><div class="row">${avatar(m)}<div style="flex:1"><b>${esc(m.nomeExibicao)}</b><br>
    <span class="muted">${esc(m.municipioNome)}${m.estadoId ? ' - ' + esc(m.estadoId) : ''}<br>${esc(proj(m.projetoId)?.nome || '')}</span></div>
    <button class="icon" data-act="fav" data-id="${m.id}">${isFav(m.id) ? '❤️' : '🤍'}</button></div></div>`;
}
function renderList() {
  const l = filtered();
  $('#v-other').innerHTML = `<p class="muted">${l.length} missionário(s)</p><div class="grid">${l.map(card).join('') || '<p>Nenhum missionário encontrado.</p>'}</div>`;
}
function renderFavs() {
  const l = S.data.favoritos.map(mis).filter((m) => m && m.ativo);
  $('#v-other').innerHTML = `<h2>Meus favoritos</h2><div class="grid">${l.map(card).join('') || '<p>Você ainda não favoritou ninguém.</p>'}</div>`;
}

// ---------------------------------------------------------------- perfil
function openProfile(id, tab = 0, log = true) {
  const m = mis(id); if (!m) return;
  if (log) call('logEvent', { tipo: 'profile_view', id });
  const p = proj(m.projetoId);
  const social = Object.entries(m.redesSociais || {}).map(([k, v]) => `<p>${esc(k)}: <a href="#" data-act="ext" data-url="${esc(v)}">${esc(v)}</a></p>`).join('');
  const tabs = ['Informações', 'Testemunho', 'Fotos', 'Adote Aqui'];
  openModal(`
    <div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(m.nomeExibicao)}</h2>
      <div><button class="icon" data-act="fav" data-id="${m.id}">${isFav(m.id) ? '❤️' : '🤍'}</button><button class="icon" data-act="close">✕</button></div></div>
    <div class="tabs">${tabs.map((t, i) => `<button data-act="ptab" data-i="${i}" class="${i === tab ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div data-pane="0" class="${tab === 0 ? '' : 'hidden'}"><div style="text-align:center">${avatar(m, 'big')}</div>
      <p>📍 ${esc(m.municipioNome)}${m.estadoId ? ' - ' + esc(m.estadoId) : ''}</p>${p ? `<p>🚩 ${esc(p.nome)}</p>` : ''}${m.liderNome ? `<p>👤 Líder: ${esc(m.liderNome)}</p>` : ''}${social}</div>
    <div data-pane="1" class="${tab === 1 ? '' : 'hidden'}"><div class="testemunho">${esc(m.testemunho) || '<span class="muted">Testemunho ainda não cadastrado.</span>'}</div></div>
    <div data-pane="2" class="${tab === 2 ? '' : 'hidden'}">${m.galeria.length ? `<div class="gal">${m.galeria.map((g, i) => `<img src="${g}" data-act="zoom" data-i="${i}" alt="">`).join('')}</div>` : '<p class="muted">Sem fotos na galeria.</p>'}</div>
    <div data-pane="3" class="${tab === 3 ? '' : 'hidden'}" style="text-align:center;padding:10px">
      <div style="font-size:54px">🤝</div><h3>Adote ${esc(m.nomeExibicao)}</h3>
      <p>Sustente esta obra missionária. Você será direcionado ao canal oficial da JMN no seu navegador (é necessário ter internet nesta etapa).</p>
      <div class="actions" style="justify-content:center">
        <button class="b" data-act="adopt" data-id="${m.id}">Clique aqui e adote</button>
        <button class="b sec" data-act="wa" data-id="${m.id}">Falar pelo WhatsApp</button></div></div>`);
  $('#modal').dataset.mid = id;
}
function zoomImage(id, i) {
  const m = mis(id); if (!m) return;
  openModal(`<button class="icon" data-act="back-profile" style="color:#fff;position:absolute;right:20px;top:14px">✕</button><img src="${m.galeria[i]}" alt="">`, 'lightbox');
  $('#modal').dataset.mid = id;
}

// ---------------------------------------------------------------- adoção / WhatsApp
// Sequência (eventos independentes, nenhum confirma doação): cliqueAdocao → aberturaSite → retornoAplicativo → aberturaWhatsApp
async function adopt(id) {
  const m = mis(id); if (!m) return;
  if (!m.linkAdocao) return toast('Link de adoção indisponível para este missionário.');
  await call('logEvent', { tipo: 'adoption_click', id });
  await call('logEvent', { tipo: 'adoption_site_open', id });
  pending = { id, ts: Date.now() };
  const r = await call('openExternal', m.linkAdocao);
  if (!r.ok) pending = null;
}
async function whatsapp(id) {
  const m = mis(id); if (!m) return;
  if (!m.telefoneWhatsapp) return toast('WhatsApp indisponível para este missionário.');
  const msg = `Olá, ${m.nomeExibicao}! Conheci seu trabalho pelo aplicativo da JMN e gostaria de conversar com você.`;
  await call('logEvent', { tipo: 'whatsapp_click', id });
  await call('openExternal', `https://wa.me/${m.telefoneWhatsapp}?text=${encodeURIComponent(msg)}`);
}
// Voltar para a janela do app depois de abrir o site: apenas oferece o WhatsApp (NÃO confirma doação).
window.addEventListener('focus', async () => {
  if (!pending || Date.now() - pending.ts < 3000) return;
  const { id } = pending; pending = null;
  await call('logEvent', { tipo: 'app_resume_after_adoption', id });
  const m = mis(id); if (!m) return;
  openModal(`<h3>Bem-vindo de volta!</h3><p>Quer falar com ${esc(m.nomeExibicao)} pelo WhatsApp?</p>
    <div class="actions"><button class="b sec" data-act="close">Agora não</button><button class="b" data-act="wa" data-id="${id}">Abrir WhatsApp</button></div>`, 'small');
});

// ---------------------------------------------------------------- painel do administrador
function renderAdmin() {
  const box = $('#v-other');
  if (!S.isAdmin) {
    box.innerHTML = `<div class="dlg small" style="margin:40px auto">
      <h2>Área do administrador</h2>
      ${S.hasPassword ? `<label>Senha</label><input id="pw" type="password" autofocus>
        <div class="actions"><button class="b" data-act="login">Entrar</button></div>`
      : `<p>Primeiro acesso: crie uma senha de administrador (mínimo 6 caracteres). <b>Guarde-a: não há recuperação.</b></p>
        <label>Nova senha</label><input id="pw" type="password"><label>Repita a senha</label><input id="pw2" type="password">
        <div class="actions"><button class="b" data-act="create-pw">Criar senha e entrar</button></div>`}</div>`;
    return;
  }
  const tabs = [['mis', 'Missionários'], ['proj', 'Projetos'], ['dados', 'Dados e backup']];
  const total = S.data.missionarios.reduce((a, m) => a + (m.cliquesAdocao || 0), 0);
  let body = '';
  if (adminTab === 'mis') {
    body = `<div class="actions" style="margin:0 0 12px"><button class="b" data-act="new-mis">+ Novo missionário</button></div>
      <table><tr><th></th><th>Nome</th><th>Local</th><th>Cliques</th><th>Ativo</th><th></th></tr>
      ${S.data.missionarios.map((m) => `<tr><td>${avatar(m).replace('avatar', 'avatar" style="width:36px;height:36px;font-size:16px')}</td><td>${esc(m.nomeExibicao)}</td>
        <td>${esc(m.municipioNome)}/${esc(m.estadoId)}</td><td>${m.cliquesAdocao || 0}</td>
        <td><input type="checkbox" style="width:auto" data-act="toggle-ativo" data-id="${m.id}" ${m.ativo ? 'checked' : ''}></td>
        <td><button class="b sec" data-act="edit-mis" data-id="${m.id}">Editar</button> <button class="b red" data-act="del-mis" data-id="${m.id}">Excluir</button></td></tr>`).join('')}</table>`;
  } else if (adminTab === 'proj') {
    body = `<div class="actions" style="margin:0 0 12px"><button class="b" data-act="new-proj">+ Novo projeto</button></div>
      <table><tr><th>Cor</th><th>Nome</th><th>Missionários</th><th>Ativo</th><th></th></tr>
      ${S.data.projetos.map((p) => `<tr><td><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${safeColor(p.cor)}"></span></td>
        <td>${esc(p.nome)}</td><td>${S.data.missionarios.filter((m) => m.projetoId === p.id).length}</td><td>${p.ativo ? 'Sim' : 'Não'}</td>
        <td><button class="b sec" data-act="edit-proj" data-id="${p.id}">Editar</button> <button class="b red" data-act="del-proj" data-id="${p.id}">Excluir</button></td></tr>`).join('')}</table>`;
  } else {
    body = `<div><div class="stat"><b>${S.data.missionarios.length}</b>missionários</div><div class="stat"><b>${S.data.projetos.length}</b>projetos</div>
      <div class="stat"><b>${total}</b>cliques em "Adote"</div></div>
      <div class="actions"><button class="b" data-act="export">Exportar backup (.json)</button><button class="b sec" data-act="import">Importar backup</button>
        <button class="b sec" data-act="seed">Carregar dados de exemplo</button><button class="b sec" data-act="open-folder">Abrir pasta de dados</button>
        <button class="b sec" data-act="chg-pw">Trocar senha</button><button class="b sec" data-act="logout">Sair do modo administrador</button></div>
      <p class="muted">Importar um backup <b>substitui</b> todos os dados atuais. Faça backups regulares — os dados ficam somente neste computador.</p>
      <h3>Histórico de alterações</h3><table><tr><th>Quando</th><th>Ação</th><th>Onde</th></tr>
      ${[...S.data.auditoria].reverse().slice(0, 40).map((a) => `<tr><td>${fmtDate(a.ts)}</td><td>${esc(a.acao)}</td><td>${esc(a.colecao)}</td></tr>`).join('')}</table>`;
  }
  box.innerHTML = `<div class="tabs">${tabs.map(([k, t]) => `<button data-act="atab" data-k="${k}" class="${k === adminTab ? 'on' : ''}">${t}</button>`).join('')}</div>${body}`;
}

function misForm(m) {
  draft = m ? JSON.parse(JSON.stringify(m)) : { foto: '', galeria: [], redesSociais: {}, ativo: true };
  const v = (k) => esc(draft[k] ?? '');
  openModal(`<h2>${m ? 'Editar' : 'Novo'} missionário</h2>
    <label>Nome completo *</label><input id="f-nome" value="${v('nome')}">
    <label>Nome de exibição</label><input id="f-nomeExibicao" value="${v('nomeExibicao')}">
    <label>Testemunho</label><textarea id="f-testemunho">${v('testemunho')}</textarea>
    <div class="two"><div><label>WhatsApp (com DDI, ex.: 5561999999999)</label><input id="f-telefoneWhatsapp" value="${v('telefoneWhatsapp')}"></div>
      <div><label>Link de adoção (https://…)</label><input id="f-linkAdocao" value="${v('linkAdocao')}"></div></div>
    <div class="two"><div><label>Projeto</label><select id="f-projetoId"><option value="">—</option>${S.data.projetos.map((p) => `<option value="${p.id}" ${p.id === draft.projetoId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
      <div><label>Líder (nome)</label><input id="f-liderNome" value="${v('liderNome')}"></div></div>
    <div class="two"><div><label>UF (ex.: DF)</label><input id="f-estadoId" maxlength="2" value="${v('estadoId')}"></div>
      <div><label>Município</label><input id="f-municipioNome" value="${v('municipioNome')}"></div></div>
    <div class="two"><div><label>Latitude (ex.: -15.79)</label><input id="f-latitude" value="${v('latitude')}"></div>
      <div><label>Longitude (ex.: -47.88)</label><input id="f-longitude" value="${v('longitude')}"></div></div>
    <label>Redes sociais (uma por linha: nome=https://…)</label>
    <textarea id="f-redes" style="min-height:60px">${Object.entries(draft.redesSociais || {}).map(([k, x]) => `${esc(k)}=${esc(x)}`).join('\n')}</textarea>
    <label>Foto de perfil</label><div class="row"><div id="f-fotoprev">${draft.foto ? `<img class="avatar" src="${draft.foto}">` : ''}</div><input id="f-foto" type="file" accept="image/*"></div>
    <label>Galeria</label><div id="f-gal" class="gal"></div><input id="f-galadd" type="file" accept="image/*" multiple>
    <label><input type="checkbox" id="f-ativo" style="width:auto" ${draft.ativo !== false ? 'checked' : ''}> Ativo (aparece no mapa)</label>
    <div class="actions"><button class="b sec" data-act="close">Cancelar</button><button class="b" data-act="save-mis">Salvar</button></div>`);
  renderGalDraft();
}
function renderGalDraft() {
  $('#f-gal').innerHTML = draft.galeria.map((g, i) => `<div style="position:relative"><img src="${g}" alt=""><button class="icon" style="position:absolute;top:0;right:0" data-act="gal-del" data-i="${i}">🗑</button></div>`).join('');
}
function projForm(p) {
  draft = p ? JSON.parse(JSON.stringify(p)) : { ativo: true, cor: '#0B5D3B', poligono: [] };
  openModal(`<h2>${p ? 'Editar' : 'Novo'} projeto</h2>
    <label>Nome *</label><input id="p-nome" value="${esc(draft.nome || '')}">
    <label>Descrição</label><textarea id="p-desc" style="min-height:60px">${esc(draft.descricao || '')}</textarea>
    <label>Cor</label><input id="p-cor" type="color" value="${safeColor(draft.cor)}" style="height:38px">
    <label>Território (polígono): uma coordenada por linha, no formato latitude,longitude — mínimo 3 pontos</label>
    <textarea id="p-poly" placeholder="-13.0,-50.0&#10;-13.0,-46.0&#10;-17.0,-46.0">${esc((draft.poligono || []).map((x) => x.join(',')).join('\n'))}</textarea>
    <label><input type="checkbox" id="p-ativo" style="width:auto" ${draft.ativo !== false ? 'checked' : ''}> Ativo</label>
    <div class="actions"><button class="b sec" data-act="close">Cancelar</button><button class="b" data-act="save-proj">Salvar</button></div>`);
}

// ---------------------------------------------------------------- render principal
function render() {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
  $('#v-map').classList.toggle('hidden', view !== 'map');
  $('#v-other').classList.toggle('hidden', view === 'map');
  $('#filters').classList.toggle('hidden', view === 'admin' || view === 'favs');
  renderFilters();
  if (view === 'map') { updateMap(); map.invalidateSize(); if (sheetId) showSheet(sheetId); }
  else if (view === 'list') renderList();
  else if (view === 'favs') renderFavs();
  else renderAdmin();
}

// ---------------------------------------------------------------- eventos (delegação; a CSP bloqueia handlers inline)
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.filter) {
    const k = t.dataset.filter; filters[k] = t.value;
    if (k === 'projetoId') Object.assign(filters, { estadoId: '', municipio: '', lider: '' });
    if (k === 'estadoId') Object.assign(filters, { municipio: '', lider: '' });
    if (k === 'municipio') filters.lider = '';
    render();
  } else if (t.dataset.act === 'toggle-ativo') { await call('setAtivo', { id: t.dataset.id, ativo: t.checked }); render(); }
  else if (t.id === 'f-foto' && t.files[0]) {
    try { draft.foto = await readImage(t.files[0], 500); $('#f-fotoprev').innerHTML = `<img class="avatar" src="${draft.foto}">`; } catch (er) { toast(er.message); }
  } else if (t.id === 'f-galadd') {
    for (const f of t.files) { try { draft.galeria.push(await readImage(f, 1000)); } catch (er) { toast(er.message); } }
    renderGalDraft(); t.value = '';
  }
});
$('#search').addEventListener('input', (e) => { filters.texto = e.target.value; render(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal();
  if (e.key === 'Enter' && $('#pw') && !$('#pw2') && document.activeElement === $('#pw') && !S.isAdmin) $('[data-act="login"]')?.click();
});

document.addEventListener('click', async (e) => {
  if (e.target.id === 'modal') return closeModal();
  const el = e.target.closest('[data-act]'); if (!el || el.tagName === 'INPUT' && el.type === 'checkbox') return;
  const a = el.dataset.act, id = el.dataset.id;
  e.stopPropagation();
  const val = (i) => ($(i) ? $(i).value : '');
  switch (a) {
    case 'view': view = el.dataset.v; render(); break;
    case 'clear-filters': filters = { projetoId: '', estadoId: '', municipio: '', lider: '', texto: '' }; $('#search').value = ''; render(); break;
    case 'close-sheet': sheetId = null; $('#sheet').classList.add('hidden'); break;
    case 'close': closeModal(); break;
    case 'profile': openProfile(id); break;
    case 'ptab': {
      const i = el.dataset.i;
      document.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== i));
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.i === i)); break;
    }
    case 'zoom': zoomImage($('#modal').dataset.mid, Number(el.dataset.i)); break;
    case 'back-profile': openProfile($('#modal').dataset.mid, 2, false); break;
    case 'fav': await call('toggleFav', id); {
      const open = !$('#modal').classList.contains('hidden') && $('#modal').dataset.mid === id;
      if (open) { const cur = document.querySelector('.tabs button.on')?.dataset.i; openProfile(id, Number(cur || 0), false); } render();
    } break;
    case 'adopt': adopt(id); break;
    case 'wa': closeModal(); whatsapp(id); break;
    case 'ext': e.preventDefault(); call('openExternal', el.dataset.url); break;
    case 'cf-yes': closeModal(); confirmBox.res(true); break;
    case 'cf-no': closeModal(); confirmBox.res(false); break;
    // admin
    case 'login': { const r = await call('adminLogin', val('#pw')); if (r.ok) render(); } break;
    case 'create-pw':
      if (val('#pw') !== val('#pw2')) { toast('As senhas não coincidem.'); break; }
      if ((await call('adminSetPassword', { nova: val('#pw') })).ok) render(); break;
    case 'logout': await call('adminLogout'); render(); break;
    case 'atab': adminTab = el.dataset.k; render(); break;
    case 'new-mis': misForm(null); break;
    case 'edit-mis': misForm(mis(id)); break;
    case 'del-mis': if (await confirmBox('Excluir este missionário? Esta ação não pode ser desfeita.')) { await call('deleteMissionario', id); render(); } break;
    case 'gal-del': draft.galeria.splice(Number(el.dataset.i), 1); renderGalDraft(); break;
    case 'save-mis': {
      const redes = {};
      val('#f-redes').split('\n').forEach((l) => { const i = l.indexOf('='); if (i > 0) redes[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
      const payload = { ...draft, redesSociais: redes, ativo: $('#f-ativo').checked };
      for (const k of ['nome', 'nomeExibicao', 'testemunho', 'telefoneWhatsapp', 'linkAdocao', 'projetoId', 'liderNome', 'estadoId', 'municipioNome'])
        payload[k] = val('#f-' + k);
      payload.latitude = val('#f-latitude').replace(',', '.'); payload.longitude = val('#f-longitude').replace(',', '.');
      const r = await call('upsertMissionario', payload); if (r.ok) { closeModal(); toast('Salvo.'); render(); }
    } break;
    case 'new-proj': projForm(null); break;
    case 'edit-proj': projForm(proj(id)); break;
    case 'del-proj': if (await confirmBox('Excluir este projeto?')) { await call('deleteProjeto', id); render(); } break;
    case 'save-proj': {
      const poligono = val('#p-poly').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[;,\s]+/).map((n) => Number(n.replace(',', '.'))));
      if (poligono.some((p) => p.length !== 2 || p.some(Number.isNaN))) { toast('Polígono inválido. Use: latitude,longitude por linha.'); break; }
      const r = await call('upsertProjeto', { ...draft, nome: val('#p-nome'), descricao: val('#p-desc'), cor: val('#p-cor'), ativo: $('#p-ativo').checked, poligono });
      if (r.ok) { closeModal(); render(); }
    } break;
    case 'export': { const r = await call('exportData'); if (r.ok && !r.cancelado) toast('Backup salvo.'); } break;
    case 'import':
      if (await confirmBox('Importar substitui TODOS os dados atuais pelos do arquivo. Continuar?')) {
        const r = await call('importData'); if (r.ok && !r.cancelado) { toast('Backup importado.'); render(); }
      } break;
    case 'seed': if ((await call('loadSeed')).ok) { toast('Dados de exemplo carregados.'); render(); } break;
    case 'open-folder': call('openDataFolder'); break;
    case 'chg-pw':
      openModal(`<h3>Trocar senha</h3><label>Senha atual</label><input id="pw-old" type="password"><label>Nova senha</label><input id="pw-new" type="password">
        <div class="actions"><button class="b sec" data-act="close">Cancelar</button><button class="b" data-act="do-chg-pw">Trocar</button></div>`, 'small'); break;
    case 'do-chg-pw': { const r = await call('adminSetPassword', { atual: val('#pw-old'), nova: val('#pw-new') }); if (r.ok) { closeModal(); toast('Senha alterada.'); } } break;
  }
});

// ---------------------------------------------------------------- início
(async function start() {
  initMap();
  window.addEventListener('offline', () => $('#net').classList.remove('hidden'));
  await call('getState');
  if (!S.data.missionarios.length) view = 'map';
  render();
})();
