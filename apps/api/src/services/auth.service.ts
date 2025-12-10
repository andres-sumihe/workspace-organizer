import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { getSharedPool, query, queryOne, execute } from '../db/shared-client.js';
import { settingsRepository } from '../repositories/settings.repository.js';

import type {
  User,
  UserWithRoles,
  Role,
  Permission,
  LoginRequest,
  LoginResponse,
  CreateUserRequest
} from '@workspace/shared';

// Configuration
const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// JWT secret - should be stored in settings for production
const getJwtSecret = async (): Promise<string> => {
  const setting = await settingsRepository.get<string>('jwt_secret');
  if (setting?.value) {
    return setting.value;
  }
  // Generate and store a new secret if not exists
  const secret = uuidv4() + uuidv4();
  await settingsRepository.set('jwt_secret', secret, 'JWT signing secret');
  return secret;
};

// User row type from database
interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface PermissionRow {
  id: string;
  resource: string;
  action: string;
  description: string | null;
  created_at: string;
}

// Map database row to User
const mapRowToUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  email: row.email,
  displayName: row.display_name ?? undefined,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Map database row to Role
const mapRowToRole = (row: RoleRow): Role => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  isSystem: row.is_system,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Map database row to Permission
const mapRowToPermission = (row: PermissionRow): Permission => ({
  id: row.id,
  resource: row.resource as Permission['resource'],
  action: row.action as Permission['action'],
  description: row.description ?? undefined,
  createdAt: row.created_at
});

export const authService = {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  },

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  /**
   * Generate JWT access token
   */
  async generateAccessToken(userId: string, username: string): Promise<string> {
    const secret = await getJwtSecret();
    return jwt.sign({ userId, username, type: 'access' }, secret, {
      expiresIn: ACCESS_TOKEN_EXPIRY
    });
  },

  /**
   * Generate JWT refresh token
   */
  async generateRefreshToken(userId: string): Promise<string> {
    const secret = await getJwtSecret();
    return jwt.sign({ userId, type: 'refresh' }, secret, {
      expiresIn: REFRESH_TOKEN_EXPIRY
    });
  },

  /**
   * Verify and decode a JWT token
   */
  async verifyToken(token: string): Promise<{ userId: string; username?: string; type: string }> {
    const secret = await getJwtSecret();
    return jwt.verify(token, secret) as { userId: string; username?: string; type: string };
  },

  /**
   * Get user by ID with roles
   */
  async getUserById(userId: string): Promise<UserWithRoles | null> {
    const userRow = await queryOne<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (!userRow) return null;

    const user = mapRowToUser(userRow);
    const roles = await this.getUserRoles(userId);

    return { ...user, roles };
  },

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<UserRow | null> {
    return queryOne<UserRow>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
  },

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserRow | null> {
    return queryOne<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
  },

  /**
   * Get roles for a user
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const rows = await query<RoleRow>(
      `SELECT r.* FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1
       ORDER BY r.name`,
      [userId]
    );
    return rows.map(mapRowToRole);
  },

  /**
   * Get permissions for a user (through their roles)
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const rows = await query<PermissionRow>(
      `SELECT DISTINCT p.* FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1
       ORDER BY p.resource, p.action`,
      [userId]
    );
    return rows.map(mapRowToPermission);
  },

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1 AND p.resource = $2 AND p.action = $3`,
      [userId, resource, action]
    );
    return result ? parseInt(result.count, 10) > 0 : false;
  },

  /**
   * Login user and create session
   */
  async login(
    credentials: LoginRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    const userRow = await this.getUserByUsername(credentials.username);

    if (!userRow) {
      throw new Error('Invalid username or password');
    }

    if (!userRow.is_active) {
      throw new Error('User account is deactivated');
    }

    const passwordValid = await this.verifyPassword(credentials.password, userRow.password_hash);

    if (!passwordValid) {
      throw new Error('Invalid username or password');
    }

    // Generate tokens
    const accessToken = await this.generateAccessToken(userRow.id, userRow.username);
    const refreshToken = await this.generateRefreshToken(userRow.id);

    // Hash tokens for storage
    const tokenHash = await bcrypt.hash(accessToken, 10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    // Calculate expiry times
    const accessExpiry = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create session
    await execute(
      `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, expires_at, refresh_expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userRow.id, tokenHash, refreshTokenHash, accessExpiry.toISOString(), refreshExpiry.toISOString(), ipAddress, userAgent]
    );

    // Get user with roles
    const user = await this.getUserById(userRow.id);

    if (!user) {
      throw new Error('Failed to retrieve user data');
    }

    return {
      user,
      accessToken,
      refreshToken,
      expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000)
    };
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    // Verify the refresh token
    const decoded = await this.verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    // Check if user exists and is active
    const user = await this.getUserById(decoded.userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    // Generate new access token
    const accessToken = await this.generateAccessToken(user.id, user.username);

    return {
      accessToken,
      expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000)
    };
  },

  /**
   * Logout user and invalidate session
   */
  async logout(accessToken: string): Promise<void> {
    try {
      const decoded = await this.verifyToken(accessToken);
      // Delete all sessions for this user (or just the current one if needed)
      await execute(
        'DELETE FROM sessions WHERE user_id = $1',
        [decoded.userId]
      );
    } catch {
      // Token might be invalid/expired, that's okay for logout
    }
  },

  /**
   * Create a new user
   */
  async createUser(request: CreateUserRequest): Promise<UserWithRoles> {
    const pool = getSharedPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if username already exists
      const existingUsername = await this.getUserByUsername(request.username);
      if (existingUsername) {
        throw new Error('Username already exists');
      }

      // Check if email already exists
      const existingEmail = await this.getUserByEmail(request.email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(request.password);

      // Insert user
      const result = await client.query<UserRow>(
        `INSERT INTO users (username, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [request.username, request.email, passwordHash, request.displayName ?? null]
      );

      const userRow = result.rows[0];

      // Assign roles if provided
      if (request.roleIds && request.roleIds.length > 0) {
        for (const roleId of request.roleIds) {
          await client.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userRow.id, roleId]
          );
        }
      }

      await client.query('COMMIT');

      const user = await this.getUserById(userRow.id);
      if (!user) {
        throw new Error('Failed to retrieve created user');
      }

      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get role by name
   */
  async getRoleByName(name: string): Promise<Role | null> {
    const row = await queryOne<RoleRow>(
      'SELECT * FROM roles WHERE name = $1',
      [name]
    );
    return row ? mapRowToRole(row) : null;
  },

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const userRow = await queryOne<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (!userRow) {
      throw new Error('User not found');
    }

    const passwordValid = await this.verifyPassword(currentPassword, userRow.password_hash);

    if (!passwordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const validation = this.validatePassword(newPassword);
    if (!validation.valid) {
      throw new Error(validation.errors.join('. '));
    }

    const newPasswordHash = await this.hashPassword(newPassword);

    await execute(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Invalidate all existing sessions
    await execute('DELETE FROM sessions WHERE user_id = $1', [userId]);
  },

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await execute(
      'DELETE FROM sessions WHERE expires_at < NOW()'
    );
    return result;
  }
};
