const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', { loadProfile: () => ipcRenderer.invoke('profile:load') });
