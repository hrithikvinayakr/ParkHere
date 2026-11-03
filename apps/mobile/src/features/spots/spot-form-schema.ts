import {
  availabilityRuleSchema,
  clockTimeSchema,
  coordinatesSchema,
  HOURLY_RATE_MAX_PAISE,
  HOURLY_RATE_MIN_PAISE,
  rupeesToPaise,
  vehicleTypeSchema,
  type AvailabilityRule,
  type SpotInput,
} from '@parkhere/shared';
import { z } from 'zod';

// The form works with what the user types (strings, a single weekly time window)
// and transforms into the shared SpotInput shape on submit.

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export const spotFormSchema = z
  .object({
    title: z.string().trim().min(3, 'At least 3 characters').max(80),
    description: z.string().trim().max(1000),
    areaLabel: z.string().trim().max(120),
    address: z.string().trim().min(5, 'Enter the full address').max(300),
    accessInstructions: z.string().trim().max(1000),
    vehicleTypes: z.array(vehicleTypeSchema).min(1, 'Choose at least one vehicle type'),
    isCovered: z.boolean(),
    hasCctv: z.boolean(),
    hasEvCharging: z.boolean(),
    hasSecurityGuard: z.boolean(),
    maxHeightCm: z
      .string()
      .trim()
      .regex(/^(\d{3})?$/, 'Height in cm, e.g. 210'),
    hourlyRate: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Enter a price in rupees, e.g. 40'),
    instantBook: z.boolean(),
    location: coordinatesSchema.nullable(),
    open24h: z.boolean(),
    openDays: z.array(z.number().int().min(0).max(6)),
    opensAt: clockTimeSchema,
    closesAt: clockTimeSchema,
  })
  .superRefine((values, ctx) => {
    const paise = rupeesToPaise(Number(values.hourlyRate));
    if (paise < HOURLY_RATE_MIN_PAISE || paise > HOURLY_RATE_MAX_PAISE) {
      ctx.addIssue({ code: 'custom', path: ['hourlyRate'], message: 'Between ₹5 and ₹1000' });
    }
    const height = values.maxHeightCm ? Number(values.maxHeightCm) : null;
    if (height !== null && (height < 100 || height > 500)) {
      ctx.addIssue({ code: 'custom', path: ['maxHeightCm'], message: 'Between 100 and 500 cm' });
    }
    if (values.location === null) {
      ctx.addIssue({ code: 'custom', path: ['location'], message: 'Set the location on the map' });
    }
    if (!values.open24h) {
      if (values.openDays.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['openDays'], message: 'Choose at least one day' });
      }
      if (values.closesAt <= values.opensAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['closesAt'],
          message: 'Must be after opening time',
        });
      }
    }
  })
  .transform((values): SpotInput => {
    const availability: AvailabilityRule[] = values.open24h
      ? []
      : values.openDays.map((weekday) =>
          availabilityRuleSchema.parse({ weekday, start: values.opensAt, end: values.closesAt }),
        );
    return {
      title: values.title,
      description: values.description || undefined,
      areaLabel: values.areaLabel || undefined,
      address: values.address,
      accessInstructions: values.accessInstructions || undefined,
      vehicleTypes: values.vehicleTypes,
      isCovered: values.isCovered,
      hasCctv: values.hasCctv,
      hasEvCharging: values.hasEvCharging,
      hasSecurityGuard: values.hasSecurityGuard,
      maxHeightCm: values.maxHeightCm ? Number(values.maxHeightCm) : undefined,
      hourlyRatePaise: rupeesToPaise(Number(values.hourlyRate)),
      instantBook: values.instantBook,
      // superRefine guarantees a location by the time transform runs
      location: values.location!,
      availability,
    };
  });

export type SpotFormValues = z.input<typeof spotFormSchema>;

export const emptySpotForm: SpotFormValues = {
  title: '',
  description: '',
  areaLabel: '',
  address: '',
  accessInstructions: '',
  vehicleTypes: ['car'],
  isCovered: false,
  hasCctv: false,
  hasEvCharging: false,
  hasSecurityGuard: false,
  maxHeightCm: '',
  hourlyRate: '',
  instantBook: true,
  location: null,
  open24h: true,
  openDays: [1, 2, 3, 4, 5, 6],
  opensAt: '08:00',
  closesAt: '20:00',
};
