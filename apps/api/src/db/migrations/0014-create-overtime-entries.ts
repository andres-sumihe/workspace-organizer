import type Database from 'better-sqlite3';

export const id = '0014-create-overtime-entries';

export const up = async (db: Database.Database) => {
  db.exec(`
    -- Overtime entries table (local/private data)
    CREATE TABLE IF NOT EXISTS overtime_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,  -- YYYY-MM-DD format
      day_type TEXT NOT NULL CHECK (day_type IN ('workday', 'holiday_weekend')),
      total_hours REAL NOT NULL CHECK (total_hours > 0),
      pay_amount REAL NOT NULL,  -- Calculated, rounded to 2 decimals
      base_salary REAL NOT NULL CHECK (base_salary > 0),  -- Effective salary used for calculation
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- Index for date range queries
    CREATE INDEX IF NOT EXISTS idx_overtime_entries_date ON overtime_entries(date);

    -- Trigger to auto-update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS trg_overtime_entries_set_updated_at
    AFTER UPDATE ON overtime_entries
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE overtime_entries SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);
};



