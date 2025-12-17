import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { RequestHandler, Response } from 'express';

export const teamsRouter = Router();

// All team routes require authentication
teamsRouter.use(requireAuth as RequestHandler);

/**
 * POST /teams
 * Create a new team (authenticated user becomes owner)
 */
teamsRouter.post('/', asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const userEmail = req.user?.email;
  const displayName = req.user?.displayName;

  if (!userEmail) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'User email not found'
    });
    return;
  }

  const { name, description } = req.body ?? {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      code: 'INVALID_NAME',
      message: 'Team name is required'
    });
    return;
  }

  const { query, execute } = await import('../../db/shared-client.js');

  // Check if team name already exists
  interface TeamCheckRow {
    count: string;
  }

  const existingTeams = await query<TeamCheckRow>(
    'SELECT COUNT(*) as count FROM teams WHERE LOWER(name) = LOWER($1)',
    [name.trim()]
  );

  if (parseInt(existingTeams[0].count, 10) > 0) {
    res.status(409).json({
      code: 'TEAM_NAME_EXISTS',
      message: 'A team with this name already exists'
    });
    return;
  }

  // Create the team
  interface TeamRow {
    id: string;
    name: string;
    description: string | null;
    created_by_email: string | null;
    created_at: string;
    updated_at: string;
  }

  const teams = await query<TeamRow>(
    `INSERT INTO teams (name, description, created_by_email)
     VALUES ($1, $2, $3)
     RETURNING id, name, description, created_by_email, created_at, updated_at`,
    [name.trim(), description || null, userEmail]
  );

  const team = teams[0];

  // Add creator as owner
  await execute(
    `INSERT INTO team_members (team_id, email, display_name, role)
     VALUES ($1, $2, $3, 'owner')`,
    [team.id, userEmail, displayName || null]
  );

  // Log team creation
  const { auditService } = await import('../../services/audit.service.js');
  await auditService.logTeamCreated(userEmail, team.id, { teamName: team.name, memberDisplayName: displayName });

  res.status(201).json({
    team: {
      id: team.id,
      name: team.name,
      description: team.description ?? undefined,
      createdByEmail: team.created_by_email ?? undefined,
      createdAt: team.created_at,
      updatedAt: team.updated_at
    },
    membership: {
      role: 'owner',
      email: userEmail
    }
  });
}));

/**
 * POST /teams/join
 * Join an existing team by team ID
 */
teamsRouter.post('/join', asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const userEmail = req.user?.email;
  const displayName = req.user?.displayName;

  if (!userEmail) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'User email not found'
    });
    return;
  }

  const { teamId } = req.body ?? {};

  if (!teamId || typeof teamId !== 'string') {
    res.status(400).json({
      code: 'INVALID_TEAM_ID',
      message: 'Team ID is required'
    });
    return;
  }

  const { query, execute } = await import('../../db/shared-client.js');

  // Find the team by ID
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

  // Check if user is already a member
  interface MemberCheckRow {
    count: string;
  }

  const existingMembers = await query<MemberCheckRow>(
    'SELECT COUNT(*) as count FROM team_members WHERE team_id = $1 AND email = $2',
    [team.id, userEmail]
  );

  if (parseInt(existingMembers[0].count, 10) > 0) {
    res.status(409).json({
      code: 'ALREADY_MEMBER',
      message: 'You are already a member of this team'
    });
    return;
  }

  // Add user as member
  await execute(
    `INSERT INTO team_members (team_id, email, display_name, role)
     VALUES ($1, $2, $3, 'member')`,
    [team.id, userEmail, displayName || null]
  );

  // Log team join
  const { auditService } = await import('../../services/audit.service.js');
  await auditService.logJoinTeam(userEmail, team.id, { teamName: team.name, memberDisplayName: displayName });

  res.status(201).json({
    team: {
      id: team.id,
      name: team.name,
      description: team.description ?? undefined,
      createdAt: team.created_at,
      updatedAt: team.updated_at
    },
    membership: {
      role: 'member',
      email: userEmail
    }
  });
}));

/**
 * GET /teams/available
 * List all teams in the shared database that the user is NOT a member of
 */
teamsRouter.get('/available', asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'User email not found'
    });
    return;
  }

  const { query } = await import('../../db/shared-client.js');

  interface AvailableTeamRow {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    member_count: string;
  }

  const availableTeams = await query<AvailableTeamRow>(
    `SELECT 
      t.id, 
      t.name, 
      t.description, 
      t.created_at,
      COUNT(tm.id) as member_count
     FROM teams t
     LEFT JOIN team_members tm ON t.id = tm.team_id
     WHERE t.id NOT IN (
       SELECT team_id FROM team_members WHERE email = $1
     )
     GROUP BY t.id, t.name, t.description, t.created_at
     ORDER BY t.name`,
    [userEmail]
  );

  res.json({
    teams: availableTeams.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
      createdAt: t.created_at,
      memberCount: parseInt(t.member_count, 10)
    })),
    count: availableTeams.length
  });
}));

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

  const { query } = await import('../../db/shared-client.js');

  interface UserTeamRow {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    role: string;
  }

  const userTeams = await query<UserTeamRow>(
    `SELECT t.id, t.name, t.description, t.created_at, t.updated_at, tm.role
     FROM teams t
     JOIN team_members tm ON t.id = tm.team_id
     WHERE tm.email = $1
     ORDER BY t.name`,
    [userEmail]
  );

  res.json({
    teams: userTeams.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
      role: t.role,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    })),
    count: userTeams.length
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
  }

  const members = await query<MemberRow>(
    `SELECT id, email, display_name, role, joined_at
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
      joinedAt: m.joined_at
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
