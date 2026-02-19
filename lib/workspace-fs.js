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

const readBinaryFile = async (rootPath, relativePath) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const absoluteTarget = path.resolve(normalizedRoot, ensureString(relativePath, 'relativePath'));
  const { target } = ensureWithinWorkspace(normalizedRoot, absoluteTarget);

  const stats = await fs.stat(target);
  if (!stats.isFile()) {
    throw new Error('Target path is not a file');
  }

  const buffer = await fs.readFile(target);
  const base64 = buffer.toString('base64');
  
  // Detect MIME type from extension
  const ext = path.extname(target).toLowerCase().slice(1);
  const mimeTypes = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    avif: 'image/avif',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    wma: 'audio/x-ms-wma',
    // PDF
    pdf: 'application/pdf'
  };
  
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  return {
    path: relativeFromRoot(normalizedRoot, target),
    base64,
    mimeType,
    size: stats.size,
  };
};

const getFileUrl = async (rootPath, relativePath) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const absoluteTarget = path.resolve(normalizedRoot, ensureString(relativePath, 'relativePath'));
  const { target } = ensureWithinWorkspace(normalizedRoot, absoluteTarget);

  const stats = await fs.stat(target);
  if (!stats.isFile()) {
    throw new Error('Target path is not a file');
  }

  // Return a file:// URL that can be used by Electron
  const fileUrl = `file://${target.replace(/\\/g, '/')}`;

  return {
    path: relativeFromRoot(normalizedRoot, target),
    url: fileUrl,
    size: stats.size,
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

  const mode = options.mode || 'simple';
  const encoding = options.encoding || 'utf8';
  const chunks = [];

  if (mode === 'boundary') {
    // PowerShell-style boundary format with metadata
    for (let idx = 0; idx < resolvedSources.length; idx++) {
      const source = resolvedSources[idx];
      const stats = await fs.stat(source);
      if (!stats.isFile()) {
        throw new Error(`Cannot merge non-file entry: ${path.relative(normalizedRoot, source)}`);
      }

      const content = await fs.readFile(source, { encoding });
      const filename = path.basename(source);
      const boundary = `---FILE-BOUNDARY---|${filename}|${idx + 1}|`;
      const meta = JSON.stringify({ Source: filename, Index: idx + 1 });

      chunks.push(boundary);
      chunks.push(meta);
      chunks.push(content);
      chunks.push(''); // Empty line after each file
    }
  } else {
    // Simple mode with optional headers and custom separator
    const separator = typeof options.separator === 'string' ? options.separator : '\n\n';
    const includeHeaders = options.includeHeaders !== false;

    for (const source of resolvedSources) {
      const stats = await fs.stat(source);
      if (!stats.isFile()) {
        throw new Error(`Cannot merge non-file entry: ${path.relative(normalizedRoot, source)}`);
      }

      const content = await fs.readFile(source, { encoding });
      if (includeHeaders) {
        chunks.push(`# ${path.basename(source)}`);
      }
      chunks.push(content);
    }

    const mergedContent = chunks.join(separator);
    await fs.mkdirp(path.dirname(destinationPath));
    await fs.writeFile(destinationPath, mergedContent, { encoding });

    return {
      destination: relativeFromRoot(normalizedRoot, destinationPath),
      content: mergedContent,
    };
  }

  // Boundary mode uses newline separators
  const mergedContent = chunks.join('\n');
  await fs.mkdirp(path.dirname(destinationPath));
  await fs.writeFile(destinationPath, mergedContent, { encoding });

  return {
    destination: relativeFromRoot(normalizedRoot, destinationPath),
    content: mergedContent,
  };
};

