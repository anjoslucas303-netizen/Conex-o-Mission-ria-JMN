'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { Store } = require('./lib/store');
const seed = require('./lib/seed');

// Esquema para mapas offline: jmn-tiles://tiles/{z}/{x}/{y}.png  (pasta "tiles" dentro da pasta de dados)
protocol.registerSchemesAsPrivileged([{ scheme: 'jmn-tiles', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

let win, store;

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    title: 'JMN — Adoção Missionária', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // nunca navega para fora do app; links externos abrem no navegador padrão
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function fromApp(e) { return e.senderFrame && e.senderFrame.url.startsWith('file://'); }

/** Registra um canal IPC que devolve {ok, error, state, ...extra}. */
function handle(name, fn) {
  ipcMain.handle('jmn:' + name, async (e, arg) => {
    if (!fromApp(e)) return { ok: false, error: 'Origem não permitida.' };
    try { const extra = (await fn(arg)) || {}; return { ok: true, ...extra, state: store.state() }; }
    catch (err) { return { ok: false, error: err.message, state: store.state() }; }
  });
}

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'));

  protocol.handle('jmn-tiles', (req) => {
    const m = new URL(req.url).pathname.match(/^\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.png$/);
    if (!m) return new Response('', { status: 404 });
    const f = path.join(store.dir, 'tiles', m[1], m[2], m[3] + '.png');
    return fs.existsSync(f) ? net.fetch(pathToFileURL(f).toString()) : new Response('', { status: 404 });
  });

  handle('getState', () => ({}));
  handle('toggleFav', (id) => store.toggleFav(id));
  handle('logEvent', ({ tipo, id }) => store.logEvent(tipo, id));
  handle('openExternal', (url) => {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new Error('Somente links https:// são permitidos.');
    shell.openExternal(url);
  });
  handle('adminLogin', (pw) => store.login(pw));
  handle('adminLogout', () => store.logout());
  handle('adminSetPassword', ({ nova, atual }) => store.setPassword(nova, atual));
  handle('upsertMissionario', (m) => store.upsertMissionario(m));
  handle('setAtivo', ({ id, ativo }) => store.setAtivo(id, ativo));
  handle('deleteMissionario', (id) => store.deleteMissionario(id));
  handle('upsertProjeto', (p) => store.upsertProjeto(p));
  handle('deleteProjeto', (id) => store.deleteProjeto(id));
  handle('loadSeed', () => store.loadSeed(seed));
  handle('getInfo', () => ({ info: { pasta: store.dir, versao: app.getVersion() } }));
  handle('openDataFolder', () => { shell.openPath(store.dir); });
  handle('exportData', async () => {
    const json = store.exportJson();
    const r = await dialog.showSaveDialog(win, { defaultPath: `jmn-backup-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'Backup JMN', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return { cancelado: true };
    fs.writeFileSync(r.filePath, json);
    return { arquivo: r.filePath };
  });
  handle('importData', async () => {
    store._need();
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Backup JMN', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths[0]) return { cancelado: true };
    const st = fs.statSync(r.filePaths[0]);
    if (st.size > 300 * 1024 * 1024) throw new Error('Arquivo grande demais.');
    store.importJson(fs.readFileSync(r.filePaths[0], 'utf8'));
    return {};
  });

  createWindow();
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
