
import { getSharedClient, initializeSharedDb, getSharedDbConnectionString } from '../apps/api/src/db/shared-client.js';

async function checkTableDef() {
  try {
    const connStr = await getSharedDbConnectionString();
    if (!connStr) return;
    await initializeSharedDb(connStr);
    const client = await getSharedClient();
    
    const result = await client.query(`
      SELECT column_name, is_nullable, column_default, data_type
      FROM information_schema.columns
      WHERE table_name = 'scripts' AND table_schema = 'workspace_organizer'
    `);
    
    console.table(result.rows);
    client.release();
  } catch (error) {
    console.error(error);
  }
}

checkTableDef();