const splitTextFile = async (rootPath, source, options = {}) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const encoding = options.encoding || 'utf8';
  let contents;
  let outputDir;

  // Support clipboard input or file source
  if (options.clipboardContent) {
    contents = options.clipboardContent;
    outputDir = options.outputDir || '';
  } else {
    const absoluteSource = path.resolve(normalizedRoot, ensureString(source, 'source'));
    const { target } = ensureWithinWorkspace(normalizedRoot, absoluteSource);

    const stats = await fs.stat(target);
    if (!stats.isFile()) {
      throw new Error('Only files can be split');
    }

    contents = await fs.readFile(target, { encoding });
    const relativeDirRaw = path.dirname(relativeFromRoot(normalizedRoot, target));
    outputDir = relativeDirRaw === '.' ? '' : relativeDirRaw;
  }

  const overwrite = options.overwrite === true;
  const preserveOriginal = options.preserveOriginal !== false;
  const mode = options.mode || 'simple';
  const created = [];

  // Strip BOM if present (PowerShell Out-File adds UTF-8 BOM)
  if (contents.charCodeAt(0) === 0xFEFF) {
    contents = contents.slice(1);
  }

  // Detect boundary format automatically if not specified
  const boundaryPattern = /^---FILE-BOUNDARY---\|(.+?)\|(\d+)\|$/m;
  const hasBoundaries = boundaryPattern.test(contents);

  if (mode === 'boundary' || hasBoundaries) {
    // Extract files using boundary markers (PowerShell format)
    const lines = contents.split(/\r?\n/);
    let currentFile = null;
    let currentContent = [];

    for (const line of lines) {
      const match = line.match(/^---FILE-BOUNDARY---\|(.+?)\|(\d+)\|$/);
      
      if (match) {
        // Save previous file if exists
        if (currentFile) {
          const filename = currentFile.name;
          const relPath = outputDir ? `${outputDir}/${filename}` : filename;
          const absoluteDest = path.resolve(normalizedRoot, relPath.split('/').join(path.sep));
          ensureWithinWorkspace(normalizedRoot, absoluteDest);

          let finalPath = absoluteDest;
          if (!overwrite && (await fs.pathExists(finalPath))) {
            // Add number suffix if file exists
            let counter = 1;
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);
            while (await fs.pathExists(finalPath)) {
              const newFilename = `${base}.${counter}${ext}`;
              const newRelPath = outputDir ? `${outputDir}/${newFilename}` : newFilename;
              finalPath = path.resolve(normalizedRoot, newRelPath.split('/').join(path.sep));
              counter++;
            }
          }

          await fs.mkdirp(path.dirname(finalPath));
          // Remove the trailing empty line that was added as separator
          // (every file has an empty line after it in the merge format)
          if (currentContent.length > 0 && currentContent[currentContent.length - 1] === '') {
            currentContent.pop();
          }
          const fileContent = currentContent.join('\n');
          await fs.writeFile(finalPath, fileContent, { encoding });
          created.push(relativeFromRoot(normalizedRoot, finalPath));
        }

        // Start new file
        currentFile = { name: match[1], index: parseInt(match[2], 10) };
        currentContent = [];
      } else if (currentFile) {
        // Skip metadata line (JSON)
        if (line.match(/^\{.*\}$/) && currentContent.length === 0) {
          continue;
        }
        currentContent.push(line);
      }
    }

    // Save last file
    if (currentFile) {
      const filename = currentFile.name;
      const relPath = outputDir ? `${outputDir}/${filename}` : filename;
      const absoluteDest = path.resolve(normalizedRoot, relPath.split('/').join(path.sep));
      ensureWithinWorkspace(normalizedRoot, absoluteDest);

      let finalPath = absoluteDest;
      if (!overwrite && (await fs.pathExists(finalPath))) {
        let counter = 1;
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        while (await fs.pathExists(finalPath)) {
          const newFilename = `${base}.${counter}${ext}`;
          const newRelPath = outputDir ? `${outputDir}/${newFilename}` : newFilename;
          finalPath = path.resolve(normalizedRoot, newRelPath.split('/').join(path.sep));
          counter++;
        }
      }

      await fs.mkdirp(path.dirname(finalPath));
      // Remove the trailing empty line that was added as separator
      if (currentContent.length > 0 && currentContent[currentContent.length - 1] === '') {
        currentContent.pop();
      }
      const fileContent = currentContent.join('\n');
      await fs.writeFile(finalPath, fileContent, { encoding });
      created.push(relativeFromRoot(normalizedRoot, finalPath));
    }
  } else {
    // Simple mode - split by separator
    const separator = ensureString(options.separator || '\n\n', 'separator');
    const prefix = options.prefix || 'part';
    const extension = options.extension || '.txt';
    const pieces = contents.split(separator);

    for (let idx = 0; idx < pieces.length; idx += 1) {
      const piece = pieces[idx];
      if (!piece.trim()) {
        continue;
      }

      const filename = `${prefix}-${String(idx + 1).padStart(2, '0')}${extension}`;
      const relPath = outputDir ? `${outputDir}/${filename}` : filename;
      const absoluteDest = path.resolve(normalizedRoot, relPath.split('/').join(path.sep));
      ensureWithinWorkspace(normalizedRoot, absoluteDest);

      if (!overwrite && (await fs.pathExists(absoluteDest))) {
        throw new Error(`Split destination already exists: ${relPath}`);
      }

      await fs.mkdirp(path.dirname(absoluteDest));
      await fs.writeFile(absoluteDest, piece.trim(), { encoding });
      created.push(relPath);
    }
  }

  // Remove original file only if it was from a file source (not clipboard)
  if (!options.clipboardContent && !preserveOriginal && source) {
    const absoluteSource = path.resolve(normalizedRoot, source);
    const { target } = ensureWithinWorkspace(normalizedRoot, absoluteSource);
    await fs.remove(target);
  }

  return { created };
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

