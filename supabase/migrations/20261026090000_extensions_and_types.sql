-- Extensions live in their own schema so they never appear in the public API.
create extension if not exists postgis with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.vehicle_type as enum ('two_wheeler', 'car', 'suv');

create type public.spot_status as enum ('draft', 'active', 'paused', 'suspended');

-- requested -> confirmed -> checked_in -> completed
-- side exits: rejected, expired (offer timed out), cancelled, no_show
create type public.booking_status as enum (
  'requested',
  'confirmed',
  'checked_in',
  'completed',
  'rejected',
  'expired',
  'cancelled',
  'no_show'
);

-- instant: confirmed immediately at the listed rate
-- offer: the host must accept within the offer window
create type public.booking_kind as enum ('instant', 'offer');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
