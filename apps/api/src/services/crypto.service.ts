import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

/**
 * Derives a key from a password using PBKDF2.
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Generates a random salt for key derivation.
 */
export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

/**
 * Hashes a password for verification (not encryption).
 */
export function hashPassword(password: string, salt: Buffer): string {
  const key = deriveKey(password, salt);
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Encrypts data using AES-256-GCM.
 * Returns an object with iv, authTag, and encrypted data, all as base64 strings.
 */
export function encrypt(
  plaintext: string,
  key: Buffer
): { iv: string; authTag: string; encryptedBlob: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encryptedBlob: encrypted.toString('base64')
  };
}

/**
 * Decrypts data using AES-256-GCM.
 * @throws Error if decryption fails (wrong key or tampered data).
 */
export function decrypt(
  encryptedBlob: string,
  iv: string,
  authTag: string,
  key: Buffer
): string {
  const ivBuffer = Buffer.from(iv, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');
  const encryptedBuffer = Buffer.from(encryptedBlob, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTagBuffer);
  
  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
}

/**
 * Crypto service for vault operations.
 * Manages the derived encryption key in memory.
 */
class CryptoService {
  private derivedKey: Buffer | null = null;
  private unlockTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Derives and stores the encryption key from the master password.
   * Starts an auto-lock timeout.
   */
  unlock(masterPassword: string, salt: Buffer): void {
    this.derivedKey = deriveKey(masterPassword, salt);
    this.resetTimeout();
  }

  /**
   * Clears the derived key from memory.
   */
  lock(): void {
    if (this.derivedKey) {
      // Overwrite the key buffer with zeros before nullifying
      this.derivedKey.fill(0);
      this.derivedKey = null;
    }
    if (this.unlockTimeout) {
      clearTimeout(this.unlockTimeout);
      this.unlockTimeout = null;
    }
  }

  /**
   * Resets the auto-lock timeout.
   */
  resetTimeout(): void {
    if (this.unlockTimeout) {
      clearTimeout(this.unlockTimeout);
    }
    this.unlockTimeout = setTimeout(() => {
      this.lock();
    }, this.SESSION_TIMEOUT_MS);
  }

  /**
   * Checks if the vault is currently unlocked.
   */
  isUnlocked(): boolean {
    return this.derivedKey !== null;
  }

  /**
   * Gets the derived key for encryption/decryption operations.
   * @throws Error if vault is locked.
   */
  getKey(): Buffer {
    if (!this.derivedKey) {
      throw new Error('Vault is locked. Please unlock first.');
    }
    this.resetTimeout(); // Reset timeout on activity
    return this.derivedKey;
  }

  /**
   * Encrypts data using the current session key.
   * @throws Error if vault is locked.
   */
  encryptData(data: object): { iv: string; authTag: string; encryptedBlob: string } {
    const key = this.getKey();
    const plaintext = JSON.stringify(data);
    return encrypt(plaintext, key);
  }

  /**
   * Decrypts data using the current session key.
   * @throws Error if vault is locked or decryption fails.
   */
  decryptData<T = object>(encryptedBlob: string, iv: string, authTag: string): T {
    const key = this.getKey();
    const plaintext = decrypt(encryptedBlob, iv, authTag, key);
    return JSON.parse(plaintext) as T;
  }
}

// Singleton instance
export const cryptoService = new CryptoService();
