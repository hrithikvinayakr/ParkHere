const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** Formats an amount in paise as rupees, e.g. 4550 -> "₹45.5". */
export function formatPaise(paise: number): string {
  return inrFormatter.format(paise / 100);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Mirrors the database: price is charged per started minute at the hourly rate. */
export function bookingTotalPaise(hourlyRatePaise: number, startsAt: Date, endsAt: Date): number {
  const minutes = Math.ceil((endsAt.getTime() - startsAt.getTime()) / 60_000);
  return Math.ceil((hourlyRatePaise * minutes) / 60);
}
