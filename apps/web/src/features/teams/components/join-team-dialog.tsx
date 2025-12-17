import { Loader2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { AvailableTeam } from '@/api/teams';

import { listAvailableTeams } from '@/api/teams';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

export interface JoinTeamFormValues {
  teamId: string;
}

interface JoinTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (teamId: string) => Promise<void>;
  isBackendReady?: boolean;
}

export const JoinTeamDialog = ({
  open,
  onOpenChange,
  onSubmit,
  isBackendReady = false
}: JoinTeamDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<AvailableTeam[]>([]);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<JoinTeamFormValues>({
    defaultValues: {
      teamId: ''
    }
  });

  // Load available teams when dialog opens
  useEffect(() => {
    if (open && isBackendReady) {
      setIsLoadingTeams(true);
      listAvailableTeams()
        .then((response) => {
          setAvailableTeams(response.teams);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load teams');
        })
        .finally(() => {
          setIsLoadingTeams(false);
        });
    }
  }, [open, isBackendReady]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!values.teamId) {
      setError('Please select a team');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(values.teamId);
      form.reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        form.reset();
        setError(null);
        setAvailableTeams([]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Join Team
          </DialogTitle>
          <DialogDescription>
            Select an existing team from the shared database to join.
          </DialogDescription>
        </DialogHeader>

        {!isBackendReady ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Joining teams is not yet available. This feature will be enabled in an upcoming release.
            </p>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="teamId"
                rules={{ required: 'Please select a team' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Teams</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting || isLoadingTeams}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingTeams ? 'Loading teams...' : 'Select a team to join'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableTeams.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            {isLoadingTeams ? 'Loading...' : 'No teams available to join'}
                          </div>
                        ) : (
                          availableTeams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{team.name}</span>
                                {team.description && (
                                  <span className="text-xs text-muted-foreground">{team.description}</span>
                                )}
                                <span className="text-xs text-muted-foreground">{team.memberCount} members</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || availableTeams.length === 0}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join Team'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
