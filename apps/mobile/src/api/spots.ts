import {
  SPOT_PHOTOS_BUCKET,
  vehicleTypeSchema,
  type Coordinates,
  type SpotInput,
  type SpotStatus,
  type VehicleType,
} from '@parkhere/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { photoUrl, syncSpotPhotos, type SpotPhoto } from '@/features/spots/photos';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/providers/auth-provider';

export type SearchArea = { center: Coordinates; radiusM: number };

export const spotKeys = {
  all: ['spots'] as const,
  nearby: (area: SearchArea, vehicleType: VehicleType | null) =>
    [
      ...spotKeys.all,
      'nearby',
      area.center.lat,
      area.center.lng,
      area.radiusM,
      vehicleType,
    ] as const,
  mine: (userId: string) => [...spotKeys.all, 'mine', userId] as const,
  detail: (spotId: string) => [...spotKeys.all, 'detail', spotId] as const,
  public: (spotId: string) => [...spotKeys.all, 'public', spotId] as const,
};

export function useNearbySpots(area: SearchArea, vehicleType: VehicleType | null) {
  return useQuery({
    queryKey: spotKeys.nearby(area, vehicleType),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('nearby_spots', {
        p_lat: area.center.lat,
        p_lng: area.center.lng,
        p_radius_m: area.radiusM,
        ...(vehicleType ? { p_vehicle_type: vehicleType } : {}),
      });
      if (error) throw error;
      return data.map(({ cover_photo_path, ...spot }) => ({
        ...spot,
        coverUrl: cover_photo_path ? photoUrl(cover_photo_path) : null,
      }));
    },
    // Keep showing the previous pins while the map moves to a new area.
    placeholderData: keepPreviousData,
  });
}

export type NearbySpot = NonNullable<ReturnType<typeof useNearbySpots>['data']>[number];

const publicSpotJsonSchema = z.object({
  availability: z.array(z.object({ weekday: z.number(), start: z.string(), end: z.string() })),
  photo_paths: z.array(z.string()),
  vehicle_types: z.array(vehicleTypeSchema),
});

/** A spot as drivers see it: rounded location, no address. */
export function usePublicSpot(spotId: string) {
  return useQuery({
    queryKey: spotKeys.public(spotId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_public_spot', { p_spot_id: spotId })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('SPOT_NOT_FOUND');
      const json = publicSpotJsonSchema.parse(data);
      return {
        ...data,
        availability: json.availability,
        vehicle_types: json.vehicle_types,
        photoUrls: json.photo_paths.map(photoUrl),
      };
    },
  });
}

export type PublicSpot = NonNullable<ReturnType<typeof usePublicSpot>['data']>;

export function useMySpots() {
  const userId = useUserId();
  return useQuery({
    queryKey: spotKeys.mine(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spots')
        .select(
          'id, title, area_label, status, hourly_rate_paise, rating_avg, rating_count, spot_photos(storage_path, sort_order)',
        )
        .eq('host_id', userId)
        .order('created_at', { ascending: false })
        .order('sort_order', { referencedTable: 'spot_photos' })
        .limit(1, { referencedTable: 'spot_photos' });
      if (error) throw error;
      return data.map(({ spot_photos, ...spot }) => ({
        ...spot,
        coverUrl: spot_photos[0] ? photoUrl(spot_photos[0].storage_path) : null,
      }));
    },
  });
}

// get_my_spot returns opening hours and photos as JSON; validate their shape.
const spotDetailJsonSchema = z.object({
  availability: z.array(z.object({ weekday: z.number(), start: z.string(), end: z.string() })),
  photos: z.array(z.object({ id: z.string(), path: z.string() })),
  vehicle_types: z.array(vehicleTypeSchema),
});

export function useMySpot(spotId: string) {
  return useQuery({
    queryKey: spotKeys.detail(spotId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_my_spot', { p_spot_id: spotId })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('SPOT_NOT_FOUND');
      const json = spotDetailJsonSchema.parse(data);
      return {
        ...data,
        availability: json.availability,
        vehicle_types: json.vehicle_types,
        photos: json.photos.map((photo): SpotPhoto => ({
          kind: 'remote',
          ...photo,
          url: photoUrl(photo.path),
        })),
      };
    },
  });
}

export type MySpot = NonNullable<ReturnType<typeof useMySpot>['data']>;

// Generated types mark every SQL function argument as non-null, but these
// columns are optional: the SQL functions turn null/'' into NULL.
const SQL_NULL = null as unknown as number;

function toSpotArgs(input: SpotInput) {
  return {
    p_title: input.title,
    p_description: input.description ?? '',
    p_area_label: input.areaLabel ?? '',
    p_vehicle_types: input.vehicleTypes,
    p_is_covered: input.isCovered,
    p_has_cctv: input.hasCctv,
    p_has_ev_charging: input.hasEvCharging,
    p_has_security_guard: input.hasSecurityGuard,
    p_max_height_cm: input.maxHeightCm ?? SQL_NULL,
    p_hourly_rate_paise: input.hourlyRatePaise,
    p_instant_book: input.instantBook,
    p_lat: input.location.lat,
    p_lng: input.location.lng,
    p_address: input.address,
    p_access_instructions: input.accessInstructions ?? '',
    p_availability: input.availability,
  };
}

type SaveSpotVariables = { input: SpotInput; photos: SpotPhoto[] };
/** photosFailed: the spot saved, but uploading or removing photos did not. */
type SaveSpotResult = { spotId: string; photosFailed: boolean };

async function syncPhotosSafely(
  userId: string,
  spotId: string,
  photos: SpotPhoto[],
  original: SpotPhoto[],
): Promise<boolean> {
  try {
    await syncSpotPhotos(userId, spotId, photos, original);
    return false;
  } catch {
    return true;
  }
}

export function useCreateSpot() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, photos }: SaveSpotVariables): Promise<SaveSpotResult> => {
      const { data: spotId, error } = await supabase.rpc('create_spot', toSpotArgs(input));
      if (error) throw error;
      const photosFailed = await syncPhotosSafely(userId, spotId, photos, []);
      return { spotId, photosFailed };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spotKeys.all }),
  });
}

export function useUpdateSpot(spot: MySpot) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, photos }: SaveSpotVariables): Promise<SaveSpotResult> => {
      const { error } = await supabase.rpc('update_spot', {
        p_spot_id: spot.id,
        ...toSpotArgs(input),
      });
      if (error) throw error;
      const photosFailed = await syncPhotosSafely(userId, spot.id, photos, spot.photos);
      return { spotId: spot.id, photosFailed };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spotKeys.all }),
  });
}

export function useSetSpotStatus(spotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: Extract<SpotStatus, 'active' | 'paused'>) => {
      const { error } = await supabase.from('spots').update({ status }).eq('id', spotId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spotKeys.all }),
  });
}

export function useDeleteSpot(spot: MySpot) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('spots').delete().eq('id', spot.id);
      // Bookings reference the spot, so a spot with booking history can't be deleted.
      if (error?.code === '23503') throw new Error('SPOT_HAS_BOOKINGS');
      if (error) throw error;
      const paths = spot.photos.flatMap((photo) => (photo.kind === 'remote' ? [photo.path] : []));
      if (paths.length > 0) await supabase.storage.from(SPOT_PHOTOS_BUCKET).remove(paths);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spotKeys.all }),
  });
}
