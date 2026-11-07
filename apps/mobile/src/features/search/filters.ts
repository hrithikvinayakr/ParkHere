import type { VehicleType } from '@parkhere/shared';

import type { NearbySpot } from '@/api/spots';

export type SearchFilters = {
  /** Sent to the database; the rest are applied on the (at most 100) results. */
  vehicleType: VehicleType | null;
  coveredOnly: boolean;
  evOnly: boolean;
  maxRatePaise: number | null;
};

export const NO_FILTERS: SearchFilters = {
  vehicleType: null,
  coveredOnly: false,
  evOnly: false,
  maxRatePaise: null,
};

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.vehicleType !== null ||
    filters.coveredOnly ||
    filters.evOnly ||
    filters.maxRatePaise !== null
  );
}

export function applyFilters(spots: NearbySpot[], filters: SearchFilters): NearbySpot[] {
  return spots.filter(
    (spot) =>
      (!filters.coveredOnly || spot.is_covered) &&
      (!filters.evOnly || spot.has_ev_charging) &&
      (filters.maxRatePaise === null || spot.hourly_rate_paise <= filters.maxRatePaise),
  );
}
