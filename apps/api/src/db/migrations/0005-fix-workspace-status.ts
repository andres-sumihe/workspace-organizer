import type Database from 'better-sqlite3';

export const id = '0005-fix-workspace-status';

export const up = async (db: Database.Database) => {
  // Update all existing 'offline' workspaces to 'healthy' since offline was incorrectly set as default
  db.exec(`
    UPDATE workspaces 
    SET status = 'healthy' 
    WHERE status = 'offline';
  `);
};



