import * as migration0001 from './0001-create-workspaces.js';
import * as migration0002 from './0002-add-project-relative-path.js';
import * as migration0003 from './0003-create-scripts.js';
import * as migration0004 from './0004-create-templates.js';
import * as migration0005 from './0005-fix-workspace-status.js';

import type { Database } from 'sqlite';

interface Migration {
  id: string;
  up: (db: Database) => Promise<void>;
}

const migrations: Migration[] = [
  { id: migration0001.id, up: migration0001.up },
  { id: migration0002.id, up: migration0002.up },
  { id: migration0003.id, up: migration0003.up },
  { id: migration0004.id, up: migration0004.up },
  { id: migration0005.id, up: migration0005.up }
];

export const runMigrations = async (db: Database) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL
    )
  `);

  const executedRowsRaw = await db.all('SELECT id FROM migrations');
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

    await db.exec('BEGIN');
    try {
      await migration.up(db);
      await db.run('INSERT INTO migrations (id, executed_at) VALUES (?, ?)', [
        migration.id,
        new Date().toISOString()
      ]);
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }
};
