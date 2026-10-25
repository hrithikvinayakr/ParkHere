# Architecture

## Overview

```
┌──────────────────────── Expo app (Android / iOS) ────────────────────────┐
│ Expo Router · TanStack Query · Zustand · Zod (@parkhere/shared)          │
└──────┬───────────────────┬──────────────────────┬────────────────────────┘
       │ supabase-js       │ Realtime (websocket) │ Storage uploads
       ▼                   ▼                      ▼
┌──────────────────────────── Supabase ────────────────────────────────────┐
│ Auth (email OTP)                                                         │
│ Postgres + PostGIS                                                       │
│   tables with RLS · booking functions (SECURITY DEFINER) · pg_cron jobs  │
│ Realtime (bookings) · Storage (spot-photos bucket)                       │
└──────────────────────────────────────────────────────────────────────────┘
```

There is no custom API server. Reads go straight to tables protected by Row Level
Security; anything with business rules goes through Postgres functions called with
`supabase.rpc()`. Code that needs secret keys (payments, push) will live in Supabase
Edge Functions.

## Data model

| Table                | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `profiles`           | public user info, created by a trigger on sign-up          |
| `vehicles`           | a driver's vehicles (plate, type)                          |
| `spots`              | listings: rate, amenities, vehicle types, rounded location |
| `spot_access`        | exact location, address, gate instructions (private)       |
| `spot_photos`        | photo paths in the `spot-photos` storage bucket            |
| `availability_rules` | weekly opening hours; no rules means open 24/7             |
| `bookings`           | the booking state machine                                  |
| `reviews`            | two-way ratings after a completed booking                  |

Money is stored as integer **paise** (₹1 = 100 paise) to avoid floating-point errors.

## Booking lifecycle

```
                 instant book ──────────────┐
request_booking ─┤                          ▼
                 offer ──► requested ──► confirmed ──► checked_in ──► completed
                              │  host        │  check_in()    check_out()
                              │  accepts     │
                              ├─► rejected   ├─► cancelled  (driver or host)
                              ├─► expired    └─► no_show    (15 min after start)
                              └─► cancelled
```

| Function                 | Who            | Notes                                               |
| ------------------------ | -------------- | --------------------------------------------------- |
| `nearby_spots`           | any user       | PostGIS radius search, optional time/vehicle filter |
| `request_booking`        | driver         | instant if allowed and at the listed rate           |
| `respond_to_booking`     | host           | accept/reject an offer before it expires (3 min)    |
| `cancel_booking`         | driver or host | before check-in                                     |
| `check_in` / `check_out` | driver or host | check-in opens 15 min early; overstay billed        |
| `submit_review`          | driver or host | once each, within 14 days                           |
| `expire_stale_bookings`  | pg_cron only   | every minute: expire offers, mark no-shows          |

Rules are defined once in SQL and mirrored for UX in
`packages/shared/src/constants.ts`. Functions raise stable error codes
(`SLOT_TAKEN`, `OFFER_TOO_LOW`, …) that the app maps to friendly text in
`packages/shared/src/errors.ts`; unknown errors are never shown to users.

## Security model

1. **Least privilege.** `anon` has no table access. `authenticated` gets explicit,
   column-level grants: for example, hosts can update a spot's price but never its
   rating or location fields.
2. **RLS everywhere.** Users see their own vehicles and bookings; hosts see bookings
   and vehicles at their spots; spot access details are visible only to the host and
   to drivers with a confirmed booking.
3. **No direct writes to bookings or reviews.** State changes only happen through
   `SECURITY DEFINER` functions with `search_path = ''`, which validate the caller,
   the current state and the inputs.
4. **Concurrency safety.** The `bookings_no_overlap` exclusion constraint makes
   double-booking impossible at the database level; functions lock rows
   (`FOR UPDATE`) before changing state.
5. **Privacy.** `spots.public_location` is snapped to a ~100 m grid by a trigger;
   the exact pin lives in `spot_access`.
6. **Device storage.** The Supabase session is AES-256 encrypted in AsyncStorage, with
   the key in SecureStore (Keychain/Keystore).
7. **Storage.** Users can only write photos under `spot-photos/<their user id>/`.

## Testing

- `supabase/tests/database/*.test.sql` — pgTAP tests for RLS and the booking engine
  (`pnpm db:test`).
- `packages/shared/src/*.test.ts` — Vitest unit tests (`pnpm test`).
- CI runs lint, typecheck, unit tests, database tests, gitleaks and CodeQL on every PR.

## Known v1 limitations

- A booking must fit inside one availability window on a single day (no overnight
  windows yet).
- Deleting an account that has bookings is blocked by foreign keys; the account
  deletion feature will anonymise history instead.
- `database.types.ts` is hand-written until the local stack runs; regenerate it with
  `pnpm db:types`.
