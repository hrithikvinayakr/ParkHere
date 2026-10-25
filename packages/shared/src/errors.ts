// Error codes raised by the database functions, mapped to user-facing messages.

export const API_ERROR_MESSAGES = {
  NOT_AUTHENTICATED: 'Please sign in again.',
  INVALID_COORDINATES: 'That location looks invalid.',
  INVALID_TIME_RANGE: 'The end time must be after the start time.',
  INVALID_DURATION: 'Bookings must be between 30 minutes and 24 hours.',
  INVALID_START_TIME: 'Choose a start time between now and 14 days ahead.',
  OUTSIDE_AVAILABILITY: "The spot isn't open for that whole time.",
  SPOT_NOT_AVAILABLE: 'This spot is no longer available.',
  CANNOT_BOOK_OWN_SPOT: "You can't book your own spot.",
  VEHICLE_NOT_FOUND: 'Choose one of your vehicles.',
  VEHICLE_TYPE_NOT_ALLOWED: "This spot doesn't accept that vehicle type.",
  OFFER_TOO_LOW: 'Offers must be at least half the listed rate.',
  TOO_MANY_PENDING_OFFERS: 'You already have 3 offers waiting. Wait for a reply first.',
  SLOT_TAKEN: 'Someone just booked this time. Try another time or spot.',
  BOOKING_NOT_FOUND: "We couldn't find that booking.",
  INVALID_BOOKING_STATUS: "This booking can't be changed right now.",
  OFFER_EXPIRED: 'This offer has expired.',
  OUTSIDE_CHECK_IN_WINDOW: 'Check-in opens 15 minutes before your booking starts.',
  REVIEW_NOT_ALLOWED: 'You can review a booking within 14 days of completing it.',
  INVALID_RATING: 'Choose a rating from 1 to 5.',
  ALREADY_REVIEWED: "You've already reviewed this booking.",
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_MESSAGES;

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && Object.hasOwn(API_ERROR_MESSAGES, value);
}

/** Turns any thrown value (Supabase/PostgREST error, Error, string) into a safe message. */
export function toUserMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message: unknown }).message
      : error;
  if (isApiErrorCode(message)) return API_ERROR_MESSAGES[message];
  return 'Something went wrong. Please try again.';
}
