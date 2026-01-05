import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { runMigrations } from './migrations/index.js';

let db: Database.Database | null = null;

// __dirname compatibility for both ESM (dev) and CJS (bundled)
// In CJS bundle, import.meta.url may be undefined, but __dirname will exist
const getCurrentDir = (): string => {
  // Check if we're in CJS mode (bundled) - __dirname exists
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  // ESM mode - use import.meta.url
  return path.dirname(fileURLToPath(import.meta.url));
};
const __current_dir = getCurrentDir();

// Data directory resolution - lazy evaluated to pick up env vars set at runtime
// Priority:
// 1. ELECTRON_USER_DATA_PATH env var (set by Electron main process for production)
// 2. Local data folder (development)
const getDataDir = (): string => {
  // In production Electron, main process sets this to app.getPath('userData')
  if (process.env.ELECTRON_USER_DATA_PATH) {
    return path.join(process.env.ELECTRON_USER_DATA_PATH, 'database');
  }

  // Development fallback to local data directory
  return path.resolve(__current_dir, '../../data');
};

const getDatabasePath = (): string => {
  if (process.env.NODE_ENV === 'test') {
    return ':memory:';
  }
  return path.join(getDataDir(), 'workspace-organizer.sqlite');
};

const ensureDataDirectory = async () => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const dataDir = getDataDir();
  console.log(`[DB] Ensuring data directory exists: ${dataDir}`);
  await fs.mkdir(dataDir, { recursive: true });
};

const createConnection = async (): Promise<Database.Database> => {
  await ensureDataDirectory();

  const dbPath = getDatabasePath();
  console.log(`[DB] Opening database at: ${dbPath}`);
  
  const database = new Database(dbPath);
  database.pragma('foreign_keys = ON');
  
  await runMigrations(database);

  return database;
};

export const getDb = async (): Promise<Database.Database> => {
  if (!db) {
    db = await createConnection();
  }
  return db;
};

export const closeDb = async () => {
  if (db) {
    db.close();
    db = null;
  }
};

export type AppDatabase = Database.Database;
