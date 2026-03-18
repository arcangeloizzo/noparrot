import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useAdminRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return { isAdmin: false, isModerator: false, role: 'user' as const };

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return { isAdmin: false, isModerator: false, role: 'user' as const };
      }

      const role = data?.role || 'user';
      return {
        isAdmin: role === 'admin',
        isModerator: role === 'moderator',
        isStaff: role === 'admin' || role === 'moderator',
        role
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