const deleteEntries = async (rootPath, relativePaths) => {
  const normalizedRoot = normalizeRoot(rootPath);
  
  if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
    throw new Error('Provide at least one path to delete');
  }

  const deleted = [];
  const errors = [];

  for (const relativePath of relativePaths) {
    try {
      const absolutePath = path.resolve(normalizedRoot, ensureString(relativePath, 'relativePath'));
      const { target } = ensureWithinWorkspace(normalizedRoot, absolutePath);

      if (!(await fs.pathExists(target))) {
        errors.push({ path: relativePath, error: 'Path does not exist' });
        continue;
      }

      await fs.remove(target);
      deleted.push(relativeFromRoot(normalizedRoot, target));
    } catch (err) {
      errors.push({ path: relativePath, error: err.message });
    }
  }

  return { deleted, errors };
};

/**
 * Copy entries (files/folders) to a destination directory within the workspace.
 * If a name conflict occurs, a numeric suffix is appended (e.g. file (1).txt).
 */
const copyEntries = async (rootPath, relativePaths, destinationDir) => {
  const normalizedRoot = normalizeRoot(rootPath);

  if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
    throw new Error('Provide at least one path to copy');
  }

  const destDir = destinationDir || '';
  const absoluteDestDir = path.resolve(normalizedRoot, destDir);
  ensureWithinWorkspace(normalizedRoot, absoluteDestDir);
  await fs.mkdirp(absoluteDestDir);

  const copied = [];
  const errors = [];

  for (const relativePath of relativePaths) {
    try {
      const absoluteSource = path.resolve(normalizedRoot, ensureString(relativePath, 'relativePath'));
      const { target: source } = ensureWithinWorkspace(normalizedRoot, absoluteSource);

      if (!(await fs.pathExists(source))) {
        errors.push({ path: relativePath, error: 'Path does not exist' });
        continue;
      }

      const baseName = path.basename(source);
      let destPath = path.join(absoluteDestDir, baseName);
      ensureWithinWorkspace(normalizedRoot, destPath);

      // Handle name conflicts by appending a numeric suffix
      if (await fs.pathExists(destPath)) {
        const ext = path.extname(baseName);
        const nameWithoutExt = ext ? baseName.slice(0, -ext.length) : baseName;
        let counter = 1;
        while (await fs.pathExists(destPath)) {
          const newName = ext ? `${nameWithoutExt} (${counter})${ext}` : `${nameWithoutExt} (${counter})`;
          destPath = path.join(absoluteDestDir, newName);
          counter++;
        }
      }

      await fs.copy(source, destPath);
      copied.push({
        source: relativeFromRoot(normalizedRoot, source),
        destination: relativeFromRoot(normalizedRoot, destPath),
      });
    } catch (err) {
      errors.push({ path: relativePath, error: err.message });
    }
  }

  return { copied, errors };
};

