/**
 * Collaboration status route.
 *
 * Provides the frontend with information about whether
 * real-time collaboration is available and the WebSocket URL.
 */

import { Router } from 'express';

import { isSharedDbConnected } from '../../db/shared-client.js';
import { getHocuspocus } from '../../services/collaboration.service.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import type { Response, RequestHandler } from 'express';

export const collaborationRouter = Router();

collaborationRouter.use(requireAuth as RequestHandler);

/**
 * GET /api/v1/collaboration/status
 * Returns whether collaboration is available.
 */
collaborationRouter.get('/status', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const sharedDbConnected = isSharedDbConnected();
  const hocuspocusRunning = getHocuspocus() !== null;
  const available = sharedDbConnected && hocuspocusRunning;

  res.json({
    available,
    sharedDbConnected,
    hocuspocusRunning,
  });
}));
