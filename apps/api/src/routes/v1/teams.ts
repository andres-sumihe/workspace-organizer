import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { rbacService } from '../../services/rbac.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { RequestHandler, Response } from 'express';

export const teamsRouter = Router();

// All team routes require authentication
teamsRouter.use(requireAuth as RequestHandler);

/**
 * GET /teams
 * List all teams the authenticated user belongs to
 */
teamsRouter.get('/', asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'User email not found'
    });
    return;
  }

  const teams = await rbacService.getTeamsByEmail(userEmail);

  res.json({
    teams,
    count: teams.length
  });
}));

/**
 * GET /teams/:teamId
 * Get a specific team (requires membership)
 */
teamsRouter.get('/:teamId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, teamRole, memberEmail } = req;

  // Get team details from database
  const { query } = await import('../../db/shared-client.js');
  
  interface TeamRow {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  }

  const teams = await query<TeamRow>(
    'SELECT id, name, description, created_at, updated_at FROM teams WHERE id = $1',
    [teamId]
  );

  if (teams.length === 0) {
    res.status(404).json({
      code: 'TEAM_NOT_FOUND',
      message: 'Team not found'
    });
    return;
  }

  const team = teams[0];

  res.json({
    team: {
      id: team.id,
      name: team.name,
      description: team.description ?? undefined,
      createdAt: team.created_at,
      updatedAt: team.updated_at
    },
    membership: {
      role: teamRole,
      email: memberEmail
    }
  });
}));

/**
 * GET /teams/:teamId/members
 * List team members (requires membership)
 */
teamsRouter.get('/:teamId/members', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;

  const { query } = await import('../../db/shared-client.js');

  interface MemberRow {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    joined_at: string;
    last_active_at: string | null;
  }

  const members = await query<MemberRow>(
    `SELECT id, email, display_name, role, joined_at, last_active_at
     FROM team_members
     WHERE team_id = $1
     ORDER BY role, display_name, email`,
    [teamId]
  );

  res.json({
    members: members.map(m => ({
      id: m.id,
      email: m.email,
      displayName: m.display_name ?? undefined,
      role: m.role,
      joinedAt: m.joined_at,
      lastActiveAt: m.last_active_at ?? undefined
    })),
    count: members.length
  });
}));

/**
 * PATCH /teams/:teamId/members/:memberId/role
 * Update a team member's role (requires admin or owner)
 */
teamsRouter.patch('/:teamId/members/:memberId/role', requireTeamRole('admin'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, teamRole, memberEmail } = req;
  const { memberId } = req.params;
  const { role: newRole } = req.body ?? {};

  if (!newRole || !['member', 'admin', 'owner'].includes(newRole)) {
    res.status(400).json({
      code: 'INVALID_ROLE',
      message: 'Role must be one of: member, admin, owner'
    });
    return;
  }

  const { query, execute } = await import('../../db/shared-client.js');

  // Get target member
  interface MemberRow {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
  }

  const targetMembers = await query<MemberRow>(
    'SELECT id, email, display_name, role FROM team_members WHERE id = $1 AND team_id = $2',
    [memberId, teamId]
  );

  if (targetMembers.length === 0) {
    res.status(404).json({
      code: 'MEMBER_NOT_FOUND',
      message: 'Team member not found'
    });
    return;
  }

  const targetMember = targetMembers[0];

  // Prevent changing owner role unless you're the owner
  if (targetMember.role === 'owner' && teamRole !== 'owner') {
    res.status(403).json({
      code: 'CANNOT_CHANGE_OWNER',
      message: 'Only the team owner can change another owner\'s role'
    });
    return;
  }

  // Prevent setting someone to owner unless you're the owner
  if (newRole === 'owner' && teamRole !== 'owner') {
    res.status(403).json({
      code: 'CANNOT_ASSIGN_OWNER',
      message: 'Only the team owner can assign the owner role'
    });
    return;
  }

  // Update the role
  await execute(
    'UPDATE team_members SET role = $1 WHERE id = $2',
    [newRole, memberId]
  );

  // Log the role change
  const { auditService } = await import('../../services/audit.service.js');
  await auditService.logRoleChange(
    memberEmail!,
    teamId!,
    targetMember.email,
    targetMember.role,
    newRole,
    { memberDisplayName: req.user?.displayName }
  );

  res.json({
    success: true,
    member: {
      id: targetMember.id,
      email: targetMember.email,
      displayName: targetMember.display_name ?? undefined,
      role: newRole
    }
  });
}));

/**
 * DELETE /teams/:teamId/members/:memberId
 * Remove a team member (requires admin or owner)
 */
teamsRouter.delete('/:teamId/members/:memberId', requireTeamRole('admin'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, teamRole } = req;
  const { memberId } = req.params;

  const { query, execute } = await import('../../db/shared-client.js');

  // Get target member
  interface MemberRow {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
  }

  const targetMembers = await query<MemberRow>(
    'SELECT id, email, display_name, role FROM team_members WHERE id = $1 AND team_id = $2',
    [memberId, teamId]
  );

  if (targetMembers.length === 0) {
    res.status(404).json({
      code: 'MEMBER_NOT_FOUND',
      message: 'Team member not found'
    });
    return;
  }

  const targetMember = targetMembers[0];

  // Cannot remove owner
  if (targetMember.role === 'owner') {
    res.status(403).json({
      code: 'CANNOT_REMOVE_OWNER',
      message: 'Cannot remove the team owner'
    });
    return;
  }

  // Admin cannot remove other admins
  if (teamRole === 'admin' && targetMember.role === 'admin') {
    res.status(403).json({
      code: 'CANNOT_REMOVE_ADMIN',
      message: 'Admins cannot remove other admins'
    });
    return;
  }

  // Remove the member
  await execute('DELETE FROM team_members WHERE id = $1', [memberId]);

  // Log the removal
  const { auditService } = await import('../../services/audit.service.js');
  await auditService.logLeaveTeam(
    targetMember.email,
    teamId!,
    { memberDisplayName: targetMember.display_name ?? undefined }
  );

  res.status(204).send();
}));
