const path = require('path');
const fs = require('fs-extra');
const extract = require('extract-zip');
const archiver = require('archiver');

async function importZipToFolder(zipPath, destFolder) {
  await fs.mkdirp(destFolder);
  try {
    await extract(zipPath, { dir: destFolder });
    // look for manifest.json
    const manifestPath = path.join(destFolder, 'manifest.json');
    const manifestExists = await fs.pathExists(manifestPath);
    return { ok: true, manifestPath: manifestExists ? manifestPath : null };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function exportFolderToZip(folderPath, zipOutPath) {
  await fs.mkdirp(path.dirname(zipOutPath));
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipOutPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve({ ok: true, zipPath: zipOutPath }));
    archive.on('error', (err) => reject({ ok: false, error: String(err) }));

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();
  });
}

module.exports = { importZipToFolder, exportFolderToZip };
