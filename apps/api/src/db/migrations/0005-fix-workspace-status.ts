import type { Database } from 'sqlite';

export const id = '0005-fix-workspace-status';

export const up = async (db: Database) => {
  // Update all existing 'offline' workspaces to 'healthy' since offline was incorrectly set as default
  await db.exec(`
    UPDATE workspaces 
    SET status = 'healthy' 
    WHERE status = 'offline';
  `);
};