/**
 * Move entries (files/folders) to a destination directory within the workspace.
 * If a name conflict occurs, a numeric suffix is appended.
 */
const moveEntries = async (rootPath, relativePaths, destinationDir) => {
  const normalizedRoot = normalizeRoot(rootPath);

  if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
    throw new Error('Provide at least one path to move');
  }

  const destDir = destinationDir || '';
  const absoluteDestDir = path.resolve(normalizedRoot, destDir);
  ensureWithinWorkspace(normalizedRoot, absoluteDestDir);
  await fs.mkdirp(absoluteDestDir);

  const moved = [];
  const errors = [];

  for (const relativePath of relativePaths) {
    try {
      const absoluteSource = path.resolve(normalizedRoot, ensureString(relativePath, 'relativePath'));
      const { target: source } = ensureWithinWorkspace(normalizedRoot, absoluteSource);

      if (!(await fs.pathExists(source))) {
        errors.push({ path: relativePath, error: 'Path does not exist' });
        continue;
      }

      const baseName = path.basename(source);
      let destPath = path.join(absoluteDestDir, baseName);
      ensureWithinWorkspace(normalizedRoot, destPath);

      // Don't move if source equals destination
      if (path.resolve(source) === path.resolve(destPath)) {
        errors.push({ path: relativePath, error: 'Source and destination are the same' });
        continue;
      }

      // Handle name conflicts
      if (await fs.pathExists(destPath)) {
        const ext = path.extname(baseName);
        const nameWithoutExt = ext ? baseName.slice(0, -ext.length) : baseName;
        let counter = 1;
        while (await fs.pathExists(destPath)) {
          const newName = ext ? `${nameWithoutExt} (${counter})${ext}` : `${nameWithoutExt} (${counter})`;
          destPath = path.join(absoluteDestDir, newName);
          counter++;
        }
      }

      await fs.move(source, destPath);
      moved.push({
        source: relativeFromRoot(normalizedRoot, source),
        destination: relativeFromRoot(normalizedRoot, destPath),
      });
    } catch (err) {
      errors.push({ path: relativePath, error: err.message });
    }
  }

  return { moved, errors };
};

/**
 * Get detailed info about a single file/folder entry.
 */
const getEntryInfo = async (rootPath, relativePath) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const absoluteTarget = path.resolve(normalizedRoot, ensureString(relativePath, 'relativePath'));
  const { target } = ensureWithinWorkspace(normalizedRoot, absoluteTarget);

  const stats = await fs.stat(target);
  const isDir = stats.isDirectory();

  let childCount = undefined;
  if (isDir) {
    const dirents = await fs.readdir(target);
    childCount = dirents.length;
  }

  return {
    path: relativeFromRoot(normalizedRoot, target),
    name: path.basename(target),
    type: isDir ? 'directory' : 'file',
    size: isDir ? null : stats.size,
    modifiedAt: stats.mtime.toISOString(),
    createdAt: stats.birthtime.toISOString(),
    childCount,
  };
};

/**
 * Import external files/folders (from outside the workspace) into the workspace.
 * @param {string} rootPath – workspace root
 * @param {string} destinationDir – relative destination directory inside workspace ('' for root)
 * @param {string[]} externalPaths – absolute paths on disk to import
 * @param {{ move?: boolean }} [options] – when `move` is true the originals are removed after import (cut-paste)
 * @returns {{ imported: Array<{ source: string; destination: string }>, errors: Array<{ path: string; error: string }> }}
 */
