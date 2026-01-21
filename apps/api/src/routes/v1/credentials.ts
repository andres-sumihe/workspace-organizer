import { Router } from 'express';

import { credentialsController } from '../../controllers/credentials.controller.js';

export const credentialsRouter = Router();

// GET /api/v1/credentials - List credentials (metadata only)
credentialsRouter.get('/', credentialsController.list);

// GET /api/v1/credentials/:id - Get credential metadata by ID
credentialsRouter.get('/:id', credentialsController.getById);

// POST /api/v1/credentials/:id/reveal - Get credential with decrypted data
credentialsRouter.post('/:id/reveal', credentialsController.reveal);

// POST /api/v1/credentials - Create a new credential
credentialsRouter.post('/', credentialsController.create);

// PUT /api/v1/credentials/:id - Update a credential
credentialsRouter.put('/:id', credentialsController.update);

// DELETE /api/v1/credentials/:id - Delete a credential
credentialsRouter.delete('/:id', credentialsController.delete);

// Vault management routes
export const vaultRouter = Router();

// GET /api/v1/vault/status - Get vault status
vaultRouter.get('/status', credentialsController.getStatus);

// POST /api/v1/vault/setup - Set up the vault
vaultRouter.post('/setup', credentialsController.setup);

// POST /api/v1/vault/unlock - Unlock the vault
vaultRouter.post('/unlock', credentialsController.unlock);

// POST /api/v1/vault/lock - Lock the vault
vaultRouter.post('/lock', credentialsController.lock);
