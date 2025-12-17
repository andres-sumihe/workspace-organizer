/**
 * Teams API client
 * Handles all team-related HTTP requests
 */

import { apiRequest } from './client';

import type { TeamRole } from '@workspace/shared';

export interface TeamSummary {
  id: string;
  name: string;
  description?: string;
  role: TeamRole;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDetail {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMembership {
  role: TeamRole;
  email: string;
}

export interface TeamWithMembership {
  team: TeamDetail;
  membership: TeamMembership;
}

export interface TeamMemberDetail {
  id: string;
  email: string;
  displayName?: string;
  role: TeamRole;
  joinedAt: string;
  lastActiveAt?: string;
}

export interface ListTeamsResponse {
  teams: TeamSummary[];
  count: number;
}

export interface ListMembersResponse {
  members: TeamMemberDetail[];
  count: number;
}

export interface UpdateMemberRoleResponse {
  success: boolean;
  member: {
    id: string;
    email: string;
    displayName?: string;
    role: TeamRole;
  };
}

export interface AvailableTeam {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  memberCount: number;
}

export interface AvailableTeamsResponse {
  teams: AvailableTeam[];
  count: number;
}

/**
 * Get all teams the authenticated user belongs to
 */
export function listTeams(): Promise<ListTeamsResponse> {
  return apiRequest<ListTeamsResponse>('/api/v1/teams');
}

/**
 * Get a specific team with membership details
 */
export function getTeam(teamId: string): Promise<TeamWithMembership> {
  return apiRequest<TeamWithMembership>(`/api/v1/teams/${teamId}`);
}

/**
 * Get all members of a team
 */
export function listMembers(teamId: string): Promise<ListMembersResponse> {
  return apiRequest<ListMembersResponse>(`/api/v1/teams/${teamId}/members`);
}

/**
 * Update a team member's role
 */
export function updateMemberRole(
  teamId: string,
  memberId: string,
  role: TeamRole
): Promise<UpdateMemberRoleResponse> {
  return apiRequest<UpdateMemberRoleResponse>(
    `/api/v1/teams/${teamId}/members/${memberId}/role`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role })
    }
  );
}

/**
 * Remove a member from a team
 */
export async function removeMember(teamId: string, memberId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/teams/${teamId}/members/${memberId}`, {
    method: 'DELETE'
  });
}

/**
 * Create a new team
 */
export function createTeam(data: { name: string; description?: string }): Promise<TeamWithMembership> {
  return apiRequest<TeamWithMembership>('/api/v1/teams', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Join an existing team by name
 */
export function joinTeam(teamId: string): Promise<TeamWithMembership> {
  return apiRequest<TeamWithMembership>('/api/v1/teams/join', {
    method: 'POST',
    body: JSON.stringify({ teamId })
  });
}

/**
 * Get all available teams that the user can join
 */
export function listAvailableTeams(): Promise<AvailableTeamsResponse> {
  return apiRequest<AvailableTeamsResponse>('/api/v1/teams/available');
}