const importExternalFiles = async (rootPath, destinationDir, externalPaths, options = {}) => {
  const normalizedRoot = path.resolve(rootPath);
  const destDir = path.resolve(normalizedRoot, destinationDir || '');
  // Ensure destination is within workspace
  ensureWithinWorkspace(normalizedRoot, destDir);
  await fs.ensureDir(destDir);

  const useMove = Boolean(options.move);
  const imported = [];
  const errors = [];

  for (const extPath of externalPaths) {
    try {
      const resolvedExt = path.resolve(extPath);
      const baseName = path.basename(resolvedExt);

      // Auto-number if name conflict
      let destName = baseName;
      let counter = 1;
      const extPart = path.extname(baseName);
      const namePart = baseName.slice(0, baseName.length - extPart.length);
      while (await fs.pathExists(path.join(destDir, destName))) {
        destName = `${namePart} (${counter})${extPart}`;
        counter++;
      }

      const finalDest = path.join(destDir, destName);

      if (useMove) {
        await fs.move(resolvedExt, finalDest, { overwrite: false });
      } else {
        await fs.copy(resolvedExt, finalDest, { overwrite: false });
      }

      imported.push({
        source: resolvedExt,
        destination: relativeFromRoot(normalizedRoot, finalDest),
      });
    } catch (err) {
      errors.push({ path: extPath, error: String(err) });
    }
  }

  return { imported, errors };
};

// ─── Archive & Extract ─────────────────────────────────────────────────────

const archiver = require('archiver');
const extractZip = require('extract-zip');
const { execFile } = require('child_process');

const ARCHIVE_EXTENSIONS = ['.zip', '.7z', '.rar'];

/**
 * Detect if 7z.exe is available on the system.
 * Checks PATH first, then common Windows install locations.
 * @returns {string|null} absolute path to 7z executable or null
 */
const find7zExecutable = () => {
  const common7zPaths = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', '7-Zip', '7z.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', '7-Zip', '7z.exe'),
  ];

  for (const candidate of common7zPaths) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch { /* not found */ }
  }

  // Fall back to PATH
  try {
    const { execFileSync } = require('child_process');
    execFileSync('7z', ['--help'], { stdio: 'ignore', timeout: 3000 });
    return '7z';
  } catch { /* not in PATH */ }

  return null;
};

/**
 * Check if a file extension is a supported archive format.
 */
const isArchiveFile = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return ARCHIVE_EXTENSIONS.includes(ext);
};

/**
 * Create a ZIP archive from one or more files/folders within the workspace.
 * @param {string} rootPath  workspace root
 * @param {string[]} relativePaths  entries to archive (relative to root)
 * @param {string} archiveName  output archive name (relative to the parent of the first entry)
 * @returns {{ archivePath: string }} relative path to the created archive
 */
const archiveEntries = async (rootPath, relativePaths, archiveName) => {
  const normalizedRoot = normalizeRoot(rootPath);

  if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
    throw new Error('Provide at least one path to archive');
  }

  // Sanitize archive name
  const safeName = ensureString(archiveName, 'archiveName').replace(/[<>:"|?*]/g, '_');
  const finalName = safeName.endsWith('.zip') ? safeName : `${safeName}.zip`;

  // Determine output directory (same directory as the first entry)
  const firstEntry = ensureString(relativePaths[0], 'relativePaths[0]');
  const parentDir = firstEntry.includes('/')
    ? firstEntry.substring(0, firstEntry.lastIndexOf('/'))
    : '';
  const archiveRelPath = parentDir ? `${parentDir}/${finalName}` : finalName;
  const absoluteArchive = path.resolve(normalizedRoot, archiveRelPath.split('/').join(path.sep));
  ensureWithinWorkspace(normalizedRoot, absoluteArchive);

  // Avoid overwriting — append numeric suffix if exists
  let outputPath = absoluteArchive;
  if (await fs.pathExists(outputPath)) {
    const ext = path.extname(finalName);
    const base = path.basename(finalName, ext);
    let counter = 1;
    while (await fs.pathExists(outputPath)) {
      const numbered = `${base} (${counter})${ext}`;
      const numberedRel = parentDir ? `${parentDir}/${numbered}` : numbered;
      outputPath = path.resolve(normalizedRoot, numberedRel.split('/').join(path.sep));
      counter++;
    }
  }

  // Verify all source entries exist
  const resolvedSources = [];
  for (const rp of relativePaths) {
    const abs = path.resolve(normalizedRoot, ensureString(rp, 'relativePath'));
    const { target } = ensureWithinWorkspace(normalizedRoot, abs);
    if (!(await fs.pathExists(target))) {
      throw new Error(`Source path does not exist: ${rp}`);
    }
    resolvedSources.push({ absolute: target, relative: rp });
  }

  await fs.mkdirp(path.dirname(outputPath));

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => {
      resolve({ archivePath: relativeFromRoot(normalizedRoot, outputPath) });
    });

    archive.on('error', (err) => {
      reject(new Error(`Archive creation failed: ${err.message}`));
    });

    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') {
        reject(new Error(`Archive warning: ${err.message}`));
      }
    });

    archive.pipe(output);

    for (const src of resolvedSources) {
      const stats = fs.statSync(src.absolute);
      if (stats.isDirectory()) {
        archive.directory(src.absolute, path.basename(src.absolute));
      } else {
        archive.file(src.absolute, { name: path.basename(src.absolute) });
      }
    }

    archive.finalize();
  });
};

