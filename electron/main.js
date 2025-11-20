const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const isDev = !app.isPackaged || process.env.ELECTRON_DEV === 'true' || process.env.NODE_ENV === 'development';
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = 'http://127.0.0.1:5173';
  const prodEntry = path.join(__dirname, '..', 'apps', 'web', 'dist', 'index.html');

  if (isDev) {
    win
      .loadURL(devUrl)
      .catch((err) => {
        console.error('Failed to load dev url, falling back to packaged build', err);
        return win.loadFile(prodEntry);
      })
      .catch((err) => console.error('Failed to load fallback entry', err));
  } else {
    win.loadFile(prodEntry).catch((err) => console.error('Failed to load packaged entry', err));
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

ipcMain.handle('select-directory', async () => {
  try {
    const browserWindow = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showOpenDialog(browserWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  } catch (err) {
    return { canceled: true, error: String(err) };
  }
});

// hook up template & fs services
const templateZip = require('../lib/template-zip');
const templateEngine = require('../lib/template-engine');
const fsExecutor = require('../lib/fs-executor');
const workspaceFs = require('../lib/workspace-fs');
const templateRegistry = require('../lib/template-registry');
const workspaceTemplateMap = require('../lib/workspace-template-map');

const getUserDataRoot = () => path.join(app.getPath('userData'), 'workspace-organizer');

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

ipcMain.handle('workspace:list-dir', async (event, payload) => {
  try {
    const result = await workspaceFs.listDirectory(payload?.rootPath, payload?.relativePath);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:read-text', async (event, payload) => {
  try {
    const result = await workspaceFs.readTextFile(payload?.rootPath, payload?.relativePath, {
      maxBytes: payload?.maxBytes,
      encoding: payload?.encoding,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:merge-text', async (event, payload) => {
  try {
    const result = await workspaceFs.mergeTextFiles(payload?.rootPath, payload?.sources, payload?.destination, {
      separator: payload?.separator,
      includeHeaders: payload?.includeHeaders,
      overwrite: payload?.overwrite,
      encoding: payload?.encoding,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:split-text', async (event, payload) => {
  try {
    const result = await workspaceFs.splitTextFile(payload?.rootPath, payload?.source, {
      separator: payload?.separator,
      prefix: payload?.prefix,
      extension: payload?.extension,
      overwrite: payload?.overwrite,
      preserveOriginal: payload?.preserveOriginal,
      encoding: payload?.encoding,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:create-dir', async (event, payload) => {
  try {
    const result = await workspaceFs.createDirectory(payload?.rootPath, payload?.relativePath);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:write-text', async (event, payload) => {
  try {
    const result = await workspaceFs.writeTextFile(payload?.rootPath, payload?.relativePath, payload?.content, {
      encoding: payload?.encoding,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace:rename', async (event, payload) => {
  try {
    const result = await workspaceFs.renameEntry(payload?.rootPath, payload?.oldRelativePath, payload?.newName);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:list', async () => {
  try {
    const result = await templateRegistry.listTemplates(getUserDataRoot());
    return { ok: true, templates: result.templates };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:create-from-folder', async (event, payload) => {
  try {
    const template = await templateRegistry.createTemplateFromFolder(getUserDataRoot(), {
      name: payload?.name,
      description: payload?.description,
      sourcePath: payload?.sourcePath
    });
    return { ok: true, template };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:get', async (event, payload) => {
  try {
    const manifest = await templateRegistry.getTemplateManifest(getUserDataRoot(), payload?.templateId);
    return { ok: true, manifest };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:save', async (event, payload) => {
  try {
    const saved = await templateRegistry.saveTemplateManifest(getUserDataRoot(), payload);
    return { ok: true, template: saved };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:delete', async (event, payload) => {
  try {
    await templateRegistry.deleteTemplate(getUserDataRoot(), payload?.templateId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('templates:apply-to-project', async (event, payload) => {
  try {
    const result = await templateRegistry.applyTemplateToProject(
      getUserDataRoot(),
      payload?.templateId,
      payload?.workspaceRoot,
      payload?.projectRelativePath,
      payload?.tokens || {}
    );
    return result;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace-templates:list', async (event, payload) => {
  try {
    const workspaceRoot = payload?.workspaceRoot;
    if (!workspaceRoot) {
      throw new Error('workspaceRoot is required');
    }
    const templateIds = await workspaceTemplateMap.listWorkspaceTemplates(getUserDataRoot(), workspaceRoot);
    const allTemplates = await templateRegistry.listTemplates(getUserDataRoot());
    const templates = allTemplates.templates.filter((tpl) => templateIds.includes(tpl.id));
    return { ok: true, templateIds, templates };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('workspace-templates:save', async (event, payload) => {
  try {
    const workspaceRoot = payload?.workspaceRoot;
    const templateIds = Array.isArray(payload?.templateIds) ? payload.templateIds : [];
    if (!workspaceRoot) {
      throw new Error('workspaceRoot is required');
    }
    await workspaceTemplateMap.saveWorkspaceTemplates(getUserDataRoot(), workspaceRoot, templateIds);
    const allTemplates = await templateRegistry.listTemplates(getUserDataRoot());
    const templates = allTemplates.templates.filter((tpl) => templateIds.includes(tpl.id));
    return { ok: true, templateIds, templates };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});
