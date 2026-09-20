'use strict';
/**
 * Armazenamento local (JSON) + regras de negócio + senha do modo administrador.
 * Não depende do Electron: pode ser testado com `node test/store.test.js`.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EVENT_TYPES = ['profile_view', 'adoption_click', 'adoption_site_open', 'app_resume_after_adoption',
  'whatsapp_click', 'favorite_add', 'favorite_remove'];
const ADMIN_IDLE_MS = 30 * 60 * 1000;
const MAX_IMG_CHARS = 900_000;      // ~650 KB por imagem (a interface já reduz para ~60 KB)
const uid = () => crypto.randomUUID();
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const isHttps = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const isImg = (s) => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s) && s.length <= MAX_IMG_CHARS;

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'jmn-data.json');
    this.cfgFile = path.join(dir, 'jmn-config.json');
    this.data = this._load();
    this.cfg = this._readJson(this.cfgFile) || {};
    this.unlockedUntil = 0;
    this.failed = 0;
    this.lockedUntil = 0;
  }

  // ------------------------------------------------------------ persistência
  _empty() { return { versao: 1, projetos: [], missionarios: [], favoritos: [], eventos: [], auditoria: [] }; }
  _readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
  _normalize(d) {
    const e = this._empty();
    if (!d || typeof d !== 'object') return e;
    for (const k of ['projetos', 'missionarios', 'favoritos', 'eventos', 'auditoria']) e[k] = Array.isArray(d[k]) ? d[k] : [];
    return e;
  }
  _load() {
    if (!fs.existsSync(this.file)) return this._empty();
    const main = this._readJson(this.file);
    if (main) return this._normalize(main);
    // arquivo corrompido: guarda cópia e tenta o backup
    try { fs.copyFileSync(this.file, this.file + '.corrompido-' + Date.now()); } catch {}
    return this._normalize(this._readJson(this.file + '.bak'));
  }
  _save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + '.bak');
    fs.renameSync(tmp, this.file);
  }
  _audit(acao, colecao, id, campos) {
    this.data.auditoria.push({ ts: Date.now(), acao, colecao, id, campos });
    if (this.data.auditoria.length > 1000) this.data.auditoria.splice(0, this.data.auditoria.length - 1000);
  }

  // ------------------------------------------------------------ estado / admin
  get isAdmin() { return Date.now() < this.unlockedUntil; }
  state() { return { data: this.data, isAdmin: this.isAdmin, hasPassword: !!this.cfg.hash }; }
  _need() {
    if (!this.isAdmin) throw new Error('Acesso restrito ao administrador.');
    this.unlockedUntil = Date.now() + ADMIN_IDLE_MS;
  }
  _hash(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString('hex'); }

  setPassword(pw, atual) {
    pw = String(pw ?? '');
    if (pw.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
    if (this.cfg.hash) { if (!this._check(atual)) throw new Error('Senha atual incorreta.'); }
    const salt = crypto.randomBytes(16).toString('hex');
    this.cfg = { salt, hash: this._hash(pw, salt) };
    fs.writeFileSync(this.cfgFile, JSON.stringify(this.cfg));
    this.unlockedUntil = Date.now() + ADMIN_IDLE_MS;
  }
  _check(pw) {
    if (!this.cfg.hash) return false;
    const a = Buffer.from(this._hash(String(pw ?? ''), this.cfg.salt), 'hex');
    return crypto.timingSafeEqual(a, Buffer.from(this.cfg.hash, 'hex'));
  }
  login(pw) {
    if (Date.now() < this.lockedUntil) throw new Error('Muitas tentativas. Aguarde 30 segundos.');
    if (!this._check(pw)) {
      if (++this.failed >= 5) { this.failed = 0; this.lockedUntil = Date.now() + 30_000; }
      throw new Error('Senha incorreta.');
    }
    this.failed = 0;
    this.unlockedUntil = Date.now() + ADMIN_IDLE_MS;
  }
  logout() { this.unlockedUntil = 0; }

  // ------------------------------------------------------------ validação
  _cleanMissionario(i, old) {
    const o = {
      id: old?.id || uid(),
      nome: str(i.nome, 120), nomeExibicao: str(i.nomeExibicao || i.nome, 120),
      testemunho: str(i.testemunho, 20000),
      telefoneWhatsapp: String(i.telefoneWhatsapp ?? '').replace(/\D/g, '').slice(0, 15),
      linkAdocao: str(i.linkAdocao, 1000),
      projetoId: str(i.projetoId, 60), estadoId: str(i.estadoId, 4).toUpperCase(),
      municipioNome: str(i.municipioNome, 120), liderNome: str(i.liderNome, 120),
      latitude: Number(i.latitude), longitude: Number(i.longitude),
      ativo: i.ativo !== false,
      cliquesAdocao: old?.cliquesAdocao || 0,            // só o sistema altera
      foto: i.foto ? i.foto : '', galeria: Array.isArray(i.galeria) ? i.galeria.slice(0, 30) : [],
      redesSociais: {},
      createdAt: old?.createdAt || Date.now(), updatedAt: Date.now(),
    };
    if (!o.nome) throw new Error('Informe o nome.');
    if ([i.latitude, i.longitude].some((v) => v === '' || v === null || v === undefined)) throw new Error('Informe latitude e longitude.');
    if (!o.nomeExibicao) o.nomeExibicao = o.nome;
    if (!(o.latitude >= -90 && o.latitude <= 90) || !(o.longitude >= -180 && o.longitude <= 180) ||
        !Number.isFinite(o.latitude) || !Number.isFinite(o.longitude)) throw new Error('Latitude/longitude inválidas.');
    if (o.linkAdocao && !isHttps(o.linkAdocao)) throw new Error('O link de adoção deve começar com https://');
    if (o.projetoId && !this.data.projetos.some((p) => p.id === o.projetoId)) throw new Error('Projeto inexistente.');
    if (o.foto && !isImg(o.foto)) throw new Error('Foto de perfil inválida ou grande demais.');
    if (o.galeria.some((g) => !isImg(g))) throw new Error('Imagem da galeria inválida ou grande demais.');
    for (const [k, v] of Object.entries(i.redesSociais || {})) if (isHttps(v)) o.redesSociais[str(k, 30)] = str(v, 300);
    return o;
  }
  _cleanProjeto(i, old) {
    const o = {
      id: old?.id || uid(), nome: str(i.nome, 120), descricao: str(i.descricao, 2000),
      cor: /^#[0-9a-fA-F]{6}$/.test(i.cor) ? i.cor : '#0B5D3B', ativo: i.ativo !== false,
      poligono: [],
    };
    if (!o.nome) throw new Error('Informe o nome do projeto.');
    for (const p of Array.isArray(i.poligono) ? i.poligono.slice(0, 2000) : []) {
      const la = Number(p[0]), lo = Number(p[1]);
      if (!(la >= -90 && la <= 90 && lo >= -180 && lo <= 180)) throw new Error('Coordenada de polígono inválida.');
      o.poligono.push([la, lo]);
    }
    if (o.poligono.length && o.poligono.length < 3) throw new Error('O polígono precisa de pelo menos 3 pontos.');
    return o;
  }

  // ------------------------------------------------------------ ações do usuário comum
  toggleFav(id) {
    if (!this.data.missionarios.some((m) => m.id === id)) throw new Error('Missionário inexistente.');
    const i = this.data.favoritos.indexOf(id);
    if (i >= 0) this.data.favoritos.splice(i, 1); else this.data.favoritos.push(id);
    this._pushEvent(i >= 0 ? 'favorite_remove' : 'favorite_add', id);
    this._save();
  }
  logEvent(tipo, id) {
    if (!EVENT_TYPES.includes(tipo)) throw new Error('Evento inválido.');
    const m = this.data.missionarios.find((x) => x.id === id);
    if (!m) return;
    if (tipo === 'adoption_click') m.cliquesAdocao = (m.cliquesAdocao || 0) + 1;
    this._pushEvent(tipo, id);
    this._save();
  }
  _pushEvent(tipo, missionarioId) {
    this.data.eventos.push({ ts: Date.now(), tipo, missionarioId });
    if (this.data.eventos.length > 5000) this.data.eventos.splice(0, this.data.eventos.length - 5000);
  }

  // ------------------------------------------------------------ ações do administrador
  upsertMissionario(input) {
    this._need();
    const old = input.id ? this.data.missionarios.find((m) => m.id === input.id) : null;
    if (input.id && !old) throw new Error('Missionário não encontrado.');
    const o = this._cleanMissionario(input, old);
    if (old) Object.assign(old, o); else this.data.missionarios.push(o);
    this._audit(old ? 'update' : 'create', 'missionarios', o.id, ['nomeExibicao']);
    this._save();
    return { id: o.id };
  }
  setAtivo(id, ativo) {
    this._need();
    const m = this.data.missionarios.find((x) => x.id === id);
    if (!m) throw new Error('Missionário não encontrado.');
    m.ativo = !!ativo; m.updatedAt = Date.now();
    this._audit('update', 'missionarios', id, ['ativo']);
    this._save();
  }
  deleteMissionario(id) {
    this._need();
    this.data.missionarios = this.data.missionarios.filter((m) => m.id !== id);
    this.data.favoritos = this.data.favoritos.filter((f) => f !== id);
    this._audit('delete', 'missionarios', id, []);
    this._save();
  }
  upsertProjeto(input) {
    this._need();
    const old = input.id ? this.data.projetos.find((p) => p.id === input.id) : null;
    if (input.id && !old) throw new Error('Projeto não encontrado.');
    const o = this._cleanProjeto(input, old);
    if (old) Object.assign(old, o); else this.data.projetos.push(o);
    this._audit(old ? 'update' : 'create', 'projetos', o.id, ['nome']);
    this._save();
  }
  deleteProjeto(id) {
    this._need();
    if (this.data.missionarios.some((m) => m.projetoId === id)) throw new Error('Há missionários neste projeto. Mova-os ou desative o projeto.');
    this.data.projetos = this.data.projetos.filter((p) => p.id !== id);
    this._audit('delete', 'projetos', id, []);
    this._save();
  }
  exportJson() { this._need(); return JSON.stringify(this.data); }
  importJson(text) {
    this._need();
    let d;
    try { d = JSON.parse(text); } catch { throw new Error('Arquivo inválido (não é JSON).'); }
    const n = this._normalize(d);
    if (!Array.isArray(d.missionarios) && !Array.isArray(d.projetos)) throw new Error('Arquivo não parece um backup da JMN.');
    const backup = this.data;
    try {
      this.data = this._empty();
      for (const p of n.projetos) { const c = this._cleanProjeto(p, null); c.id = str(p.id, 60) || c.id; this.data.projetos.push(c); }
      for (const m of n.missionarios) {
        const c = this._cleanMissionario(m, null);
        c.id = str(m.id, 60) || c.id; c.cliquesAdocao = Number(m.cliquesAdocao) || 0;
        this.data.missionarios.push(c);
      }
      const ids = new Set(this.data.missionarios.map((m) => m.id));
      this.data.favoritos = n.favoritos.filter((f) => ids.has(f));
      this.data.eventos = n.eventos.slice(-5000); this.data.auditoria = n.auditoria.slice(-1000);
    } catch (e) { this.data = backup; throw e; }
    this._audit('import', 'sistema', '-', []);
    this._save();
  }
  loadSeed(seed) {
    this._need();
    const map = {};
    for (const p of seed.projetos) { const c = this._cleanProjeto(p, null); this.data.projetos.push(c); map[p.key] = c.id; }
    for (const m of seed.missionarios) { const c = this._cleanMissionario({ ...m, projetoId: map[m.projeto] }, null); this.data.missionarios.push(c); }
    this._audit('seed', 'sistema', '-', []);
    this._save();
  }
}

module.exports = { Store, EVENT_TYPES };
