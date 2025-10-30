const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listTemplates: () => ipcRenderer.invoke('list-templates'),
  importTemplateFromZip: (zipPath) => ipcRenderer.invoke('import-template-zip', zipPath),
  dryRunApply: (templateId, rootPath, tokens) => ipcRenderer.invoke('dry-run-apply', templateId, rootPath, tokens),
  applyTemplate: (templateId, rootPath, tokens, policy) => ipcRenderer.invoke('apply-template', templateId, rootPath, tokens, policy),
  registerWorkspace: (rootPath) => ipcRenderer.invoke('register-workspace', rootPath),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  // simple event subscription for progress
  onProgress: (cb) => {
    const listener = (event, data) => cb(data);
    ipcRenderer.on('apply-progress', listener);
    return () => ipcRenderer.removeListener('apply-progress', listener);
  }
});
