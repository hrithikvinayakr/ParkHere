import { describe, expect, it } from 'vitest';

import {
  bookingTotalPaise,
  formatPaise,
  parseTimeRange,
  plateNumberSchema,
  toUserMessage,
} from './index';

describe('money', () => {
  it('formats paise as rupees', () => {
    expect(formatPaise(4000)).toBe('₹40');
    expect(formatPaise(4550)).toBe('₹45.5');
  });

  it('charges per started minute, like the database', () => {
    const start = new Date('2026-01-01T10:00:00Z');
    expect(bookingTotalPaise(4000, start, new Date('2026-01-01T12:00:00Z'))).toBe(8000);
    expect(bookingTotalPaise(4000, start, new Date('2026-01-01T10:45:30Z'))).toBe(3067);
  });
});

describe('plateNumberSchema', () => {
  it('normalises spacing and case', () => {
    expect(plateNumberSchema.parse('ka 01 ab-1234')).toBe('KA01AB1234');
  });

  it('rejects junk', () => {
    expect(plateNumberSchema.safeParse('!!').success).toBe(false);
  });
});

describe('toUserMessage', () => {
  it('maps database error codes to friendly text', () => {
    expect(toUserMessage({ message: 'SLOT_TAKEN', code: 'P0001' })).toMatch(/just booked/);
  });

  it('never leaks unknown internal errors', () => {
    expect(toUserMessage(new Error('relation "x" does not exist'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

describe('parseTimeRange', () => {
  it('parses Postgres tstzrange output', () => {
    const { start, end } = parseTimeRange('["2026-10-26 10:00:00+00","2026-10-26 12:30:00+05:30")');
    expect(start.toISOString()).toBe('2026-10-26T10:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-26T07:00:00.000Z');
  });
});
