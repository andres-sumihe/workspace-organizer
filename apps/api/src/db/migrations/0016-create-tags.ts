import type Database from 'better-sqlite3';

export const id = '0016-create-tags';

export const up = async (db: Database.Database) => {
  db.exec(`
    -- Global tags table (reusable across features)
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- Index for tag name lookup
    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

    -- Trigger to auto-update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS trg_tags_set_updated_at
    AFTER UPDATE ON tags
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE tags SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;

    -- Polymorphic taggings table: tag can be attached to many entity types
    CREATE TABLE IF NOT EXISTS taggings (
      id TEXT PRIMARY KEY,
      tag_id TEXT NOT NULL,
      taggable_type TEXT NOT NULL,
      taggable_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(tag_id, taggable_type, taggable_id)
    );

    -- Index for looking up tags by entity
    CREATE INDEX IF NOT EXISTS idx_taggings_taggable ON taggings(taggable_type, taggable_id);

    -- Index for looking up entities by tag
    CREATE INDEX IF NOT EXISTS idx_taggings_tag_id ON taggings(tag_id);
  `);
};
