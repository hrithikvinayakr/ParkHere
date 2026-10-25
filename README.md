# ParkHere

Find and book parking spots listed by people nearby — like ride-hailing, but for parking.
Drivers search a map, book instantly or send an offer, and get directions to the spot.
Hosts list their driveway, garage or lot and earn from idle space.

Built to production standards on a zero-cost stack.

| Layer       | Tech                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| Mobile app  | Expo (React Native, New Architecture), TypeScript, Expo Router, TanStack Query, Zustand |
| Backend     | Supabase: Postgres + PostGIS, Row Level Security, Auth, Realtime, Storage, pg_cron      |
| Shared code | `@parkhere/shared` — Zod schemas, business constants, error codes, database types       |
| Tooling     | pnpm workspaces, Turborepo, ESLint, Prettier, Vitest, pgTAP, GitHub Actions, CodeQL     |

## Repository layout

```
apps/mobile/            Expo app (driver + host modes in one app)
  src/app/              routes (Expo Router): sign-in, tabs
  src/api/              data hooks (TanStack Query + Supabase)
  src/lib/              Supabase client (encrypted session storage), env, query client
packages/shared/        types, schemas and rules shared by the app
supabase/
  migrations/           database schema, RLS policies, booking functions
  tests/database/       pgTAP tests (booking rules and access control)
  seed.sql              local test data: 5 users, 40 spots around Bengaluru
docs/ARCHITECTURE.md    data model, booking lifecycle, security model
```

## Prerequisites

- Node.js 22+ and pnpm 10 (`npm install -g pnpm`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — runs Supabase locally
- Android Studio with an emulator, or the Expo Go / a development build on your phone

## Getting started

```bash
pnpm install

# 1. Start Supabase locally (first run downloads Docker images)
pnpm db:start            # prints the API URL and publishable key
pnpm db:reset            # applies migrations + seed data
pnpm db:types            # regenerates packages/shared/src/database.types.ts

# 2. Configure the app
cp apps/mobile/.env.example apps/mobile/.env   # paste the publishable key

# 3. Run the app
pnpm --filter @parkhere/mobile start
```

Sign in with a seeded account such as `driver1@parkhere.test` or `host1@parkhere.test`.
The 6-digit code arrives in the local inbox at <http://127.0.0.1:54324>.
Supabase Studio (database browser) is at <http://127.0.0.1:54323>.

## Scripts

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm lint`      | ESLint                                        |
| `pnpm typecheck` | TypeScript in every package                   |
| `pnpm test`      | unit tests (Vitest)                           |
| `pnpm db:test`   | database tests (pgTAP) against local Supabase |
| `pnpm format`    | Prettier                                      |
| `pnpm db:reset`  | rebuild the local database from migrations    |
| `pnpm db:types`  | regenerate TypeScript types from the database |

## Security model (summary)

- **Row Level Security on every table**; the anonymous role has no access at all.
- **Clients cannot write bookings directly.** Every booking change goes through a
  database function that checks who is calling and whether the transition is allowed.
- **Double-booking is impossible**: a Postgres exclusion constraint rejects overlapping bookings,
  even when two requests race.
- **Exact addresses stay private** until a booking is confirmed; search only exposes a
  location rounded to ~100 m.
- **Sessions are encrypted at rest** on the device (AES-256, key in Keychain/Keystore).
- Secret scanning (gitleaks) and static analysis (CodeQL) run in CI.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Roadmap

- [x] Monorepo, CI, database schema, RLS, booking engine, tests, auth, app shell
- [ ] Host listings (create spot, photos, availability)
- [ ] Map search with device location
- [ ] Booking flow UI: instant book, offers with countdown, live updates
- [ ] Payments (Razorpay test mode via Edge Functions)
- [ ] Navigation hand-off and check-in/out screens
- [ ] Push notifications, reviews, account deletion
- [ ] Release (EAS Build → Google Play)
