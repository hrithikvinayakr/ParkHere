import { z } from 'zod';

// EXPO_PUBLIC_* variables are inlined at build time, so they must be read with
// static `process.env.NAME` access (no destructuring or dynamic keys).
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration. Copy apps/mobile/.env.example to .env and fill it in.\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;
