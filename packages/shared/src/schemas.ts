import { z } from 'zod';

import {
  BOOKING_MAX_MINUTES,
  BOOKING_MIN_MINUTES,
  HOURLY_RATE_MAX_PAISE,
  HOURLY_RATE_MIN_PAISE,
} from './constants';

// Client-side validation. The database re-checks everything; these schemas exist
// so users get instant feedback and requests are well-formed.

export const vehicleTypeSchema = z.enum(['two_wheeler', 'car', 'suv']);

/** Accepts "ka 01 ab 1234" and normalises it to "KA01AB1234". */
export const plateNumberSchema = z
  .string()
  .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .pipe(z.string().regex(/^[A-Z0-9]{4,12}$/, 'Enter a valid number plate'));

export const vehicleInputSchema = z.object({
  plateNumber: plateNumberSchema,
  type: vehicleTypeSchema,
  makeModel: z.string().trim().max(60).optional(),
});
export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

export const spotInputSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(1000).optional(),
  areaLabel: z.string().trim().max(120).optional(),
  vehicleTypes: z.array(vehicleTypeSchema).min(1, 'Choose at least one vehicle type'),
  isCovered: z.boolean(),
  hasCctv: z.boolean(),
  hasEvCharging: z.boolean(),
  hasSecurityGuard: z.boolean(),
  maxHeightCm: z.number().int().min(100).max(500).optional(),
  hourlyRatePaise: z.number().int().min(HOURLY_RATE_MIN_PAISE).max(HOURLY_RATE_MAX_PAISE),
  instantBook: z.boolean(),
  location: coordinatesSchema,
  address: z.string().trim().min(5).max(300),
  accessInstructions: z.string().trim().max(1000).optional(),
});
export type SpotInput = z.infer<typeof spotInputSchema>;

export const bookingRequestSchema = z
  .object({
    spotId: z.uuid(),
    vehicleId: z.uuid(),
    startsAt: z.date(),
    endsAt: z.date(),
    offeredRatePaise: z.number().int().positive().optional(),
  })
  .refine(
    ({ startsAt, endsAt }) => {
      const minutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
      return minutes >= BOOKING_MIN_MINUTES && minutes <= BOOKING_MAX_MINUTES;
    },
    { message: 'Bookings must be between 30 minutes and 24 hours', path: ['endsAt'] },
  );
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));
export const otpSchema = z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code');
