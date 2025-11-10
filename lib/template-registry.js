const path = require('path');
const fs = require('fs-extra');
const { randomUUID } = require('crypto');

const templateEngine = require('./template-engine');
const fsExecutor = require('./fs-executor');

const STORE_FOLDER = 'templates';

const ensureStoreRoot = async (userDataRoot) => {
  const storeRoot = path.join(userDataRoot, STORE_FOLDER);
  await fs.mkdirp(storeRoot);
  return storeRoot;
};

const sanitizeRelativePath = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (normalized.includes('..')) {
    throw new Error('Relative paths cannot traverse outside their root');
  }
  return normalized;
};

const isBinaryBuffer = (buffer) => {
  for (let i = 0; i < buffer.length; i += 1) {
    const charCode = buffer[i];
    if (charCode === 0) {
      return true;
    }
  }
  return false;
};

const buildManifestFromFolder = async (sourceFolder) => {
  const folders = [];
  const files = [];

  const walk = async (currentDir) => {
    const dirents = await fs.readdir(currentDir, { withFileTypes: true });
    for (const dirent of dirents) {
      const absolutePath = path.join(currentDir, dirent.name);
      const relativePath = sanitizeRelativePath(path.relative(sourceFolder, absolutePath));

      if (!relativePath) {
        continue;
      }

      if (dirent.isDirectory()) {
        folders.push({ path: relativePath });
        await walk(absolutePath);
      } else if (dirent.isFile()) {
        const buffer = await fs.readFile(absolutePath);
        const binary = isBinaryBuffer(buffer);
        if (binary) {
          files.push({ path: relativePath, binary: true, content: buffer.toString('base64') });
        } else {
          files.push({ path: relativePath, content: buffer.toString('utf8') });
        }
      }
    }
  };

  await walk(sourceFolder);

  return { folders, files };
};

const readManifest = async (storeRoot, templateId) => {
  const manifestPath = path.join(storeRoot, templateId, 'manifest.json');
  const manifest = await fs.readJson(manifestPath);
  manifest.folders = Array.isArray(manifest.folders) ? manifest.folders : [];
  manifest.files = Array.isArray(manifest.files) ? manifest.files : [];
  manifest.tokens = Array.isArray(manifest.tokens) ? manifest.tokens : [];
  return manifest;
};

const normalizeFolders = (folders = []) => {
  return folders
    .map((folder) => sanitizeRelativePath(folder?.path || ''))
    .filter((path) => path)
    .map((path) => ({ path }));
};

const normalizeFiles = (files = []) => {
  return files
    .map((file) => {
      const pathValue = sanitizeRelativePath(file?.path || '');
      if (!pathValue) return null;
      return {
        path: pathValue,
        content: file?.content || '',
        binary: !!file?.binary,
        encoding: file?.encoding
      };
    })
    .filter(Boolean);
};

const writeManifest = async (storeRoot, manifest) => {
  const templateDir = path.join(storeRoot, manifest.id);
  await fs.mkdirp(templateDir);
  const manifestPath = path.join(templateDir, 'manifest.json');
  const persisted = {
    ...manifest,
    createdAt: manifest.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    folders: normalizeFolders(manifest.folders),
    files: normalizeFiles(manifest.files),
    tokens: Array.isArray(manifest.tokens) ? manifest.tokens : []
  };
  await fs.writeJson(manifestPath, persisted, { spaces: 2 });
  return persisted;
};

const listTemplates = async (userDataRoot) => {
  const storeRoot = await ensureStoreRoot(userDataRoot);
  const entries = await fs.readdir(storeRoot).catch(() => []);

  const templates = [];

  for (const entry of entries) {
    const manifestPath = path.join(storeRoot, entry, 'manifest.json');
    const exists = await fs.pathExists(manifestPath);
    if (!exists) continue;

    try {
      const manifest = await fs.readJson(manifestPath);
      templates.push({
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        createdAt: manifest.createdAt,
        updatedAt: manifest.updatedAt,
        folderCount: Array.isArray(manifest.folders) ? manifest.folders.length : 0,
        fileCount: Array.isArray(manifest.files) ? manifest.files.length : 0
      });
    } catch (err) {
      console.warn('Failed to read template manifest', entry, err);
    }
  }

  templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { templates };
};

const createTemplateFromFolder = async (userDataRoot, { name, description, sourcePath }) => {
  const storeRoot = await ensureStoreRoot(userDataRoot);
  if (!sourcePath) {
    throw new Error('Source path is required');
  }
  const normalizedSource = path.resolve(sourcePath);
  const stat = await fs.stat(normalizedSource);
  if (!stat.isDirectory()) {
    throw new Error('Source path must be a directory');
  }

  const manifest = await buildManifestFromFolder(normalizedSource);

  const template = {
    id: randomUUID(),
    name: name || path.basename(normalizedSource),
    description: description || '',
    createdAt: new Date().toISOString(),
    folders: manifest.folders,
    files: manifest.files
  };

  await writeManifest(storeRoot, template);
  return template;
};

const saveTemplateManifest = async (userDataRoot, manifestInput) => {
  const storeRoot = await ensureStoreRoot(userDataRoot);
  const template = {
    id: manifestInput.id || randomUUID(),
    name: manifestInput.name?.trim() || 'Untitled Template',
    description: manifestInput.description?.trim() || '',
    createdAt: manifestInput.createdAt,
    folders: manifestInput.folders || [],
    files: manifestInput.files || [],
    tokens: manifestInput.tokens || []
  };

  const persisted = await writeManifest(storeRoot, template);
  return {
    id: persisted.id,
    name: persisted.name,
    description: persisted.description,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
    folders: persisted.folders,
    files: persisted.files,
    tokens: persisted.tokens
  };
};

const getTemplateManifest = async (userDataRoot, templateId) => {
  const storeRoot = await ensureStoreRoot(userDataRoot);
  const manifest = await readManifest(storeRoot, templateId);
  return manifest;
};

const deleteTemplate = async (userDataRoot, templateId) => {
  const storeRoot = await ensureStoreRoot(userDataRoot);
  const templateDir = path.join(storeRoot, templateId);
  await fs.remove(templateDir);
  return { ok: true };
};

const applyTemplateToProject = async (userDataRoot, templateId, workspaceRoot, projectRelativePath, tokens = {}) => {
  const storeRoot = await ensureStoreRoot(userDataRoot);
  if (!templateId) {
    throw new Error('Template id is required');
  }
  const manifest = await readManifest(storeRoot, templateId);

  const projectRoot = path.join(workspaceRoot, sanitizeRelativePath(projectRelativePath));
  await fs.mkdirp(projectRoot);

  const ops = templateEngine.generateDryRun(manifest, projectRoot, tokens);
  return fsExecutor.applyDryRunOpsTransactional(ops, workspaceRoot, { policy: 'overwrite' });
};

module.exports = {
  listTemplates,
  createTemplateFromFolder,
  saveTemplateManifest,
  getTemplateManifest,
  deleteTemplate,
  applyTemplateToProject
};
