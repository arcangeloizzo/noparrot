import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export interface UserSearchResult {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

export const useUserSearch = (query: string) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ['user-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${debouncedQuery}%,full_name.ilike.%${debouncedQuery}%`)
        .limit(5);

      if (error) throw error;
      return data as UserSearchResult[];
    },
    enabled: debouncedQuery.length >= 2
  });
};
