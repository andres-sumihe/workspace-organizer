const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = 'http://localhost:5173';
  if (process.env.ELECTRON_DEV || process.env.NODE_ENV === 'development') {
    win.loadURL(devUrl).catch((err) => console.error('Failed to load dev url', err));
  } else {
    win.loadFile(path.join(__dirname, '..', 'apps', 'web', 'dist', 'index.html')).catch((err) => console.error(err));
  }

  return win;
}

app.on('ready', () => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Minimal IPC handlers (placeholders). Implementations will be provided by lib modules.
ipcMain.handle('list-templates', async () => {
  return { items: [] };
});

ipcMain.handle('open-path', async (event, filePath) => {
  const { shell } = require('electron');
  try {
    await shell.openPath(filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// hook up template & fs services
const templateZip = require('../lib/template-zip');
const templateEngine = require('../lib/template-engine');
const fsExecutor = require('../lib/fs-executor');

ipcMain.handle('import-template-zip', async (event, zipPath) => {
  return templateZip.importZipToFolder(zipPath, path.join(app.getPath('userData'), 'templates', path.basename(zipPath, '.zip')));
});

ipcMain.handle('dry-run-apply', async (event, manifestObj, rootPath, tokens) => {
  try {
    const manifest = templateEngine.parseManifest(manifestObj);
    const ops = templateEngine.generateDryRun(manifest, rootPath, tokens || {});
    return { ok: true, ops };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('apply-template', async (event, manifestObj, rootPath, tokens, policy) => {
  try {
    const manifest = templateEngine.parseManifest(manifestObj);
    const ops = templateEngine.generateDryRun(manifest, rootPath, tokens || {});
    const result = await fsExecutor.applyDryRunOpsTransactional(ops, rootPath, { policy });
    return result;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});
