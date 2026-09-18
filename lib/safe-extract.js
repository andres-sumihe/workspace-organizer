const extractZip = require('extract-zip');

// extract-zip follows symlink entries outside the target dir (CVE-2026-19693); refusing them closes that path
const rejectSymlinkEntries = (entry) => {
  const mode = (entry.externalFileAttributes >> 16) & 0xffff;
  if ((mode & 0o170000) === 0o120000) {
    throw new Error(`Refusing to extract symlink entry: ${entry.fileName}`);
  }
};

const extractZipSafe = (zipPath, dir) => extractZip(zipPath, { dir, onEntry: rejectSymlinkEntries });

module.exports = { extractZipSafe };
