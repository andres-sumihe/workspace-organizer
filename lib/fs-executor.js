const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

/**
 * Transactional apply algorithm (simplified):
 * 1. Compute staging dir: workspace/.workspace-organizer/tmp/<opid>/
 * 2. Write all new files into staging preserving relative paths.
 * 3. Move originals to history/<opid>/original/ for backup.
 * 4. Atomically move staging files into place (fs.move)
 * 5. On failure, attempt to restore from history backups.
 */

async function applyDryRunOpsTransactional(ops, workspaceRoot, options = {}) {
  const opId = `op-${Date.now()}-${randomUUID()}`;
  const stagingRoot = path.join(workspaceRoot, '.workspace-organizer', 'tmp', opId);
  const historyRoot = path.join(workspaceRoot, '.workspace-organizer', 'history', opId, 'original');

  const results = [];

  try {
    // 1) prepare staging
    await fs.mkdirp(stagingRoot);
    await fs.mkdirp(historyRoot);

    // 2) write staging
    for (const op of ops) {
      if (op.type === 'mkdir') {
        const dest = path.join(stagingRoot, path.relative(workspaceRoot, op.path));
        await fs.mkdirp(dest);
        results.push({ op, stagePath: dest });
      } else if (op.type === 'write') {
        const rel = path.relative(workspaceRoot, op.path);
        const dest = path.join(stagingRoot, rel);
        await fs.mkdirp(path.dirname(dest));
        if (op.binary) {
          // If binary content provided as buffer
          const data = op.content || Buffer.from([]);
          await fs.writeFile(dest, data);
        } else {
          await fs.writeFile(dest, op.content || '', 'utf8');
        }
        results.push({ op, stagePath: dest });
      }
    }

    // 3) backup originals
    for (const r of results) {
      const target = r.op.path;
      const exists = await fs.pathExists(target);
      if (exists) {
        const rel = path.relative(workspaceRoot, target);
        const backupDest = path.join(historyRoot, rel);
        await fs.mkdirp(path.dirname(backupDest));
        await fs.move(target, backupDest, { overwrite: true });
        r.backupPath = backupDest;
      }
    }

    // 4) move staging into place
    // Important: move children (files) before parents (directories) to avoid
    // removing a parent directory before its children are moved.
    // Move files first (write ops) then ensure directories exist for mkdir ops.
    const writeResults = results.filter((r) => r.op.type === 'write');
    const dirResults = results.filter((r) => r.op.type === 'mkdir');

    // Move each file from staging to final location
    for (const r of writeResults) {
      const rel = path.relative(stagingRoot, r.stagePath);
      const finalDest = path.join(workspaceRoot, rel);
      await fs.mkdirp(path.dirname(finalDest));
      await fs.move(r.stagePath, finalDest, { overwrite: true });
      r.finalPath = finalDest;
      r.ok = true;
    }

    // Ensure directories exist (don't move directories; their contents were moved above)
    for (const r of dirResults) {
      const rel = path.relative(stagingRoot, r.stagePath);
      const finalDest = path.join(workspaceRoot, rel);
      await fs.mkdirp(finalDest);
      r.finalPath = finalDest;
      r.ok = true;
    }

    // 5) cleanup staging (if any remains)
    await fs.remove(stagingRoot);

    return { ok: true, opId, results };
  } catch (err) {
    // Attempt rollback
    try {
      // restore backups
      if (await fs.pathExists(historyRoot)) {
        const items = await fs.readdir(historyRoot);
        // move each item back (recursive)
        await fs.copy(historyRoot, workspaceRoot, { overwrite: true });
      }
    } catch (restoreErr) {
      // swallow restore errors but include in result
      return { ok: false, error: String(err), restoreError: String(restoreErr) };
    }

    return { ok: false, error: String(err) };
  }
}

module.exports = { applyDryRunOpsTransactional };
