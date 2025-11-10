const mustache = require('mustache');
const path = require('path');

const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.exe', '.dll', '.ico', '.webp']);

const parseManifest = (manifestJson) => {
  if (!manifestJson || typeof manifestJson !== 'object') {
    throw new Error('Invalid template manifest');
  }
  const manifest = {
    ...manifestJson,
    folders: Array.isArray(manifestJson.folders) ? manifestJson.folders : [],
    files: Array.isArray(manifestJson.files) ? manifestJson.files : []
  };
  return manifest;
};

const isBinaryPath = (filePath, explicitFlag) => {
  if (explicitFlag) return true;
  const ext = path.extname(filePath || '').toLowerCase();
  return BINARY_EXTS.has(ext);
};

const renderFileContent = (file, tokens) => {
  if (isBinaryPath(file.path, file.binary)) {
    const encoding = file.encoding === 'base64' || file.binary ? 'base64' : 'utf8';
    const buffer = Buffer.from(file.content || '', encoding);
    return buffer;
  }
  return mustache.render(file.content || '', tokens || {});
};

const generateDryRun = (manifestJson, rootPath, tokens = {}) => {
  const manifest = parseManifest(manifestJson);
  const ops = [];

  for (const folder of manifest.folders) {
    const resolved = mustache.render(folder.path, tokens);
    ops.push({ type: 'mkdir', path: path.join(rootPath, resolved) });
  }

  for (const file of manifest.files) {
    const targetRel = mustache.render(file.path, tokens);
    const targetPath = path.join(rootPath, targetRel);
    const renderedContent = renderFileContent(file, tokens);
    ops.push({
      type: 'write',
      path: targetPath,
      content: renderedContent,
      binary: Buffer.isBuffer(renderedContent)
    });
  }

  return ops;
};

module.exports = { parseManifest, generateDryRun };
