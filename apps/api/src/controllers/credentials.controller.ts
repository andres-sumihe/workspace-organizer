import { credentialsService } from '../services/credentials.service.js';

import type {
  CreateCredentialRequest,
  UpdateCredentialRequest,
  VaultUnlockRequest,
  VaultSetupRequest,
  CredentialType
} from '@workspace/shared';
import type { NextFunction, Request, Response } from 'express';

export const credentialsController = {
  /**
   * GET /api/v1/vault/status
   * Get vault status (is it set up and unlocked)
   */
  async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const status = await credentialsService.getStatus();
      res.json(status);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/vault/setup
   * Set up the vault with initial master password
   */
  async setup(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as VaultSetupRequest;

      if (!body.masterPassword) {
        res.status(400).json({
          code: 'MISSING_PASSWORD',
          message: 'masterPassword is required'
        });
        return;
      }

      await credentialsService.setupVault(body.masterPassword);
      res.json({ success: true, message: 'Vault setup complete' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already set up')) {
          res.status(409).json({
            code: 'VAULT_EXISTS',
            message: error.message
          });
          return;
        }
        if (error.message.includes('at least')) {
          res.status(400).json({
            code: 'WEAK_PASSWORD',
            message: error.message
          });
          return;
        }
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/vault/unlock
   * Unlock the vault with master password
   */
  async unlock(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as VaultUnlockRequest;

      if (!body.masterPassword) {
        res.status(400).json({
          code: 'MISSING_PASSWORD',
          message: 'masterPassword is required'
        });
        return;
      }

      await credentialsService.unlockVault(body.masterPassword);
      res.json({ success: true, message: 'Vault unlocked' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not set up')) {
          res.status(404).json({
            code: 'VAULT_NOT_SETUP',
            message: error.message
          });
          return;
        }
        if (error.message.includes('Incorrect')) {
          res.status(401).json({
            code: 'INCORRECT_PASSWORD',
            message: error.message
          });
          return;
        }
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/vault/lock
   * Lock the vault (clear the key from memory)
   */
  async lock(_req: Request, res: Response, next: NextFunction) {
    try {
      credentialsService.lockVault();
      res.json({ success: true, message: 'Vault locked' });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/credentials
   * List credentials (metadata only)
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId, type } = req.query as { projectId?: string; type?: CredentialType };

      const items = await credentialsService.list({ projectId, type });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/credentials/:id
   * Get credential metadata by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      const credential = await credentialsService.getById(id);

      if (!credential) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Credential with ID ${id} not found`
        });
        return;
      }

      res.json({ credential });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/credentials/:id/reveal
   * Get credential with decrypted data
   */
  async reveal(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      const credential = await credentialsService.reveal(id);
      res.json({ credential });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            code: 'NOT_FOUND',
            message: error.message
          });
          return;
        }
        if (error.message.includes('locked')) {
          res.status(403).json({
            code: 'VAULT_LOCKED',
            message: error.message
          });
          return;
        }
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/credentials
   * Create a new credential
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateCredentialRequest;

      // Validate required fields
      if (!body.title || body.title.trim().length === 0) {
        res.status(400).json({
          code: 'MISSING_TITLE',
          message: 'title is required'
        });
        return;
      }

      if (!body.data) {
        res.status(400).json({
          code: 'MISSING_DATA',
          message: 'data is required'
        });
        return;
      }

      const credential = await credentialsService.create(body);
      res.status(201).json({ credential });
    } catch (error) {
      if (error instanceof Error && error.message.includes('locked')) {
        res.status(403).json({
          code: 'VAULT_LOCKED',
          message: error.message
        });
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/v1/credentials/:id
   * Update a credential
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateCredentialRequest;

      const credential = await credentialsService.update(id, body);
      res.json({ credential });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            code: 'NOT_FOUND',
            message: error.message
          });
          return;
        }
        if (error.message.includes('locked')) {
          res.status(403).json({
            code: 'VAULT_LOCKED',
            message: error.message
          });
          return;
        }
      }
      next(error);
    }
  },

  /**
   * DELETE /api/v1/credentials/:id
   * Delete a credential
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      const deleted = await credentialsService.delete(id);

      if (!deleted) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Credential with ID ${id} not found`
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
};
