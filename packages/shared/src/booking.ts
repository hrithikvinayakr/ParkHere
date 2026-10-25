import type { Enums } from './database.types';

export type BookingStatus = Enums<'booking_status'>;
export type BookingKind = Enums<'booking_kind'>;
export type VehicleType = Enums<'vehicle_type'>;
export type SpotStatus = Enums<'spot_status'>;

/** Statuses that hold the time slot (the database exclusion constraint uses the same set). */
export const ACTIVE_BOOKING_STATUSES = [
  'requested',
  'confirmed',
  'checked_in',
] as const satisfies readonly BookingStatus[];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: 'Waiting for host',
  confirmed: 'Confirmed',
  checked_in: 'Parked',
  completed: 'Completed',
  rejected: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  two_wheeler: 'Two-wheeler',
  car: 'Car',
  suv: 'SUV',
};

export function isActiveBooking(status: BookingStatus): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly BookingStatus[]).includes(status);
}

/**
 * Parses a Postgres tstzrange such as `["2026-10-26 10:00:00+00","2026-10-26 12:00:00+00")`.
 * Hermes cannot parse Postgres timestamps directly, so they are normalised to ISO 8601.
 */
export function parseTimeRange(range: string): { start: Date; end: Date } {
  const match = /^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(range.trim());
  if (!match?.[1] || !match[2]) throw new Error(`Invalid time range: ${range}`);
  const toIso = (value: string) => value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  return { start: new Date(toIso(match[1])), end: new Date(toIso(match[2])) };
}
