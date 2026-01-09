import { Pool } from 'pg';

import { SHARED_SCHEMA, getSearchPath } from './shared-schema.js';
import { settingsRepository } from '../repositories/settings.repository.js';
import { dbLogger } from '../utils/logger.js';

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
 * All connections use `search_path = workspace_organizer, public` so that
 * unqualified table names resolve into the shared schema.
 */

let pool: Pool | null = null;
let connectionString: string | null = null;

// Re-export schema utilities for convenience
export { SHARED_SCHEMA, getSearchPath } from './shared-schema.js';

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
  try {
    const setting = await settingsRepository.get<string | null>('shared_db_connection');
    return setting?.value ?? null;
  } catch (error) {
    dbLogger.error({ err: error }, 'Error getting connection string');
    return null;
  }
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
 * Sets search_path to the shared schema on every connection.
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

  // Build pool with search_path set on every connection
  const searchPath = getSearchPath();
  
  // Append options to connection string to force ISO datestyle and search_path
  let finalConnString = connString;
  if (!finalConnString.includes('options=')) {
     const separator = finalConnString.includes('?') ? '&' : '?';
     // URL encode the search path (comma and space)
     // Remove space to avoid issues with connection string parsing
     const safeSearchPath = searchPath.replace(/\s/g, '');
     finalConnString += `${separator}options=-c%20search_path=${safeSearchPath}%20-c%20datestyle=ISO`;
  }

  pool = new Pool({
    connectionString: finalConnString,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000 // Timeout for acquiring a connection
  });

  // Verify connection works and schema can be created/accessed
  const client = await pool.connect();
  try {
    // Ensure schema exists (idempotent)
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SHARED_SCHEMA}`);
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

/**
 * Ensure the shared database connection is ready.
 * Attempts to initialize using the stored connection string when needed.
 * @returns true when the pool is ready, false otherwise
 */
export const ensureSharedDbConnection = async (): Promise<boolean> => {
  if (isSharedDbConnected()) {
    return true;
  }

  try {
    await initializeSharedDb();
    return true;
  } catch (error) {
    dbLogger.error({ err: error }, 'Failed to initialize shared database connection');
    return false;
  }
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
