/**
 * SSE hook for real-time team event streaming.
 *
 * Connects to GET /api/v1/teams/:teamId/events and invalidates
 * the appropriate TanStack Query cache keys on each incoming event.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { getApiHttpBaseUrl } from '@/lib/api-base-url';
import { queryKeys } from '@/lib/query-client';

interface TeamSSEEvent {
  type: 'connected' | 'team-event';
  resource?: 'task' | 'taskUpdate' | 'note' | 'project' | 'calendar' | 'wfh';
  action?: 'created' | 'updated' | 'deleted';
  resourceId?: string;
  parentId?: string;
  grandParentId?: string;
}

/**
 * Opens an SSE connection to the team events endpoint and invalidates
 * relevant query caches when events arrive from other users.
 *
 * Must be called inside a component that is mounted while the team view
 * is active (e.g. team project list or detail page).
 */
export function useTeamEventStream(teamId: string | undefined) {
  const qc = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!teamId) return;

    const token = localStorage.getItem('auth_access_token') ?? '';
    if (!token) return;

    let es: EventSource | null = null;
    let cancelled = false;

    void getApiHttpBaseUrl().then((baseUrl) => {
      if (cancelled) return;

      const url = `${baseUrl}/api/v1/teams/${encodeURIComponent(teamId)}/events?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as TeamSSEEvent;
          if (data.type !== 'team-event') return;
          invalidateForEvent(qc, teamId, data);
        } catch {
          // ignore malformed messages
        }
      };

      es.onerror = () => {
        // EventSource auto-reconnects; nothing extra needed
      };
    });

    return () => {
      cancelled = true;
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
    };
  }, [teamId, qc]);
}

// ---------------------------------------------------------------------------
// Cache invalidation mapping
// ---------------------------------------------------------------------------

function invalidateForEvent(
  qc: ReturnType<typeof useQueryClient>,
  teamId: string,
  event: TeamSSEEvent,
) {
  const { resource, resourceId, parentId, grandParentId } = event;

  switch (resource) {
    case 'project':
      // Refresh project list + specific project detail
      void qc.invalidateQueries({ queryKey: queryKeys.teamProjects.lists() });
      if (resourceId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.teamProjects.detail(teamId, resourceId),
        });
      }
      break;

    case 'task':
      // Refresh task list for the project + task detail
      void qc.invalidateQueries({ queryKey: queryKeys.teamTasks.lists() });
      if (parentId && resourceId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.teamTasks.detail(teamId, parentId, resourceId),
        });
      }
      // Task changes can affect project task counts
      void qc.invalidateQueries({ queryKey: queryKeys.teamProjects.lists() });
      break;

    case 'taskUpdate':
      // parentId = taskId, grandParentId = projectId
      if (grandParentId && parentId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.teamTaskUpdates.list(teamId, grandParentId, parentId),
        });
      } else {
        // Fallback: invalidate all task update lists
        void qc.invalidateQueries({ queryKey: queryKeys.teamTaskUpdates.lists() });
      }
      break;

    case 'note':
      // Refresh note list + note detail
      void qc.invalidateQueries({ queryKey: queryKeys.teamNotes.lists() });
      if (parentId && resourceId) {
        void qc.invalidateQueries({
          queryKey: queryKeys.teamNotes.detail(teamId, parentId, resourceId),
        });
        void qc.invalidateQueries({
          queryKey: queryKeys.teamNotes.revisions(teamId, parentId, resourceId),
        });
      }
      break;

    case 'calendar':
    case 'wfh':
      void qc.invalidateQueries({ queryKey: queryKeys.teamCalendar.all });
      break;
  }
}
