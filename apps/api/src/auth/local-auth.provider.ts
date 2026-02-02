import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { getDb } from '../db/client.js';
import { settingsRepository } from '../repositories/settings.repository.js';
import { modeService } from '../services/mode.service.js';
import { sessionService } from '../services/session.service.js';

import type { LoginRequest, LoginResponse, LocalUser, CreateAccountRequest, LoginContext, CreateAccountResponse } from '@workspace/shared';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY_SHORT = '15m'; // When session lock enabled
const ACCESS_TOKEN_EXPIRY_LONG = '365d'; // When session lock disabled (1 year)
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_DAYS_LONG = 365; // When session lock disabled
const RECOVERY_KEY_LENGTH = 32; // 256 bits

interface LocalUserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  is_active: number;
  recovery_key_hash: string | null;
  created_at: string;
  updated_at: string;
}

interface LocalSessionRow {
  id: string;
  user_id: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  last_activity_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

const isLocalUserRow = (value: unknown): value is LocalUserRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.password_hash === 'string'
  );
};

const isLocalSessionRow = (value: unknown): value is LocalSessionRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.user_id === 'string' &&
    typeof candidate.refresh_token === 'string' &&
    typeof candidate.expires_at === 'string'
  );
};

const mapRowToLocalUser = (row: LocalUserRow): LocalUser => ({
  id: row.id,
  username: row.username,
  email: row.email,
  displayName: row.display_name ?? undefined,
  isActive: row.is_active === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

/**
 * Get or generate JWT secret for local authentication
 */
const getJwtSecret = async (): Promise<string> => {
  const setting = await settingsRepository.get<string>('jwt_secret');
  if (setting?.value) {
    return setting.value;
  }
  
  // Generate cryptographically secure secret (256 bits = 32 bytes = 64 hex chars)
  const secret = randomBytes(32).toString('hex');
  await settingsRepository.set('jwt_secret', secret, 'JWT secret for local authentication');
  return secret;
};

export const localAuthProvider = {
  /**
   * Generate a cryptographically secure recovery key (hex format)
   */
  generateRecoveryKey(): string {
    return randomBytes(RECOVERY_KEY_LENGTH).toString('hex');
  },

  /**
   * Create a new local user (Solo mode)
   * SECURITY: Only one user is allowed per device
   * Returns the user AND the plaintext recovery key (one-time view)
   */
  async createUser(request: CreateAccountRequest): Promise<CreateAccountResponse> {
    const db = await getDb();
    
    // SECURITY: Check if a user already exists (single user enforcement)
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM local_users').get();
    if ((existingCount as { count: number })?.count > 0) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(request.password, BCRYPT_ROUNDS);
    const now = new Date().toISOString();

    // Generate and hash recovery key
    const recoveryKey = this.generateRecoveryKey();
    const recoveryKeyHash = await bcrypt.hash(recoveryKey, BCRYPT_ROUNDS);

    db.prepare(
      `INSERT INTO local_users (id, username, email, password_hash, display_name, is_active, recovery_key_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
    ).run(userId, request.username, request.email, passwordHash, request.displayName ?? null, recoveryKeyHash, now, now);

    const row = db.prepare('SELECT * FROM local_users WHERE id = ?').get(userId);
    if (!isLocalUserRow(row)) {
      throw new Error('Failed to create local user');
    }

    return {
      user: mapRowToLocalUser(row),
      recoveryKey
    };
  },

  /**
   * Authenticate user with username/password
   * Enforces single session per device - invalidates existing sessions
   */
  async login(request: LoginRequest, context?: LoginContext): Promise<LoginResponse> {
    const db = await getDb();
    const row = db.prepare(
      'SELECT * FROM local_users WHERE username = ? OR email = ?'
    ).get(request.username, request.username);

    if (!isLocalUserRow(row)) {
      throw new Error('INVALID_CREDENTIALS');
    }

    if (row.is_active !== 1) {
      throw new Error('USER_DISABLED');
    }

    const passwordMatch = await bcrypt.compare(request.password, row.password_hash);
    if (!passwordMatch) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // SECURITY: Invalidate all existing sessions (single session enforcement)
    db.prepare('DELETE FROM local_sessions WHERE user_id = ?').run(row.id);

    // Get current mode dynamically
    const mode = await modeService.getMode();

    // Check session lock setting to determine token expiry
    const sessionConfig = await sessionService.getConfig();
    const sessionLockEnabled = sessionConfig.enableSessionLock !== false;
    const tokenExpiry = sessionLockEnabled ? ACCESS_TOKEN_EXPIRY_SHORT : ACCESS_TOKEN_EXPIRY_LONG;
    const refreshExpiryDays = sessionLockEnabled ? REFRESH_TOKEN_EXPIRY_DAYS : REFRESH_TOKEN_EXPIRY_DAYS_LONG;
    const expiresInSeconds = sessionLockEnabled ? 900 : 365 * 24 * 60 * 60;

    // Generate tokens
    const secret = await getJwtSecret();
    const accessToken = jwt.sign(
      { userId: row.id, username: row.username, mode },
      secret,
      { expiresIn: tokenExpiry }
    );

    const refreshToken = uuidv4();
    const sessionId = uuidv4();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + refreshExpiryDays * 24 * 60 * 60 * 1000).toISOString();

    // Store refresh token with session metadata
    db.prepare(
      `INSERT INTO local_sessions (id, user_id, refresh_token, expires_at, created_at, last_activity_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(sessionId, row.id, refreshToken, expiresAt, now, now, context?.ipAddress ?? null, context?.userAgent ?? null);

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
      mode,
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        displayName: row.display_name ?? undefined,
        isActive: true,
        roles: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    };
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const db = await getDb();
    
    const sessionRow = db.prepare(
      'SELECT * FROM local_sessions WHERE refresh_token = ?'
    ).get(refreshToken);

    if (!isLocalSessionRow(sessionRow)) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    // Check expiration
    if (new Date(sessionRow.expires_at) < new Date()) {
      db.prepare('DELETE FROM local_sessions WHERE id = ?').run(sessionRow.id);
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }

    // Get user
    const userRow = db.prepare('SELECT * FROM local_users WHERE id = ?').get(sessionRow.user_id);
    if (!isLocalUserRow(userRow)) {
      throw new Error('USER_NOT_FOUND');
    }

    if (userRow.is_active !== 1) {
      throw new Error('USER_DISABLED');
    }

    // Get current mode dynamically
    const mode = await modeService.getMode();

    // Check session lock setting to determine token expiry
    const sessionConfig = await sessionService.getConfig();
    const sessionLockEnabled = sessionConfig.enableSessionLock !== false;
    const tokenExpiry = sessionLockEnabled ? ACCESS_TOKEN_EXPIRY_SHORT : ACCESS_TOKEN_EXPIRY_LONG;
    const expiresInSeconds = sessionLockEnabled ? 900 : 365 * 24 * 60 * 60;

    // Generate new access token
    const secret = await getJwtSecret();
    const accessToken = jwt.sign(
      { userId: userRow.id, username: userRow.username, mode },
      secret,
      { expiresIn: tokenExpiry }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
      mode,
      user: {
        id: userRow.id,
        username: userRow.username,
        email: userRow.email,
        displayName: userRow.display_name ?? undefined,
        isActive: true,
        roles: [],
        createdAt: userRow.created_at,
        updatedAt: userRow.updated_at
      }
    };
  },

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<{ userId: string; username: string; mode: string }> {
    const secret = await getJwtSecret();
    try {
      const decoded = jwt.verify(token, secret) as { userId: string; username: string; mode: string };
      return decoded;
    } catch (_) {
      throw new Error('INVALID_TOKEN');
    }
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<LocalUser | null> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM local_users WHERE id = ?').get(userId);
    if (!isLocalUserRow(row)) return null;
    return mapRowToLocalUser(row);
  },

  /**
   * Logout (invalidate refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    const db = await getDb();
    db.prepare('DELETE FROM local_sessions WHERE refresh_token = ?').run(refreshToken);
  },

  /**
   * Change password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM local_users WHERE id = ?').get(userId);
    
    if (!isLocalUserRow(row)) {
      throw new Error('USER_NOT_FOUND');
    }

    const passwordMatch = await bcrypt.compare(oldPassword, row.password_hash);
    if (!passwordMatch) {
      throw new Error('INVALID_PASSWORD');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    db.prepare(
      'UPDATE local_users SET password_hash = ?, updated_at = ? WHERE id = ?'
    ).run(newPasswordHash, new Date().toISOString(), userId);
  },

  /**
   * Reset password using recovery key (for forgotten passwords)
   * SECURITY: Validates recovery key before allowing password reset
   */
  async resetPasswordWithKey(username: string, recoveryKey: string, newPassword: string): Promise<void> {
    const db = await getDb();
    const row = db.prepare(
      'SELECT * FROM local_users WHERE username = ? OR email = ?'
    ).get(username, username);

    if (!isLocalUserRow(row)) {
      throw new Error('USER_NOT_FOUND');
    }

    if (!row.recovery_key_hash) {
      throw new Error('RECOVERY_NOT_AVAILABLE');
    }

    const keyMatch = await bcrypt.compare(recoveryKey, row.recovery_key_hash);
    if (!keyMatch) {
      throw new Error('INVALID_RECOVERY_KEY');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    db.prepare(
      'UPDATE local_users SET password_hash = ?, updated_at = ? WHERE id = ?'
    ).run(newPasswordHash, new Date().toISOString(), row.id);

    // Invalidate all existing sessions after password reset
    db.prepare('DELETE FROM local_sessions WHERE user_id = ?').run(row.id);
  },

  /**
   * Generate a new recovery key for an authenticated user.
   * Invalidates any old key.
   */
  async generateNewRecoveryKey(userId: string): Promise<string> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM local_users WHERE id = ?').get(userId);

    if (!isLocalUserRow(row)) {
      throw new Error('USER_NOT_FOUND');
    }

    const recoveryKey = this.generateRecoveryKey();
    const recoveryKeyHash = await bcrypt.hash(recoveryKey, BCRYPT_ROUNDS);

    db.prepare(
      'UPDATE local_users SET recovery_key_hash = ?, updated_at = ? WHERE id = ?'
    ).run(recoveryKeyHash, new Date().toISOString(), userId);

    return recoveryKey;
  },

  /**
   * Delete user account permanently.
   * Requires password confirmation.
   */
  async deleteUser(userId: string, password: string): Promise<void> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM local_users WHERE id = ?').get(userId);

    if (!isLocalUserRow(row)) {
      throw new Error('USER_NOT_FOUND');
    }

    const passwordMatch = await bcrypt.compare(password, row.password_hash);
    if (!passwordMatch) {
      throw new Error('INVALID_PASSWORD');
    }

    // Delete all sessions
    db.prepare('DELETE FROM local_sessions WHERE user_id = ?').run(userId);
    
    // Delete the user
    db.prepare('DELETE FROM local_users WHERE id = ?').run(userId);
  },


  /**
   * Check if any local user exists
   */
  async hasLocalUser(): Promise<boolean> {
    const db = await getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM local_users').get();
    return (row as { count: number })?.count > 0;
  },

  /**
   * Get the count of local users
   */
  async getUserCount(): Promise<number> {
    const db = await getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM local_users').get();
    return (row as { count: number })?.count ?? 0;
  },

  /**
   * Reset all local user data (DESTRUCTIVE)
   * SECURITY: Requires confirmation phrase to prevent accidental deletion
   */
  async resetLocalData(confirmPhrase: string): Promise<void> {
    if (confirmPhrase !== 'RESET ALL DATA') {
      throw new Error('INVALID_CONFIRMATION');
    }

    const db = await getDb();
    
    // Delete all sessions first (foreign key constraint)
    db.prepare('DELETE FROM local_sessions').run();
    
    // Delete all local users
    db.prepare('DELETE FROM local_users').run();
    
    // Clear team binding if exists
    await settingsRepository.delete('team_binding');
    await settingsRepository.delete('shared_db_connection');
    await settingsRepository.delete('shared_enabled');
  }
};
