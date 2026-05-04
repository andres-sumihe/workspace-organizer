import { useQuery } from '@tanstack/react-query';

import { getTeam, listTeams } from '@/features/teams/api/teams';
import { queryKeys } from '@/lib/query-client';

export function useCurrentTeam(enabled = true) {
  return useQuery({
    queryKey: queryKeys.teams.current(),
    queryFn: async () => {
      const teamsResponse = await listTeams();
      const firstTeam = teamsResponse.teams[0];
      if (!firstTeam) {
        return null;
      }
      return getTeam(firstTeam.id);
    },
    enabled,
    staleTime: 30_000,
  });
}
