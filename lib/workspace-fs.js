const fs = require('fs-extra');
const path = require('path');

const DEFAULT_MAX_PREVIEW_BYTES = 512 * 1024; // 512KB

const ensureString = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
  return value;
};

const normalizeRoot = (rootPath) => {
  const normalized = path.resolve(ensureString(rootPath, 'rootPath'));
  return normalized;
};

const toPosix = (value) => value.split(path.sep).join('/');

const relativeFromRoot = (rootPath, targetPath) => {
  return toPosix(path.relative(rootPath, targetPath));
};

const ensureWithinWorkspace = (rootPath, candidatePath) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const normalizedCandidate = path.resolve(candidatePath);

  if (normalizedCandidate === normalizedRoot) {
    return { root: normalizedRoot, target: normalizedCandidate };
  }

  if (!normalizedCandidate.startsWith(normalizedRoot + path.sep)) {
    throw new Error('Attempted to access path outside the workspace root');
  }

  return { root: normalizedRoot, target: normalizedCandidate };
};

const buildBreadcrumbs = (rootPath, targetDir) => {
  const breadcrumbs = [{ label: 'Root', path: '' }];
  const relative = relativeFromRoot(rootPath, targetDir);

  if (!relative) {
    return breadcrumbs;
  }

  const segments = relative.split('/').filter(Boolean);
  let accumulator = '';

  for (const segment of segments) {
    accumulator = accumulator ? `${accumulator}/${segment}` : segment;
    breadcrumbs.push({ label: segment, path: accumulator });
  }

  return breadcrumbs;
};

const listDirectory = async (rootPath, relativePath = '.') => {
  const normalizedRoot = normalizeRoot(rootPath);
  const absoluteTarget = path.resolve(normalizedRoot, relativePath);
  const { target } = ensureWithinWorkspace(normalizedRoot, absoluteTarget);

  const targetStat = await fs.stat(target);
  if (!targetStat.isDirectory()) {
    throw new Error('Provided path is not a directory');
  }

  const dirents = await fs.readdir(target, { withFileTypes: true });
  const entries = [];

  await Promise.all(
    dirents.map(async (dirent) => {
      const entryPath = path.join(target, dirent.name);
      const { target: safeEntryPath } = ensureWithinWorkspace(normalizedRoot, entryPath);
      const stats = await fs.stat(safeEntryPath);
      entries.push({
        name: dirent.name,
        path: relativeFromRoot(normalizedRoot, safeEntryPath),
        type: dirent.isDirectory() ? 'directory' : 'file',
        size: dirent.isDirectory() ? null : stats.size,
        modifiedAt: stats.mtime.toISOString(),
      });
    })
  );

  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return {
    path: relativeFromRoot(normalizedRoot, target),
    entries,
    breadcrumbs: buildBreadcrumbs(normalizedRoot, target),
  };
};

const readTextFile = async (rootPath, relativePath, options = {}) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const absoluteTarget = path.resolve(normalizedRoot, ensureString(relativePath, 'relativePath'));
  const { target } = ensureWithinWorkspace(normalizedRoot, absoluteTarget);

  const stats = await fs.stat(target);
  if (!stats.isFile()) {
    throw new Error('Target path is not a file');
  }

  const maxBytes = typeof options.maxBytes === 'number' && options.maxBytes > 0 ? options.maxBytes : DEFAULT_MAX_PREVIEW_BYTES;
  const encoding = options.encoding || 'utf8';

  const totalSize = stats.size;
  let truncated = false;
  let content;

  if (totalSize > maxBytes) {
    truncated = true;
    const fileHandle = await fs.open(target, 'r');
    try {
      const buffer = Buffer.alloc(maxBytes);
      const { bytesRead } = await fileHandle.read(buffer, 0, maxBytes, 0);
      content = buffer.slice(0, bytesRead).toString(encoding);
    } finally {
      await fileHandle.close();
    }
  } else {
    content = await fs.readFile(target, { encoding });
  }

  return {
    path: relativeFromRoot(normalizedRoot, target),
    content,
    truncated,
    size: totalSize,
  };
};

const mergeTextFiles = async (rootPath, sources, destination, options = {}) => {
  const normalizedRoot = normalizeRoot(rootPath);

  if (!Array.isArray(sources) || sources.length < 2) {
    throw new Error('Provide at least two source files to merge');
  }

  const resolvedSources = sources.map((source) => {
    const absoluteSource = path.resolve(normalizedRoot, ensureString(source, 'source'));
    const { target } = ensureWithinWorkspace(normalizedRoot, absoluteSource);
    return target;
  });

  const destinationPath = path.resolve(normalizedRoot, ensureString(destination, 'destination'));
  ensureWithinWorkspace(normalizedRoot, destinationPath);

  const overwrite = options.overwrite === true;
  if (!overwrite && (await fs.pathExists(destinationPath))) {
    throw new Error(`Destination file already exists: ${path.relative(normalizedRoot, destinationPath)}`);
  }

  const separator = typeof options.separator === 'string' ? options.separator : '\n\n';
  const includeHeaders = options.includeHeaders !== false;

  const chunks = [];

  for (const source of resolvedSources) {
    const stats = await fs.stat(source);
    if (!stats.isFile()) {
      throw new Error(`Cannot merge non-file entry: ${path.relative(normalizedRoot, source)}`);
    }

    const content = await fs.readFile(source, { encoding: options.encoding || 'utf8' });
    if (includeHeaders) {
      chunks.push(`# ${path.basename(source)}`);
    }
    chunks.push(content);
  }

  const mergedContent = chunks.join(separator);
  await fs.mkdirp(path.dirname(destinationPath));
  await fs.writeFile(destinationPath, mergedContent, { encoding: options.encoding || 'utf8' });

  return {
    destination: relativeFromRoot(normalizedRoot, destinationPath),
  };
};

