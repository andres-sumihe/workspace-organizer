const mustache = require('mustache');
const fs = require('fs');
const path = require('path');

function isBinaryFile(filename) {
  // Very small heuristic: check extension for common binaries
  const ext = path.extname(filename).toLowerCase();
  const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.exe', '.dll'];
  return binaryExts.includes(ext);
}

function parseManifest(manifestJson) {
  // manifestJson is already an object; return as-is for now
  return manifestJson;
}

function generateDryRun(manifest, rootPath, tokens) {
  const ops = [];

  for (const folder of manifest.folders || []) {
    const resolved = mustache.render(folder.path, tokens || {});
    ops.push({ type: 'mkdir', path: path.join(rootPath, resolved) });
  }

  for (const file of manifest.files || []) {
    const targetRel = mustache.render(file.path, tokens || {});
    const targetPath = path.join(rootPath, targetRel);
    ops.push({
      type: 'write',
      path: targetPath,
      content: isBinaryFile(file.path) ? null : mustache.render(file.content || '', tokens || {}),
      binary: !!file.binary,
    });
  }

  return ops;
}

module.exports = { parseManifest, generateDryRun, isBinaryFile };
