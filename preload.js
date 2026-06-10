const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hseAPI', {
  getAllIncidents: () => ipcRenderer.invoke('incidents:getAll'),
  saveIncident: (i) => ipcRenderer.invoke('incidents:save', i),
  deleteIncident: (id) => ipcRenderer.invoke('incidents:delete', id),
  exportIncidents: () => ipcRenderer.invoke('incidents:export'),
  importIncidents: () => ipcRenderer.invoke('incidents:import'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
});
