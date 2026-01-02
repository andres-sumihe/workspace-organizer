import type Database from 'better-sqlite3';

export const id = '0006-create-settings';

export const up = async (db: Database.Database) => {
  db.exec(`
    -- Application settings table (key-value store with JSON values)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL DEFAULT '{}',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- Trigger to auto-update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS trg_settings_set_updated_at
    AFTER UPDATE ON settings
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE settings SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE key = OLD.key;
    END;

    -- Insert default validation settings
    INSERT OR IGNORE INTO settings (key, value_json, description) VALUES 
      ('validation.iso20022', '{"senderDN":"ou=xxx,o=cenaidja,o=swift","senderFullName":"CENAIDJAXXX","receiverDN":"ou=xxx,o=cenaidja,o=swift","receiverFullName":"CENAIDJAXXX"}', 'ISO20022 (MX) validation criteria'),
      ('validation.iso20022.enabled', 'true', 'Whether ISO20022 validation is enabled'),
      ('validation.swiftMT', '{"senderBIC":"","receiverBIC":"","validateFormat":false,"expectedFormat":null}', 'SWIFT MT (ISO15022) validation criteria'),
      ('validation.swiftMT.enabled', 'false', 'Whether SWIFT MT validation is enabled');
  `);
};



