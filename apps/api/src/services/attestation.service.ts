import crypto from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { getSharedPool, isSharedDbConnected } from '../db/shared-client.js';
import { settingsRepository } from '../repositories/settings.repository.js';

import type { 
  AppInfo, 
  AttestationPayload, 
  AttestationResponse, 
  TeamBinding 
} from '@workspace/shared';

/**
 * Attestation Service
 * 
 * Provides cryptographic attestation for verifying team database connections.
 * 
 * Security Model:
 * 1. Each team database has a unique server_id and Ed25519 key pair
 * 2. On first connection, we store the server's public key locally (TOFU - Trust On First Use)
 * 3. On subsequent connections, we verify the server can sign a challenge
 * 4. Optional TLS fingerprint verification for additional security
 * 
 * This prevents:
 * - Connection hijacking (wrong database)
 * - Team impersonation
 * - Credential replay attacks
 */

// Ed25519 key generation and signing using Node.js crypto
const generateKeyPair = (): { publicKey: string; privateKey: string } => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
};

const sign = (data: string, privateKey: string): string => {
  const signature = crypto.sign(null, Buffer.from(data), privateKey);
  return signature.toString('base64');
};

const verify = (data: string, signature: string, publicKey: string): boolean => {
  try {
    return crypto.verify(null, Buffer.from(data), publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
};

export const attestationService = {
  /**
   * Initialize app_info in shared database if not exists
   * This is called during first team setup
   */
  async initializeAppInfo(teamId: string, teamName: string): Promise<AppInfo> {
    if (!isSharedDbConnected()) {
      throw new Error('SHARED_DB_NOT_CONNECTED');
    }

    const pool = getSharedPool();
    
    // Check if app_info already exists
    const existing = await pool.query('SELECT * FROM app_info LIMIT 1');
    if (existing.rows.length > 0) {
      return this.mapRowToAppInfo(existing.rows[0]);
    }

    // Generate new server identity
    const serverId = uuidv4();
    const { publicKey, privateKey } = generateKeyPair();
    const now = new Date().toISOString();

    // Store in database (public key only in app_info, private key in secure settings)
    await pool.query(
      `INSERT INTO app_info (server_id, team_id, team_name, public_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [serverId, teamId, teamName, publicKey, now]
    );

    // Store private key securely (should be in a secure enclave in production)
    await pool.query(
      `INSERT INTO app_secrets (key, value, created_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
      ['server_private_key', privateKey, now]
    );

    return {
      serverId,
      teamId,
      teamName,
      publicKey,
      createdAt: now,
      updatedAt: now
    };
  },

  /**
   * Get app info from shared database
   */
  async getAppInfo(): Promise<AppInfo | null> {
    if (!isSharedDbConnected()) {
      return null;
    }

    const pool = getSharedPool();
    const result = await pool.query('SELECT * FROM app_info LIMIT 1');
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAppInfo(result.rows[0]);
  },

  /**
   * Generate signed attestation for a user
   * Used to prove the server identity to the client
   */
  async generateAttestation(userId: string): Promise<AttestationResponse> {
    if (!isSharedDbConnected()) {
      throw new Error('SHARED_DB_NOT_CONNECTED');
    }

    const pool = getSharedPool();

    // Get app info
    const appInfoResult = await pool.query('SELECT * FROM app_info LIMIT 1');
    if (appInfoResult.rows.length === 0) {
      throw new Error('APP_INFO_NOT_INITIALIZED');
    }
    const appInfo = this.mapRowToAppInfo(appInfoResult.rows[0]);

    // Get private key
    const secretResult = await pool.query(
      'SELECT value FROM app_secrets WHERE key = $1',
      ['server_private_key']
    );
    if (secretResult.rows.length === 0) {
      throw new Error('PRIVATE_KEY_NOT_FOUND');
    }
    const privateKey = secretResult.rows[0].value;

    // Create attestation payload
    const payload: AttestationPayload = {
      serverId: appInfo.serverId,
      teamId: appInfo.teamId,
      userId,
      timestamp: new Date().toISOString(),
      nonce: uuidv4()
    };

    // Sign the payload
    const payloadString = JSON.stringify(payload);
    const signature = sign(payloadString, privateKey);

    return {
      payload,
      signature
    };
  },

  /**
   * Verify an attestation signature
   */
  verifyAttestation(response: { payload: unknown; signature: string }, publicKey: string): boolean {
    const payloadString = JSON.stringify(response.payload);
    return verify(payloadString, response.signature, publicKey);
  },

  /**
   * Store team binding locally (TOFU - Trust On First Use)
   */
  async storeTeamBinding(appInfo: AppInfo, tlsFingerprint?: string): Promise<void> {
    const binding: TeamBinding = {
      serverId: appInfo.serverId,
      teamId: appInfo.teamId,
      teamName: appInfo.teamName,
      publicKey: appInfo.publicKey,
      tlsFingerprint,
      boundAt: new Date().toISOString()
    };

    await settingsRepository.set(
      'team_binding',
      binding,
      'Cryptographic binding to team database'
    );
  },

  /**
   * Get stored team binding
   */
  async getTeamBinding(): Promise<TeamBinding | null> {
    const setting = await settingsRepository.get<TeamBinding>('team_binding');
    return setting?.value ?? null;
  },

  /**
   * Verify that current connection matches stored binding
   */
  async verifyBinding(): Promise<{ valid: boolean; reason?: string }> {
    const binding = await this.getTeamBinding();
    if (!binding) {
      return { valid: false, reason: 'NO_BINDING' };
    }

    const appInfo = await this.getAppInfo();
    if (!appInfo) {
      return { valid: false, reason: 'CANNOT_GET_APP_INFO' };
    }

    // Verify server ID matches
    if (appInfo.serverId !== binding.serverId) {
      return { valid: false, reason: 'SERVER_ID_MISMATCH' };
    }

    // Verify team ID matches
    if (appInfo.teamId !== binding.teamId) {
      return { valid: false, reason: 'TEAM_ID_MISMATCH' };
    }

    // Verify public key matches (prevents key rotation attacks)
    if (appInfo.publicKey !== binding.publicKey) {
      return { valid: false, reason: 'PUBLIC_KEY_MISMATCH' };
    }

    return { valid: true };
  },

  /**
   * Clear team binding (used when leaving a team)
   */
  async clearTeamBinding(): Promise<void> {
    await settingsRepository.delete('team_binding');
  },

  // Helper to map database row to AppInfo
  mapRowToAppInfo(row: Record<string, unknown>): AppInfo {
    return {
      serverId: row.server_id as string,
      teamId: row.team_id as string,
      teamName: row.team_name as string,
      publicKey: row.public_key as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    };
  }
};
