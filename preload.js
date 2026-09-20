'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = (name) => (arg) => ipcRenderer.invoke('jmn:' + name, arg);
contextBridge.exposeInMainWorld('jmn', Object.fromEntries([
  'getState', 'toggleFav', 'logEvent', 'openExternal', 'adminLogin', 'adminLogout', 'adminSetPassword',
  'upsertMissionario', 'setAtivo', 'deleteMissionario', 'upsertProjeto', 'deleteProjeto',
  'loadSeed', 'getInfo', 'openDataFolder', 'exportData', 'importData',
].map((n) => [n, call(n)])));
