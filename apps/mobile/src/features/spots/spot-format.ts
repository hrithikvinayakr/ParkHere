import type { AvailabilityRule } from '@parkhere/shared';

import type { MySpot } from '@/api/spots';
import { emptySpotForm, type SpotFormValues } from '@/features/spots/spot-form-schema';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Open 24/7", or e.g. "Mon, Tue, Wed · 08:00–20:00" (one line per distinct window). */
export function formatAvailability(rules: AvailabilityRule[]): string {
  if (rules.length === 0) return 'Open 24/7';
  const byWindow = new Map<string, number[]>();
  for (const rule of rules) {
    const window = `${rule.start}–${rule.end}`;
    byWindow.set(window, [...(byWindow.get(window) ?? []), rule.weekday]);
  }
  return [...byWindow.entries()]
    .map(([window, days]) => `${days.map((day) => WEEKDAY_SHORT[day]).join(', ')} · ${window}`)
    .join('\n');
}

/**
 * The form edits one weekly window shared by the chosen days, so a spot whose
 * days have different hours is shown with its first window.
 */
export function spotToFormValues(spot: MySpot): SpotFormValues {
  const firstRule = spot.availability[0];
  return {
    ...emptySpotForm,
    title: spot.title,
    description: spot.description ?? '',
    areaLabel: spot.area_label ?? '',
    address: spot.address,
    accessInstructions: spot.access_instructions ?? '',
    vehicleTypes: spot.vehicle_types,
    isCovered: spot.is_covered,
    hasCctv: spot.has_cctv,
    hasEvCharging: spot.has_ev_charging,
    hasSecurityGuard: spot.has_security_guard,
    maxHeightCm: spot.max_height_cm ? String(spot.max_height_cm) : '',
    hourlyRate: String(spot.hourly_rate_paise / 100),
    instantBook: spot.instant_book,
    location: { lat: spot.lat, lng: spot.lng },
    open24h: !firstRule,
    openDays: firstRule
      ? [...new Set(spot.availability.map((rule) => rule.weekday))].sort()
      : emptySpotForm.openDays,
    opensAt: firstRule?.start ?? emptySpotForm.opensAt,
    closesAt: firstRule?.end ?? emptySpotForm.closesAt,
  };
}
