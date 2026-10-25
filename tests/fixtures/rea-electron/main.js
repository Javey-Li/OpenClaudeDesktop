// Static analysis fixture. Do not execute this file.
const { app, BrowserWindow, ipcMain } = require('electron');
ipcMain.handle('profile:load', async () => ({ id: 'demo' }));
app.whenReady().then(() => {
  const window = new BrowserWindow({ webPreferences: { preload: __dirname + '/preload.js' } });
  window.loadFile('index.html');
});
fetch('https://api.example.test/v1/health');
