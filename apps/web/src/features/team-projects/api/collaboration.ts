/**
 * Collaboration API client
 */

import { apiClient } from '@/api/client';

import type { CollaborationStatusResponse } from '@workspace/shared';

export const fetchCollaborationStatus = () => {
  return apiClient.get<CollaborationStatusResponse>('/api/v1/collaboration/status');
};