const splitTextFile = async (rootPath, source, options = {}) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const absoluteSource = path.resolve(normalizedRoot, ensureString(source, 'source'));
  const { target } = ensureWithinWorkspace(normalizedRoot, absoluteSource);

  const stats = await fs.stat(target);
  if (!stats.isFile()) {
    throw new Error('Only files can be split');
  }

  const separator = ensureString(options.separator || '\n\n', 'separator');
  const encoding = options.encoding || 'utf8';
  const preserveOriginal = options.preserveOriginal !== false;

  const prefix = options.prefix || `${path.basename(target, path.extname(target))}-part`;
  const extension = options.extension || path.extname(target) || '.txt';
  const overwrite = options.overwrite === true;

  const contents = await fs.readFile(target, { encoding });
  const pieces = contents.split(separator);

  const created = [];

  for (let idx = 0; idx < pieces.length; idx += 1) {
    const piece = pieces[idx];
    if (!piece.trim()) {
      continue;
    }

    const relativeDirRaw = path.dirname(relativeFromRoot(normalizedRoot, target));
    const relativeDir = relativeDirRaw === '.' ? '' : relativeDirRaw;
    const filename = `${prefix}-${String(idx + 1).padStart(2, '0')}${extension}`;
    const relPath = relativeDir ? `${relativeDir}/${filename}` : filename;
    const absoluteDest = path.resolve(normalizedRoot, relPath.split('/').join(path.sep));
    ensureWithinWorkspace(normalizedRoot, absoluteDest);

    if (!overwrite && (await fs.pathExists(absoluteDest))) {
      throw new Error(`Split destination already exists: ${relPath}`);
    }

    await fs.mkdirp(path.dirname(absoluteDest));
    await fs.writeFile(absoluteDest, piece.trim(), { encoding });
    created.push(relPath);
  }

  if (!preserveOriginal) {
    await fs.remove(target);
  }

  return { created: created.map((rel) => rel) };
};

const sanitizeRelativePath = (value) => {
  if (typeof value !== 'string') {
    throw new Error('relativePath must be a string');
  }
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!normalized) {
    throw new Error('relativePath is required');
  }
  if (normalized.includes('..')) {
    throw new Error('relativePath cannot traverse outside the workspace');
  }
  return normalized;
};

const resolveRelativeTarget = (rootPath, relativePath) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const sanitized = sanitizeRelativePath(relativePath);
  const absolute = path.resolve(normalizedRoot, sanitized.split('/').join(path.sep));
  const { target } = ensureWithinWorkspace(normalizedRoot, absolute);
  return { root: normalizedRoot, target, relative: relativeFromRoot(normalizedRoot, target) };
};

const createDirectory = async (rootPath, relativePath) => {
  const { target, relative } = resolveRelativeTarget(rootPath, relativePath);
  await fs.mkdirp(target);
  return { path: relative };
};

const writeTextFile = async (rootPath, relativePath, content = '', options = {}) => {
  const { target, relative } = resolveRelativeTarget(rootPath, relativePath);
  await fs.mkdirp(path.dirname(target));
  await fs.writeFile(target, content ?? '', { encoding: options.encoding || 'utf8' });
  return { path: relative };
};

const renameEntry = async (rootPath, oldRelativePath, newName) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const absoluteOld = path.resolve(normalizedRoot, ensureString(oldRelativePath, 'oldRelativePath'));
  const { target: oldTarget } = ensureWithinWorkspace(normalizedRoot, absoluteOld);

  if (!(await fs.pathExists(oldTarget))) {
    throw new Error('Source path does not exist');
  }

  const sanitizedNewName = ensureString(newName, 'newName');
  if (sanitizedNewName.includes('/') || sanitizedNewName.includes('\\') || sanitizedNewName.includes('..')) {
    throw new Error('New name cannot contain path separators or parent directory references');
  }

  const parentDir = path.dirname(oldTarget);
  const newTarget = path.join(parentDir, sanitizedNewName);
  ensureWithinWorkspace(normalizedRoot, newTarget);

  if (await fs.pathExists(newTarget)) {
    throw new Error('A file or folder with that name already exists');
  }

  await fs.move(oldTarget, newTarget);

  return {
    oldPath: relativeFromRoot(normalizedRoot, oldTarget),
    newPath: relativeFromRoot(normalizedRoot, newTarget),
  };
};

module.exports = {
  listDirectory,
  readTextFile,
  mergeTextFiles,
  splitTextFile,
  createDirectory,
  writeTextFile,
  renameEntry,
};
