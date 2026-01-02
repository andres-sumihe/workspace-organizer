import * as migration0001 from './0001-create-workspaces.js';
import * as migration0002 from './0002-add-project-relative-path.js';
import * as migration0003 from './0003-create-scripts.js';
import * as migration0004 from './0004-create-templates.js';
import * as migration0005 from './0005-fix-workspace-status.js';
import * as migration0006 from './0006-create-settings.js';
import * as migration0007 from './0007-create-controlm-jobs.js';
import * as migration0008 from './0008-fix-controlm-jobs-unique.js';
import * as migration0009 from './0009-remove-shared-feature-tables.js';
import * as migration0010 from './0010-create-shared-config.js';
import * as migration0011 from './0011-create-local-users.js';
import * as migration0012 from './0012-create-local-sessions.js';
import * as migration0013 from './0013-add-session-metadata-columns.js';
import * as migration0014 from './0014-create-overtime-entries.js';
import * as migration0015 from './0015-add-overtime-time-columns.js';

import type Database from 'better-sqlite3';

interface Migration {
  id: string;
  up: (db: Database.Database) => Promise<void>;
}

const migrations: Migration[] = [
  { id: migration0001.id, up: migration0001.up },
  { id: migration0002.id, up: migration0002.up },
  { id: migration0003.id, up: migration0003.up },
  { id: migration0004.id, up: migration0004.up },
  { id: migration0005.id, up: migration0005.up },
  { id: migration0006.id, up: migration0006.up },
  { id: migration0007.id, up: migration0007.up },
  { id: migration0008.id, up: migration0008.up },
  { id: migration0009.id, up: migration0009.up },
  { id: migration0010.id, up: migration0010.up },
  { id: migration0011.id, up: migration0011.up },
  { id: migration0012.id, up: migration0012.up },
  { id: migration0013.id, up: migration0013.up },
  { id: migration0014.id, up: migration0014.up },
  { id: migration0015.id, up: migration0015.up }
];

export const runMigrations = async (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL
    )
  `);

  const executedRowsRaw = db.prepare('SELECT id FROM migrations').all();
  const executedIds = new Set<string>();

  if (Array.isArray(executedRowsRaw)) {
    for (const row of executedRowsRaw) {
      if (row && typeof (row as { id?: unknown }).id === 'string') {
        executedIds.add((row as { id: string }).id);
      }
    }
  }

  for (const migration of migrations) {
    if (executedIds.has(migration.id)) {
      continue;
    }

    try {
      await migration.up(db);
      db.prepare('INSERT INTO migrations (id, executed_at) VALUES (?, ?)').run(
        migration.id,
        new Date().toISOString()
      );
    } catch (error) {
      throw error;
    }
  }
};