/**
 * Extract an archive (.zip, .7z, .rar) into the workspace.
 * ZIP uses extract-zip; 7z/RAR delegate to the system 7z executable.
 * @param {string} rootPath  workspace root
 * @param {string} archiveRelPath  relative path to the archive file
 * @param {string} [destinationDir]  relative destination dir (defaults to archive's parent + archive base name)
 * @returns {{ extractedTo: string }} relative path to the extraction directory
 */
const extractArchive = async (rootPath, archiveRelPath, destinationDir) => {
  const normalizedRoot = normalizeRoot(rootPath);
  const absoluteArchive = path.resolve(normalizedRoot, ensureString(archiveRelPath, 'archiveRelPath'));
  const { target: archiveTarget } = ensureWithinWorkspace(normalizedRoot, absoluteArchive);

  if (!(await fs.pathExists(archiveTarget))) {
    throw new Error('Archive file does not exist');
  }

  const stats = await fs.stat(archiveTarget);
  if (!stats.isFile()) {
    throw new Error('Target is not a file');
  }

  const ext = path.extname(archiveTarget).toLowerCase();
  if (!ARCHIVE_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported archive format: ${ext}. Supported: ${ARCHIVE_EXTENSIONS.join(', ')}`);
  }

  // Determine extraction directory
  let extractDir;
  if (destinationDir) {
    extractDir = path.resolve(normalizedRoot, destinationDir.split('/').join(path.sep));
  } else {
    // Default: create a folder named after the archive (without extension) in the same directory
    const archiveBaseName = path.basename(archiveTarget, ext);
    extractDir = path.join(path.dirname(archiveTarget), archiveBaseName);
  }
  ensureWithinWorkspace(normalizedRoot, extractDir);

  // Avoid overwriting existing directory
  let finalExtractDir = extractDir;
  if (await fs.pathExists(finalExtractDir)) {
    let counter = 1;
    while (await fs.pathExists(finalExtractDir)) {
      finalExtractDir = `${extractDir} (${counter})`;
      counter++;
    }
  }

  await fs.mkdirp(finalExtractDir);

  if (ext === '.zip') {
    await extractZip(archiveTarget, { dir: finalExtractDir });
  } else {
    // Use 7z for .7z and .rar
    const sevenZipPath = find7zExecutable();
    if (!sevenZipPath) {
      throw new Error(
        'Cannot extract ' + ext + ' files: 7-Zip is not installed. ' +
        'Please install 7-Zip from https://www.7-zip.org and try again.'
      );
    }

    await new Promise((resolve, reject) => {
      // 7z x <archive> -o<outputDir> -y
      const args = ['x', archiveTarget, `-o${finalExtractDir}`, '-y'];
      execFile(sevenZipPath, args, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`7z extraction failed: ${stderr || error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  return { extractedTo: relativeFromRoot(normalizedRoot, finalExtractDir) };
};

module.exports = {
  listDirectory,
  readTextFile,
  readBinaryFile,
  getFileUrl,
  mergeTextFiles,
  splitTextFile,
  createDirectory,
  writeTextFile,
  renameEntry,
  deleteEntries,
  copyEntries,
  moveEntries,
  getEntryInfo,
  importExternalFiles,
  archiveEntries,
  extractArchive,
  isArchiveFile,
  ARCHIVE_EXTENSIONS,
};
