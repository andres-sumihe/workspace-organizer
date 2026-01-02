import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { getDb } from '../db/client.js';
import { sessionService } from '../services/session.service.js';

describe('Session Service', () => {
  const testUserId = uuidv4();
  
  beforeEach(async () => {
    const db = await getDb();
    
    // Create test user
    db.prepare(
      `INSERT INTO local_users (id, username, email, password_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
    ).run(testUserId, 'testuser', 'test@example.com', 'hash');
  });

  afterEach(async () => {
    const db = await getDb();
    
    // Clean up test data
    db.prepare('DELETE FROM local_sessions WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM local_users WHERE id = ?').run(testUserId);
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove sessions that have passed their expires_at timestamp', async () => {
      const db = await getDb();
      
      // Create an expired session (expires 2 days ago)
      const expiredSessionId = uuidv4();
      const expiredToken = uuidv4();
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      
      db.prepare(
        `INSERT INTO local_sessions (id, user_id, refresh_token, expires_at, created_at, last_activity_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).run(expiredSessionId, testUserId, expiredToken, twoDaysAgo);

      // Create an active session (expires in 7 days)
      const activeSessionId = uuidv4();
      const activeToken = uuidv4();
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      db.prepare(
        `INSERT INTO local_sessions (id, user_id, refresh_token, expires_at, created_at, last_activity_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).run(activeSessionId, testUserId, activeToken, sevenDaysFromNow);

      // Run cleanup
      const cleaned = await sessionService.cleanupExpiredSessions();
      
      expect(cleaned).toBe(1);

      // Verify expired session was removed
      const expiredSession = db.prepare(
        'SELECT * FROM local_sessions WHERE id = ?'
      ).get(expiredSessionId);
      expect(expiredSession).toBeUndefined();

      // Verify active session still exists
      const activeSession = db.prepare(
        'SELECT * FROM local_sessions WHERE id = ?'
      ).get(activeSessionId);
      expect(activeSession).toBeDefined();
    });
  });

  describe('cleanupInactiveSessions', () => {
    it('should remove sessions that have exceeded inactivity timeout', async () => {
      const db = await getDb();
      const config = await sessionService.getConfig();
      
      // Create a session with old last_activity_at (beyond inactivity timeout)
      const inactiveSessionId = uuidv4();
      const inactiveToken = uuidv4();
      const inactivityCutoff = new Date(
        Date.now() - (config.inactivityTimeoutMinutes * 60 * 1000) - 10000
      ).toISOString();
      const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      db.prepare(
        `INSERT INTO local_sessions (id, user_id, refresh_token, expires_at, created_at, last_activity_at)
         VALUES (?, ?, ?, ?, datetime('now'), ?)`
      ).run(inactiveSessionId, testUserId, inactiveToken, futureExpiry, inactivityCutoff);

      // Create an active session (recent activity)
      const activeSessionId = uuidv4();
      const activeToken = uuidv4();
      const recentActivity = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      
      db.prepare(
        `INSERT INTO local_sessions (id, user_id, refresh_token, expires_at, created_at, last_activity_at)
         VALUES (?, ?, ?, ?, datetime('now'), ?)`
      ).run(activeSessionId, testUserId, activeToken, futureExpiry, recentActivity);

      // Run cleanup
      const cleaned = await sessionService.cleanupInactiveSessions();
      
      expect(cleaned).toBeGreaterThanOrEqual(1);

      // Verify inactive session was removed
      const inactiveSession = db.prepare(
        'SELECT * FROM local_sessions WHERE id = ?'
      ).get(inactiveSessionId);
      expect(inactiveSession).toBeUndefined();

      // Verify active session still exists
      const activeSession = db.prepare(
        'SELECT * FROM local_sessions WHERE id = ?'
      ).get(activeSessionId);
      expect(activeSession).toBeDefined();
    });
  });

  describe('getSessionInfo', () => {
    it('should return null for non-existent sessions', async () => {
      const session = await sessionService.getSessionInfo('non-existent-user-id');
      expect(session).toBeNull();
    });

    it('should mark session as inactive when inactivity timeout is exceeded', async () => {
      const db = await getDb();
      const config = await sessionService.getConfig();
      
      // Create a session with old activity (beyond timeout)
      const sessionId = uuidv4();
      const refreshToken = uuidv4();
      const oldActivity = new Date(
        Date.now() - (config.inactivityTimeoutMinutes * 60 * 1000) - 10000
      ).toISOString();
      const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      db.prepare(
        `INSERT INTO local_sessions (id, user_id, refresh_token, expires_at, created_at, last_activity_at)
         VALUES (?, ?, ?, ?, datetime('now'), ?)`
      ).run(sessionId, testUserId, refreshToken, futureExpiry, oldActivity);

      const sessionInfo = await sessionService.getSessionInfo(testUserId);
      
      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo?.isActive).toBe(false);
    });

    it('should mark session as active when recently used', async () => {
      const db = await getDb();
      
      // Create a session with recent activity
      const sessionId = uuidv4();
      const refreshToken = uuidv4();
      const recentActivity = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      db.prepare(
        `INSERT INTO local_sessions (id, user_id, refresh_token, expires_at, created_at, last_activity_at)
         VALUES (?, ?, ?, ?, datetime('now'), ?)`
      ).run(sessionId, testUserId, refreshToken, futureExpiry, recentActivity);

      const sessionInfo = await sessionService.getSessionInfo(testUserId);
      
      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo?.isActive).toBe(true);
    });
  });
});
