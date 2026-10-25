// Business rules shared by the app. The database enforces the same values in
// supabase/migrations/20261026090200_booking_functions.sql — change both together.

export const BOOKING_MIN_MINUTES = 30;
export const BOOKING_MAX_MINUTES = 24 * 60;
export const BOOKING_MAX_DAYS_AHEAD = 14;

export const OFFER_TTL_SECONDS = 3 * 60;
/** Offers must be at least this fraction of the listed hourly rate. */
export const OFFER_MIN_RATE_RATIO = 0.5;
export const MAX_PENDING_OFFERS = 3;

export const CHECK_IN_OPENS_MINUTES_BEFORE = 15;
export const NO_SHOW_AFTER_MINUTES = 15;
export const OVERSTAY_GRACE_MINUTES = 5;

export const HOURLY_RATE_MIN_PAISE = 500;
export const HOURLY_RATE_MAX_PAISE = 100_000;

export const SEARCH_DEFAULT_RADIUS_M = 2000;
export const SEARCH_MAX_RADIUS_M = 10_000;

export const SPOT_PHOTOS_BUCKET = 'spot-photos';
