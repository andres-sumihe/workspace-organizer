import { Users, Loader2, AlertCircle, UserPlus, Plus, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { TeamWithMembership, TeamMemberDetail } from '@/api/teams';
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
  const navigate = useNavigate();
  const { isSoloMode, isSharedMode } = useMode();

  const [currentTeam, setCurrentTeam] = useState<TeamWithMembership | null>(null);
  const [members, setMembers] = useState<TeamMemberDetail[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  
  // Confirm remove member dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMemberDetail | null>(null);

  // Load user's team (users can only be in ONE team)
  useEffect(() => {
    if (!isSharedMode) {
      setIsLoading(false);
      return;
    }

    const loadUserTeam = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get user's teams - should be 0 or 1
        const response = await listTeams();
        
        if (response.teams.length > 0) {
          // User has a team - load full details
          const teamData = await getTeam(response.teams[0].id);
          setCurrentTeam(teamData);
        } else {
          setCurrentTeam(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserTeam();
  }, [isSharedMode]);

  // Load team members when team is loaded
  useEffect(() => {
    if (!currentTeam || !isSharedMode) {
      setMembers([]);
      return;
    }

    const loadMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const response = await listMembers(currentTeam.team.id);
        setMembers(response.members);
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    loadMembers();
  }, [currentTeam, isSharedMode]);

  const handleRoleChange = async (memberId: string, newRole: TeamRole) => {
    if (!currentTeam) return;

    try {
      setError(null);
      await updateMemberRole(currentTeam.team.id, memberId, newRole);
      setSuccessMessage('Member role updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Refresh members list
      const response = await listMembers(currentTeam.team.id);
      setMembers(response.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentTeam) return;

    try {
      setError(null);
      await removeMember(currentTeam.team.id, memberId);
      setSuccessMessage('Member removed successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Refresh members list
      const response = await listMembers(currentTeam.team.id);
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

  const handleCreateTeam = async (data: { name: string; description?: string }) => {
    const result = await createTeam(data);
    const teamData = await getTeam(result.team.id);
    setCurrentTeam(teamData);
  };

  const handleJoinTeam = async (teamId: string) => {
    await joinTeam(teamId);
    const teamData = await getTeam(teamId);
    setCurrentTeam(teamData);
  };

  const canChangeRole = (targetRole: TeamRole): boolean => {
    const myRole = currentTeam?.membership.role;
    if (!myRole) return false;
    
    if (myRole === 'owner') return true;
    if (myRole === 'admin' && targetRole !== 'owner') return true;
    return false;
  };

  const canRemoveMember = (targetRole: TeamRole): boolean => {
    const myRole = currentTeam?.membership.role;
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

  // Loading state
  if (isLoading) {
    return (
      <PageShell
        title="Teams"
        description="Manage your team and members"
        toolbar={
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Team Management</span>
            <Badge variant="default" className="ml-2">Shared Mode</Badge>
          </div>
        }
      >
        <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
          <Card className="w-full h-full flex items-center justify-center">
            <CardContent>
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // No team - show create/join options
  if (!currentTeam) {
    return (
      <PageShell
        title="Teams"
        description="Join or create a team to collaborate"
        toolbar={
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Team Management</span>
            <Badge variant="default" className="ml-2">Shared Mode</Badge>
          </div>
        }
      >
        <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center text-center py-12">
              <Users className="size-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">You're not in a team yet</h3>
              <p className="text-sm text-muted-foreground mb-8">
                Create your own team or join an existing one to start collaborating with others.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="lg" onClick={() => setJoinDialogOpen(true)}>
                  <UserPlus className="size-4 mr-2" />
                  Join a Team
                </Button>
                <Button size="lg" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="size-4 mr-2" />
                  Create Team
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Team Dialog */}
        <CreateTeamDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={handleCreateTeam}
          isBackendReady={true}
        />

        {/* Join Team Dialog */}
        <JoinTeamDialog
          open={joinDialogOpen}
          onOpenChange={setJoinDialogOpen}
          onSubmit={handleJoinTeam}
          isBackendReady={true}
        />
      </PageShell>
    );
  }

  // Has team - show team details directly
  return (
    <PageShell
      title="Teams"
      description="Manage your team and members"
      toolbar={
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Team Management</span>
          <Badge variant="default" className="ml-2">Shared Mode</Badge>
        </div>
      }
    >
      <Card className="h-[calc(100vh-12rem)] flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{currentTeam.team.name}</CardTitle>
              {currentTeam.team.description && (
                <p className="text-sm text-muted-foreground mt-1">{currentTeam.team.description}</p>
              )}
            </div>
            <Badge variant="outline" className="capitalize">Your Role: {currentTeam.membership.role}</Badge>
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
                    {currentTeam.membership.role === 'member'
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
                                    {currentTeam.membership.role === 'owner' && (
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
      </Card>

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
                  handleRemoveMember(memberToRemove.id);
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
