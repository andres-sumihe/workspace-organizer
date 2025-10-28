import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { open, type Database } from 'sqlite';
import sqlite3 from 'sqlite3';

import { runMigrations } from './migrations/index.js';

let dbPromise: Promise<Database> | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const databasePath = path.join(dataDir, 'workspace-organizer.sqlite');

const ensureDataDirectory = async () => {
  await fs.mkdir(dataDir, { recursive: true });
};

const createConnection = async () => {
  await ensureDataDirectory();

  const db = await open({
    filename: databasePath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON');
  await runMigrations(db);

  return db;
};

export const getDb = async () => {
  dbPromise ??= createConnection();

  return dbPromise;
};

export const closeDb = async () => {
  if (!dbPromise) {
    return;
  }

  const db = await dbPromise;
  await db.close();
  dbPromise = null;
};

export type AppDatabase = Database;
