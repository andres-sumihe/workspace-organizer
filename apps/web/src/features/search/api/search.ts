import type { GlobalSearchResponse } from '@workspace/shared';

import { apiClient } from '@/api/client';

interface GlobalSearchEnvelope {
  data: GlobalSearchResponse;
}

export const searchApi = {
  searchAll: async (query: string, limitPerDomain = 5): Promise<GlobalSearchResponse> => {
    const response = await apiClient.get<GlobalSearchEnvelope>('/api/v1/search', {
      query: {
        q: query,
        limit: limitPerDomain,
      },
    });

    return response.data;
  },
};