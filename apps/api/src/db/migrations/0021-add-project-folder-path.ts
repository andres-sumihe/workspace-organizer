import type Database from 'better-sqlite3';

export const id = '0021-add-project-folder-path';

export const up = async (db: Database.Database) => {
  db.exec(`
    ALTER TABLE personal_projects ADD COLUMN folder_path TEXT;
  `);
};

export const down = async (db: Database.Database) => {
  db.exec(`
    ALTER TABLE personal_projects DROP COLUMN folder_path;
  `);
};
