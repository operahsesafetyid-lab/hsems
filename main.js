const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(app.getPath('userData'), 'hse-data');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJSON(f, d) {
  try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : d; } catch { return d; }
}
function writeJSON(f, d) {
  ensureDir();
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1024, minHeight: 600,
    title: 'HSE Management System',
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const isDev = !fs.existsSync(path.join(__dirname, 'build', 'index.html'));
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'build', 'index.html'));
  }
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('incidents:getAll', () => readJSON(INCIDENTS_FILE, []));
ipcMain.handle('incidents:save', (_, inc) => {
  const all = readJSON(INCIDENTS_FILE, []);
  const i = all.findIndex(x => x.id === inc.id);
  if (i >= 0) all[i] = inc; else all.unshift(inc);
  writeJSON(INCIDENTS_FILE, all);
  return { success: true };
});
ipcMain.handle('incidents:delete', (_, id) => {
  writeJSON(INCIDENTS_FILE, readJSON(INCIDENTS_FILE, []).filter(x => x.id !== id));
  return { success: true };
});
ipcMain.handle('settings:get', () => readJSON(SETTINGS_FILE, {
  company: 'Freelancer', department: 'HSE Department', location: 'Qatar'
}));
ipcMain.handle('settings:save', (_, s) => { writeJSON(SETTINGS_FILE, s); return { success: true }; });
ipcMain.handle('incidents:export', async () => {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Backup',
    defaultPath: `HSE_Backup_${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!filePath) return { success: false };
  writeJSON(filePath, readJSON(INCIDENTS_FILE, []));
  return { success: true };
});
ipcMain.handle('incidents:import', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (!filePaths.length) return { success: false };
  try {
    const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
    const existing = readJSON(INCIDENTS_FILE, []);
    const merged = [...data, ...existing.filter(e => !data.find(i => i.id === e.id))];
    writeJSON(INCIDENTS_FILE, merged);
    return { success: true, count: data.length };
  } catch { return { success: false }; }
});
ipcMain.handle('app:openDataFolder', () => shell.openPath(DATA_DIR));
ipcMain.handle('app:info', () => ({
  version: app.getVersion(), platform: process.platform, dataDir: DATA_DIR
}));
