import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useUserId } from '@/providers/auth-provider';
import type { AppMode } from '@/stores/app-mode';

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (userId: string, mode: AppMode) => [...bookingKeys.all, 'list', userId, mode] as const,
};

/** Driver mode: trips I booked. Host mode: bookings at my spots (RLS limits rows to those). */
export function useMyBookings(mode: AppMode) {
  const userId = useUserId();
  return useQuery({
    queryKey: bookingKeys.list(userId, mode),
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(
          'id, status, kind, during, total_paise, hourly_rate_paise, checkin_code, expires_at, spot:spots(title, area_label)',
        )
        .order('created_at', { ascending: false })
        .limit(50);
      query = mode === 'driver' ? query.eq('driver_id', userId) : query.neq('driver_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Live updates: refetch booking lists whenever one of my bookings changes
 * (offer accepted, expired, checked in...). Realtime enforces the bookings RLS
 * policy, so only rows this user may see are delivered.
 */
export function useBookingsRealtime() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`bookings:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
