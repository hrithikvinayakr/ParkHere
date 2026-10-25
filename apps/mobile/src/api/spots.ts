import { SEARCH_DEFAULT_RADIUS_M, type Coordinates } from '@parkhere/shared';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useUserId } from '@/providers/auth-provider';

export const spotKeys = {
  all: ['spots'] as const,
  nearby: (center: Coordinates, radiusM: number) =>
    [...spotKeys.all, 'nearby', center.lat, center.lng, radiusM] as const,
  mine: (userId: string) => [...spotKeys.all, 'mine', userId] as const,
};

export function useNearbySpots(center: Coordinates, radiusM = SEARCH_DEFAULT_RADIUS_M) {
  return useQuery({
    queryKey: spotKeys.nearby(center, radiusM),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('nearby_spots', {
        p_lat: center.lat,
        p_lng: center.lng,
        p_radius_m: radiusM,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useMySpots() {
  const userId = useUserId();
  return useQuery({
    queryKey: spotKeys.mine(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spots')
        .select('id, title, area_label, status, hourly_rate_paise, rating_avg, rating_count')
        .eq('host_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
