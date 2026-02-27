const { contextBridge, ipcRenderer, webUtils } = require('electron');

// ─── Drag-and-drop path extraction ─────────────────────────────────────────
// With contextIsolation the renderer's File objects are structurally cloned
// when passed through contextBridge – the internal Electron `path` metadata
// that webUtils.getPathForFile reads is lost during the clone.
// Fix: capture the drop event in the preload (which runs in the same V8
// context as the isolated renderer and thus receives the *original* File
// objects) and store the resolved paths so the renderer can read them
// synchronously after its own drop handler fires.
let _lastDroppedPaths = [];

window.addEventListener('drop', (event) => {
  _lastDroppedPaths = [];
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  for (const file of files) {
    try {
      const p = webUtils.getPathForFile(file);
      if (p) _lastDroppedPaths.push(p);
    } catch { /* skip unresolvable entries */ }
  }
}, true); // capture phase – fires before the renderer's handler

contextBridge.exposeInMainWorld('api', {
  listTemplates: () => ipcRenderer.invoke('list-templates'),
  importTemplateFromZip: (zipPath) => ipcRenderer.invoke('import-template-zip', zipPath),
  dryRunApply: (templateId, rootPath, tokens) => ipcRenderer.invoke('dry-run-apply', templateId, rootPath, tokens),
  applyTemplate: (templateId, rootPath, tokens, policy) => ipcRenderer.invoke('apply-template', templateId, rootPath, tokens, policy),
  registerWorkspace: (rootPath) => ipcRenderer.invoke('register-workspace', rootPath),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  listDirectory: (payload) => ipcRenderer.invoke('workspace:list-dir', payload),
  readTextFile: (payload) => ipcRenderer.invoke('workspace:read-text', payload),
  readBinaryFile: (payload) => ipcRenderer.invoke('workspace:read-binary', payload),
  getFileUrl: (payload) => ipcRenderer.invoke('workspace:get-file-url', payload),
  mergeTextFiles: (payload) => ipcRenderer.invoke('workspace:merge-text', payload),
  splitTextFile: (payload) => ipcRenderer.invoke('workspace:split-text', payload),
  createDirectory: (payload) => ipcRenderer.invoke('workspace:create-dir', payload),
  writeTextFile: (payload) => ipcRenderer.invoke('workspace:write-text', payload),
  renameEntry: (payload) => ipcRenderer.invoke('workspace:rename', payload),
  deleteEntries: (payload) => ipcRenderer.invoke('workspace:delete', payload),
  copyEntries: (payload) => ipcRenderer.invoke('workspace:copy', payload),
  moveEntries: (payload) => ipcRenderer.invoke('workspace:move', payload),
  getEntryInfo: (payload) => ipcRenderer.invoke('workspace:entry-info', payload),
  revealInExplorer: (payload) => ipcRenderer.invoke('workspace:reveal-in-explorer', payload),
  openInVSCode: (payload) => ipcRenderer.invoke('workspace:open-in-vscode', payload),
  importExternalFiles: (payload) => ipcRenderer.invoke('workspace:import-external', payload),
  archiveEntries: (payload) => ipcRenderer.invoke('workspace:archive', payload),
  extractArchive: (payload) => ipcRenderer.invoke('workspace:extract', payload),
  readClipboardFilePaths: () => ipcRenderer.invoke('clipboard:read-file-paths'),
  hasClipboardFiles: () => ipcRenderer.invoke('clipboard:has-file-paths'),
  setClipboardFilePaths: (paths) => ipcRenderer.invoke('clipboard:set-file-paths', paths),
  getDroppedFilePaths: () => {
    // Return the paths captured by the preload's capture-phase drop listener
    const paths = [..._lastDroppedPaths];
    _lastDroppedPaths = [];
    return paths;
  },
  listTemplates: () => ipcRenderer.invoke('templates:list'),
  createTemplateFromFolder: (payload) => ipcRenderer.invoke('templates:create-from-folder', payload),
  getTemplateManifest: (payload) => ipcRenderer.invoke('templates:get', payload),
  saveTemplateManifest: (payload) => ipcRenderer.invoke('templates:save', payload),
  deleteTemplate: (payload) => ipcRenderer.invoke('templates:delete', payload),
  applyTemplateToProject: (payload) => ipcRenderer.invoke('templates:apply-to-project', payload),
  listWorkspaceTemplates: (payload) => ipcRenderer.invoke('workspace-templates:list', payload),
  saveWorkspaceTemplates: (payload) => ipcRenderer.invoke('workspace-templates:save', payload),
  // simple event subscription for progress
  onProgress: (cb) => {
    const listener = (event, data) => cb(data);
    ipcRenderer.on('apply-progress', listener);
    return () => ipcRenderer.removeListener('apply-progress', listener);
  },
  // Auto-update listeners
  onUpdateAvailable: (callback) => {
    const listener = (event, info) => callback(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  onUpdateNotAvailable: (callback) => {
    const listener = (event, info) => callback(info);
    ipcRenderer.on('update-not-available', listener);
    return () => ipcRenderer.removeListener('update-not-available', listener);
  },
  onUpdateError: (callback) => {
    const listener = (event, err) => callback(err);
    ipcRenderer.on('update-error', listener);
    return () => ipcRenderer.removeListener('update-error', listener);
  },
  onUpdateDownloaded: (callback) => {
    const listener = (event, info) => callback(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  restartAndInstall: () => ipcRenderer.invoke('restart-and-install'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getProcessVersions: () => ipcRenderer.invoke('get-process-versions'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  // Open a popout window (Electron BrowserWindow instead of external browser)
  openPopoutWindow: (url, options) => ipcRenderer.invoke('open-popout-window', url, options),
  // subscribe to menu events from main
  onMenuCommand: (cb) => {
    const handler = (event, payload) => cb(payload);
    ipcRenderer.on('menu-command', handler);
    return () => ipcRenderer.removeListener('menu-command', handler);
  },
  // allow renderer to invoke simple built-in actions if needed
  invokeMainAction: (actionId, args) => ipcRenderer.invoke('main-action:' + actionId, args),
  // Get the actual HTTP API base URL for direct connections (SSE, WebSocket)
  getApiBaseUrl: () => ipcRenderer.invoke('get-api-base-url'),
});
