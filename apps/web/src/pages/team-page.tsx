import { Users, Loader2, AlertCircle, UserPlus, Plus, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { TeamSummary, TeamWithMembership, TeamMemberDetail } from '@/api/teams';
import type { TeamRole } from '@workspace/shared';

import { listTeams, getTeam, listMembers, updateMemberRole, removeMember, createTeam, joinTeam } from '@/api/teams';
import { PageShell } from '@/components/layout/page-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { useMode } from '@/contexts/mode-context';
import { CreateTeamDialog, JoinTeamDialog } from '@/features/teams';

export const TeamPage = () => {
  const { teamId } = useParams<{ teamId?: string }>();
  const navigate = useNavigate();
  const { isSoloMode, isSharedMode } = useMode();

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembership | null>(null);
  const [members, setMembers] = useState<TeamMemberDetail[]>([]);
  
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Confirm remove member dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMemberDetail | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('Team Page State:', { isSoloMode, isSharedMode, teams: teams.length, isLoadingTeams });
  }, [isSoloMode, isSharedMode, teams, isLoadingTeams]);

  // Load teams list
  useEffect(() => {
    if (!isSharedMode) {
      setIsLoadingTeams(false);
      return;
    }

    const loadTeams = async () => {
      try {
        setIsLoadingTeams(true);
        setError(null);
        const response = await listTeams();
        setTeams(response.teams);
        
        // Auto-select team from URL or first team
        if (teamId && response.teams.some(t => t.id === teamId)) {
          // Will be loaded by next effect
        } else if (response.teams.length > 0 && !teamId) {
          navigate(`/teams/${response.teams[0].id}`, { replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load teams');
      } finally {
        setIsLoadingTeams(false);
      }
    };

    loadTeams();
  }, [isSharedMode, teamId, navigate]);

  // Load selected team details
  useEffect(() => {
    if (!teamId || !isSharedMode) {
      setSelectedTeam(null);
      return;
    }

    const loadTeam = async () => {
      try {
        setIsLoadingTeam(true);
        setError(null);
        const teamData = await getTeam(teamId);
        setSelectedTeam(teamData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team');
      } finally {
        setIsLoadingTeam(false);
      }
    };

    loadTeam();
  }, [teamId, isSharedMode]);

  // Load team members
  useEffect(() => {
    if (!teamId || !isSharedMode) {
      setMembers([]);
      return;
    }

    const loadMembers = async () => {
      try {
        setIsLoadingMembers(true);
        setError(null);
        const response = await listMembers(teamId);
        setMembers(response.members);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load members');
      } finally {
        setIsLoadingMembers(false);
      }
    };

    loadMembers();
  }, [teamId, isSharedMode]);

  const handleRoleChange = async (memberId: string, newRole: TeamRole) => {
    if (!teamId) return;

    try {
      setError(null);
      await updateMemberRole(teamId, memberId, newRole);
      setSuccessMessage('Member role updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Refresh members list
      const response = await listMembers(teamId);
      setMembers(response.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleRemoveMember = async (memberId: string, _memberName: string) => {
    if (!teamId) return;

    try {
      setError(null);
      await removeMember(teamId, memberId);
      setSuccessMessage('Member removed successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Refresh members list
      const response = await listMembers(teamId);
      setMembers(response.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
      setTimeout(() => setError(null), 5000);
    } finally {
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
    }
  };

  const handleConfirmRemove = (member: TeamMemberDetail) => {
    setMemberToRemove(member);
    setRemoveDialogOpen(true);
  };

  // Filter teams by search query (with null safety)
  const filteredTeams = teams.filter(
    (team) => {
      if (!team || !team.name) return false;
      const nameMatch = team.name.toLowerCase().includes(searchQuery.toLowerCase());
      const descMatch = team.description ? team.description.toLowerCase().includes(searchQuery.toLowerCase()) : false;
      return nameMatch || descMatch;
    }
  );

  const canChangeRole = (targetRole: TeamRole): boolean => {
    const myRole = selectedTeam?.membership.role;
    if (!myRole) return false;
    
    if (myRole === 'owner') return true;
    if (myRole === 'admin' && targetRole !== 'owner') return true;
    return false;
  };

  const canRemoveMember = (targetRole: TeamRole): boolean => {
    const myRole = selectedTeam?.membership.role;
    if (!myRole) return false;
    
    if (myRole === 'owner' && targetRole !== 'owner') return true;
    if (myRole === 'admin' && targetRole === 'member') return true;
    return false;
  };

  // Solo mode guard
  if (isSoloMode) {
    return (
      <PageShell
        title="Teams"
        description="Team features are only available in Shared mode"
      >
        <Card className="p-8 text-center">
          <Users className="mx-auto size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Team Features Disabled</h3>
          <p className="text-muted-foreground mb-6">
            You are currently in Solo mode. Enable Shared mode in Settings to access team features.
          </p>
          <Button onClick={() => navigate('/settings')}>
            <SettingsIcon className="size-4 mr-2" />
            Go to Settings
          </Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Teams"
      description="Manage your teams and members"
      toolbar={
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Team Management</span>
          <Badge variant={isSharedMode ? 'default' : 'secondary'} className="ml-2">
            {isSharedMode ? 'Shared Mode' : 'Solo Mode'}
          </Badge>
        </div>
      }
    >
      {/* Conditional layout based on teams presence */}
      {isLoadingTeams ? (
        <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
          <Card className="w-full h-full flex items-center justify-center">
            <CardContent>
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      ) : teams.length === 0 ? (
        <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
          <Card className="w-full h-full flex items-center justify-center">
            <CardContent className="flex flex-col items-center text-center py-12">
              <Users className="size-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Teams</h3>
              <p className="text-sm text-muted-foreground mb-6">Create or join a team to get started</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>
                  <UserPlus className="size-4 mr-2" />
                  Join Team
                </Button>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="size-4 mr-2" />
                  Create Team
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex gap-6 h-[calc(100vh-12rem)]">
          {/* Left Panel: Teams List */}
          <Card className="w-80 shrink-0 flex flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base font-semibold">Your Teams</CardTitle>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setJoinDialogOpen(true)}
                    >
                      <UserPlus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Join Team</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create Team</TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
              {/* Search */}
              <div className="mb-4">
                <Input
                  placeholder="Search teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9"
                />
              </div>

              {filteredTeams.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">No teams match your search</p>
                </div>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {filteredTeams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => navigate(`/teams/${team.id}`)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        teamId === team.id
                          ? 'bg-primary/10 border-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium text-sm">{team.name}</div>
                      {team.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          {team.description}
                        </div>
                      )}
                      <Badge variant="secondary" className="mt-2 text-xs capitalize">
                        {team.role}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Panel: Team Details */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            {!selectedTeam ? (
              <CardContent className="flex items-center justify-center h-full">
                {isLoadingTeam ? (
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-muted-foreground">Select a team from the left</p>
                )}
              </CardContent>
            ) : (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedTeam.team.name}</CardTitle>
                      {selectedTeam.team.description && (
                        <p className="text-sm text-muted-foreground mt-1">{selectedTeam.team.description}</p>
                      )}
                    </div>
                    <Badge variant="default" className="capitalize">Your role: {selectedTeam.membership.role}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                  {successMessage && (
                    <Alert className="m-4 mb-0 bg-success/10 text-success border-success/20">
                      <AlertDescription>{successMessage}</AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert variant="destructive" className="m-4 mb-0">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Tabs defaultValue="members" className="flex-1 flex flex-col overflow-hidden px-6 pt-4 pb-6">
                <TabsList className="w-fit">
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="overview" disabled>Overview</TabsTrigger>
                  <TabsTrigger value="settings" disabled>Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="flex-1 overflow-y-auto mt-4">
                  {isLoadingMembers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">
                        {selectedTeam.membership.role === 'member'
                          ? 'You can view members but cannot change roles or remove others.'
                          : 'Manage team members and their roles.'}
                      </div>

                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="border-b bg-muted/50">
                            <tr>
                              <th className="text-left p-3 text-sm font-medium">Name</th>
                              <th className="text-left p-3 text-sm font-medium">Email</th>
                              <th className="text-left p-3 text-sm font-medium">Role</th>
                              <th className="text-left p-3 text-sm font-medium">Joined</th>
                              <th className="text-right p-3 text-sm font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map((member) => (
                              <tr key={member.id} className="border-b last:border-b-0 hover:bg-muted/30">
                                <td className="p-3 text-sm font-medium">{member.displayName || '-'}</td>
                                <td className="p-3 font-mono text-xs text-muted-foreground">{member.email}</td>
                                <td className="p-3">
                                  {canChangeRole(member.role) ? (
                                    <Select
                                      value={member.role}
                                      onValueChange={(value) => handleRoleChange(member.id, value as TeamRole)}
                                    >
                                      <SelectTrigger className="w-28 h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="member">Member</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        {selectedTeam.membership.role === 'owner' && (
                                          <SelectItem value="owner">Owner</SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge
                                      variant={
                                        member.role === 'owner'
                                          ? 'default'
                                          : member.role === 'admin'
                                            ? 'secondary'
                                            : 'outline'
                                      }
                                      className="capitalize"
                                    >
                                      {member.role}
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-3 text-sm text-muted-foreground">
                                  {new Date(member.joinedAt).toLocaleDateString()}
                                </td>
                                <td className="p-3 text-right">
                                  {canRemoveMember(member.role) && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => handleConfirmRemove(member)}
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Remove member</TooltipContent>
                                    </Tooltip>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="overview" className="mt-4">
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      Overview tab coming soon. Will show team statistics and activity.
                    </AlertDescription>
                  </Alert>
                </TabsContent>

                <TabsContent value="settings" className="mt-4">
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      Settings tab coming soon. Team owners will be able to update team details here.
                    </AlertDescription>
                  </Alert>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
        </div>
      )}

      {/* Create Team Dialog */}
      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={async (data) => {
          const result = await createTeam(data);
          setTeams([...teams, { ...result.team, role: result.membership.role as TeamRole }]);
          navigate(`/teams/${result.team.id}`);
        }}
        isBackendReady={true}
      />

      {/* Join Team Dialog */}
      <JoinTeamDialog
        open={joinDialogOpen}
        onOpenChange={setJoinDialogOpen}
        onSubmit={async (teamId: string) => {
          const result = await joinTeam(teamId);
          setTeams([...teams, { ...result.team, role: result.membership.role as TeamRole }]);
          navigate(`/teams/${result.team.id}`);
        }}
        isBackendReady={true}
      />

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium">
                {memberToRemove?.displayName || memberToRemove?.email}
              </span>{' '}
              from this team? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (memberToRemove) {
                  handleRemoveMember(memberToRemove.id, memberToRemove.displayName || memberToRemove.email);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};
