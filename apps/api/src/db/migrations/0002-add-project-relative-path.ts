import type { Database } from 'sqlite';

export const id = '0002-add-project-relative-path';

export const up = async (db: Database) => {
  await db.exec(`
    ALTER TABLE projects
    ADD COLUMN relative_path TEXT NOT NULL DEFAULT ''
  `);

  await db.exec(`
    UPDATE projects
    SET relative_path = ''
    WHERE relative_path IS NULL
  `);
};
