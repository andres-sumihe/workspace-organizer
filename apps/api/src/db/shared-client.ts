import { Pool } from 'pg';

import { settingsRepository } from '../repositories/settings.repository.js';

import type { PoolClient } from 'pg';


/**
 * Shared PostgreSQL database client for team-accessible data.
 *
 * This client connects to a PostgreSQL v15 database for shared features:
 * - Scripts
 * - Control-M Jobs
 * - Users/Authentication
 * - RBAC (Roles/Permissions)
 * - Audit Logs
 *
 * Connection string is stored in local SQLite settings table.
 */

let pool: Pool | null = null;
let connectionString: string | null = null;

export interface SharedDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

/**
 * Parse connection string to config object
 */
export const parseConnectionString = (connStr: string): SharedDbConfig => {
  const url = new URL(connStr);
  return {
    host: url.hostname,
    port: parseInt(url.port, 10) || 5432,
    database: url.pathname.slice(1), // Remove leading /
    user: url.username,
    password: url.password,
    ssl: url.searchParams.get('ssl') === 'true'
  };
};

/**
 * Build connection string from config object
 */
export const buildConnectionString = (config: SharedDbConfig): string => {
  const url = new URL(`postgresql://${config.host}`);
  url.port = String(config.port);
  url.pathname = `/${config.database}`;
  url.username = config.user;
  url.password = config.password;
  if (config.ssl) {
    url.searchParams.set('ssl', 'true');
  }
  return url.toString();
};

/**
 * Get the connection string from local settings
 */
export const getSharedDbConnectionString = async (): Promise<string | null> => {
  const setting = await settingsRepository.get<string | null>('shared_db_connection');
  return setting?.value ?? null;
};

/**
 * Test a PostgreSQL connection string
 * @returns true if connection succeeds, throws error otherwise
 */
export const testConnection = async (connStr: string): Promise<boolean> => {
  const testPool = new Pool({
    connectionString: connStr,
    max: 1,
    connectionTimeoutMillis: 5000
  });

  try {
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } finally {
    await testPool.end();
  }
};

/**
 * Initialize the shared database connection pool
 */
export const initializeSharedDb = async (connStr?: string): Promise<void> => {
  if (pool) {
    await pool.end();
  }

  const connString = connStr ?? (await getSharedDbConnectionString());

  if (!connString) {
    throw new Error('Shared database connection string not configured');
  }

  connectionString = connString;
  pool = new Pool({
    connectionString: connString,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000 // Timeout for acquiring a connection
  });

  // Verify connection works
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
};

/**
 * Get the shared database pool
 * @throws Error if not initialized
 */
export const getSharedPool = (): Pool => {
  if (!pool) {
    throw new Error('Shared database not initialized. Call initializeSharedDb() first.');
  }
  return pool;
};

/**
 * Check if shared database is initialized and connected
 */
export const isSharedDbConnected = (): boolean => {
  return pool !== null;
};

/**
 * Get a client from the pool for transaction support
 */
export const getSharedClient = async (): Promise<PoolClient> => {
  const p = getSharedPool();
  return p.connect();
};

/**
 * Execute a query on the shared database
 */
export const query = async <T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> => {
  const p = getSharedPool();
  const result = await p.query(text, params);
  return result.rows as T[];
};

/**
 * Execute a query and return a single row
 */
export const queryOne = async <T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T | null> => {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
};

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 * @returns Number of affected rows
 */
export const execute = async (text: string, params?: unknown[]): Promise<number> => {
  const p = getSharedPool();
  const result = await p.query(text, params);
  return result.rowCount ?? 0;
};

/**
 * Close the shared database connection pool
 */
export const closeSharedDb = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    connectionString = null;
  }
};

/**
 * Get current connection string (for display purposes - mask password)
 */
export const getMaskedConnectionString = (): string | null => {
  if (!connectionString) return null;
  try {
    const url = new URL(connectionString);
    url.password = '****';
    return url.toString();
  } catch {
    return connectionString.replace(/:[^:@]+@/, ':****@');
  }
};
