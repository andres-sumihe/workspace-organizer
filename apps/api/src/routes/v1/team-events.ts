/**
 * SSE route for real-time team events.
 *
 * GET /api/v1/teams/:teamId/events
 *
 * Opens a Server-Sent Events stream scoped to a single team.
 * The client receives JSON events whenever team data changes —
 * then invalidates the relevant TanStack Query cache key.
 */

import { Router } from 'express';

import { modeAwareAuthProvider } from '../../auth/mode-aware-auth.provider.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { teamEventsService } from '../../services/team-events.service.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { TeamEvent } from '../../services/team-events.service.js';
import type { Request, RequestHandler, Response, NextFunction } from 'express';

export const teamEventsRouter = Router({ mergeParams: true });

/**
 * Lightweight auth middleware for SSE connections.
 *
 * EventSource cannot set custom headers, so the JWT arrives as
 * `?token=<jwt>`.  We verify it inline (same as Hocuspocus) and
 * skip the session-timeout check — SSE is a long-lived connection
 * and should not be killed by idle-session logic.
 */
const sseAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Accept token from query string or standard Authorization header
    const token =
      (typeof req.query.token === 'string' ? req.query.token : null) ??
      req.headers.authorization?.replace(/^Bearer\s+/i, '') ??
      null;

    if (!token) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'No authentication token provided' });
      return;
    }

    const decoded = await modeAwareAuthProvider.verifyToken(token);
    const user = await modeAwareAuthProvider.getUserById(decoded.userId);

    if (!user || !user.isActive) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not found or inactive' });
      return;
    }

    // Attach user context so downstream RBAC middleware works
    (req as TeamAuthenticatedRequest).user = user;
    (req as TeamAuthenticatedRequest).userId = user.id;
    (req as TeamAuthenticatedRequest).permissions = user.permissions;
    (req as TeamAuthenticatedRequest).appMode = user.mode;

    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication failed' });
  }
};

teamEventsRouter.use(sseAuth);

/**
 * GET /teams/:teamId/events
 * SSE stream of real-time team events.
 */
teamEventsRouter.get('/', requireTeamRole('member'), (req: TeamAuthenticatedRequest, res: Response) => {
  const teamId = req.teamId;
  const currentEmail = req.memberEmail;

  // SSE headers — use res.set() to preserve CORS headers already set by middleware
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx/proxy buffering
  });
  res.flushHeaders();

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Keep-alive ping every 30 s to prevent proxy/load balancer timeouts
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30_000);

  // Listen for team events
  const handler = (event: TeamEvent & { serverId?: string }) => {
    // Only forward events for this team
    if (event.teamId !== teamId) return;
    // Skip events from the current user (they already invalidated locally)
    if (event.actorEmail === currentEmail) return;

    const payload: Record<string, unknown> = {
      type: 'team-event',
      resource: event.resource,
      action: event.action,
      resourceId: event.resourceId,
    };
    if (event.parentId) payload.parentId = event.parentId;
    if (event.grandParentId) payload.grandParentId = event.grandParentId;

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  teamEventsService.on('event', handler);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    teamEventsService.removeListener('event', handler);
  });
});
