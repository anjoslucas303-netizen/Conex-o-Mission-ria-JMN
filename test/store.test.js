'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../lib/store');
const seed = require('../lib/seed');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmn-'));
let s = new Store(dir);
const throws = (fn, re) => assert.throws(fn, re);

// admin protegido
throws(() => s.upsertMissionario({ nome: 'X', latitude: 0, longitude: 0 }), /administrador/);
throws(() => s.setPassword('123'), /6 caracteres/);
s.setPassword('senha123');
s.logout();
throws(() => s.login('errada'), /incorreta/);
s.login('senha123');
assert(s.isAdmin);
throws(() => s.setPassword('outra123', 'errada'), /atual incorreta/);

// validações
throws(() => s.upsertMissionario({ nome: '', latitude: 0, longitude: 0 }), /nome/);
throws(() => s.upsertMissionario({ nome: 'A', latitude: 999, longitude: 0 }), /inválidas/);
throws(() => s.upsertMissionario({ nome: 'A', latitude: '', longitude: '' }), /latitude e longitude/);
throws(() => s.upsertMissionario({ nome: 'A', latitude: 1, longitude: 1, linkAdocao: 'javascript:alert(1)' }), /https/);
throws(() => s.upsertMissionario({ nome: 'A', latitude: 1, longitude: 1, linkAdocao: 'http://x.com' }), /https/);
throws(() => s.upsertMissionario({ nome: 'A', latitude: 1, longitude: 1, foto: 'data:text/html;base64,AAAA' }), /Foto/);
throws(() => s.upsertProjeto({ nome: 'P', poligono: [[1, 1], [2, 2]] }), /3 pontos/);

// seed + CRUD
s.loadSeed(seed);
assert.equal(s.data.projetos.length, 2);
assert.equal(s.data.missionarios.length, 5);
const m = s.data.missionarios[0];

// usuário comum: favoritos e cliques
s.toggleFav(m.id); assert.deepEqual(s.data.favoritos, [m.id]);
s.toggleFav(m.id); assert.deepEqual(s.data.favoritos, []);
s.logEvent('adoption_click', m.id); s.logEvent('adoption_click', m.id);
assert.equal(s.data.missionarios[0].cliquesAdocao, 2);
throws(() => s.logEvent('hack', m.id), /inválido/);

// cliques não podem ser alterados pelo formulário
s.upsertMissionario({ ...m, cliquesAdocao: 9999, nomeExibicao: 'Novo Nome' });
assert.equal(s.data.missionarios[0].cliquesAdocao, 2);
assert.equal(s.data.missionarios[0].nomeExibicao, 'Novo Nome');

// projeto com missionários não pode ser excluído
throws(() => s.deleteProjeto(s.data.projetos[0].id), /Há missionários/);

// exportar / importar
s.toggleFav(m.id);
const backup = s.exportJson();
s.deleteMissionario(m.id);
assert.equal(s.data.missionarios.length, 4);
assert.equal(s.data.favoritos.length, 0);
s.importJson(backup);
assert.equal(s.data.missionarios.length, 5);
assert.equal(s.data.favoritos.length, 1);
throws(() => s.importJson('{lixo'), /inválido/);
throws(() => s.importJson('{"a":1}'), /backup/);
assert.equal(s.data.missionarios.length, 5); // falha não destrói dados

// persistência e recuperação de arquivo corrompido
s = new Store(dir);
assert.equal(s.data.missionarios.length, 5);
assert(!s.isAdmin);
fs.writeFileSync(path.join(dir, 'jmn-data.json'), '{corrompido');
s = new Store(dir);
assert(s.data.missionarios.length >= 4, 'deve recuperar do .bak');

// bloqueio após 5 tentativas erradas
for (let i = 0; i < 5; i++) try { s.login('x'); } catch {}
throws(() => s.login('senha123'), /Aguarde/);

console.log('OK — todos os testes passaram');
