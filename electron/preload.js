const { contextBridge, ipcRenderer } = require('electron');

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
  }
});
