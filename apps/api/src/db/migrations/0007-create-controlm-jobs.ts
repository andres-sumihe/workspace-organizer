import type { Database } from 'sqlite';

export const id = '0007-create-controlm-jobs';

export const up = async (db: Database) => {
  await db.exec(`PRAGMA foreign_keys = ON;`);

  // Control-M Jobs table - core metadata for batch jobs from Control-M
  await db.exec(`
    CREATE TABLE IF NOT EXISTS controlm_jobs (
      id TEXT PRIMARY KEY,
      job_id INTEGER NOT NULL,
      application TEXT NOT NULL,
      group_name TEXT NOT NULL,
      mem_name TEXT,
      job_name TEXT NOT NULL,
      description TEXT,
      node_id TEXT NOT NULL,
      owner TEXT,
      task_type TEXT NOT NULL DEFAULT 'Job',
      is_cyclic INTEGER NOT NULL DEFAULT 0,
      priority TEXT,
      is_critical INTEGER NOT NULL DEFAULT 0,
      days_calendar TEXT,
      weeks_calendar TEXT,
      from_time TEXT,
      to_time TEXT,
      interval_value TEXT,
      mem_lib TEXT,
      author TEXT,
      creation_user TEXT,
      creation_date TEXT,
      change_user_id TEXT,
      change_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      linked_script_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (linked_script_id) REFERENCES scripts(id) ON DELETE SET NULL
    )
  `);

  // Control-M Job Dependencies table - predecessor/successor relationships
  await db.exec(`
    CREATE TABLE IF NOT EXISTS controlm_job_dependencies (
      id TEXT PRIMARY KEY,
      predecessor_job_id TEXT NOT NULL,
      successor_job_id TEXT NOT NULL,
      condition_type TEXT NOT NULL DEFAULT 'OC',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (predecessor_job_id) REFERENCES controlm_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (successor_job_id) REFERENCES controlm_jobs(id) ON DELETE CASCADE,
      UNIQUE(predecessor_job_id, successor_job_id)
    )
  `);

  // Control-M Job Conditions table - IN/OUT conditions for job flow
  await db.exec(`
    CREATE TABLE IF NOT EXISTS controlm_job_conditions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      condition_name TEXT NOT NULL,
      condition_type TEXT NOT NULL,
      odate TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (job_id) REFERENCES controlm_jobs(id) ON DELETE CASCADE
    )
  `);

  // Triggers to keep updated_at current
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_controlm_jobs_set_updated_at
    AFTER UPDATE ON controlm_jobs
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE controlm_jobs SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);

  // Indexes for efficient queries
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_jobs_job_id ON controlm_jobs(job_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_jobs_job_name ON controlm_jobs(job_name);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_jobs_application ON controlm_jobs(application);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_jobs_node_id ON controlm_jobs(node_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_jobs_task_type ON controlm_jobs(task_type);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_jobs_is_active ON controlm_jobs(is_active);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_jobs_linked_script ON controlm_jobs(linked_script_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_job_deps_predecessor ON controlm_job_dependencies(predecessor_job_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_job_deps_successor ON controlm_job_dependencies(successor_job_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_controlm_job_conditions_job ON controlm_job_conditions(job_id);`);

  // Unique constraint for job_id + application to prevent duplicates
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_controlm_jobs_unique ON controlm_jobs(job_id, application);`);
};
