import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { searchApi } from '@/features/search/api/search';
import { queryKeys } from '@/lib/query-client';

const SEARCH_DEBOUNCE_MS = 300;

const useDebouncedValue = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
};

export const useGlobalSearch = (query: string, limitPerDomain = 5) => {
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, SEARCH_DEBOUNCE_MS);

  const searchQuery = useQuery({
    queryKey: queryKeys.search.global(debouncedQuery, limitPerDomain),
    queryFn: () => searchApi.searchAll(debouncedQuery, limitPerDomain),
    enabled: debouncedQuery.length >= 2,
    staleTime: 15 * 1000,
  });

  return {
    ...searchQuery,
    debouncedQuery,
  };
};