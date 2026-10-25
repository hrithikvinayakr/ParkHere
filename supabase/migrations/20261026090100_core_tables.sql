-- Core tables, row level security and grants.
-- Convention: every table has RLS enabled, and privileges are granted explicitly per table
-- (and per column where it matters) instead of relying on default grants.

-------------------------------------------------------------------------------
-- profiles: public part of a user account, created automatically on sign-up
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) between 1 and 80),
  avatar_url text check (char_length(avatar_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 80), ''));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- vehicles
-------------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- normalised: uppercase letters and digits only, e.g. KA01AB1234
  plate_number text not null check (plate_number ~ '^[A-Z0-9]{4,12}$'),
  type public.vehicle_type not null,
  make_model text check (char_length(make_model) <= 60),
  created_at timestamptz not null default now(),
  unique (owner_id, plate_number)
);

-------------------------------------------------------------------------------
-- spots: a parking space listed by a host
-------------------------------------------------------------------------------
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 1000),
  -- human readable locality shown before booking, e.g. "Indiranagar, Bengaluru"
  area_label text check (char_length(area_label) <= 120),
  vehicle_types public.vehicle_type[] not null default '{car}'
    check (cardinality(vehicle_types) > 0),
  is_covered boolean not null default false,
  has_cctv boolean not null default false,
  has_ev_charging boolean not null default false,
  has_security_guard boolean not null default false,
  max_height_cm smallint check (max_height_cm between 100 and 500),
  -- money is always stored in paise (1 INR = 100 paise); ₹5 to ₹1000 per hour
  hourly_rate_paise integer not null check (hourly_rate_paise between 500 and 100000),
  instant_book boolean not null default true,
  timezone text not null default 'Asia/Kolkata',
  status public.spot_status not null default 'draft',
  -- rounded to ~100 m; the exact location lives in spot_access
  public_location extensions.geography(Point, 4326),
  rating_avg numeric(2, 1),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_spot_has_location check (status <> 'active' or public_location is not null)
);

create index spots_public_location_idx on public.spots using gist (public_location);
create index spots_host_id_idx on public.spots (host_id);

create trigger spots_set_updated_at
before update on public.spots
for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- spot_access: exact location and entry details, revealed only after booking
-------------------------------------------------------------------------------
create table public.spot_access (
  spot_id uuid primary key references public.spots (id) on delete cascade,
  location extensions.geography(Point, 4326) not null,
  address text not null check (char_length(address) between 5 and 300),
  access_instructions text check (char_length(access_instructions) <= 1000),
  updated_at timestamptz not null default now()
);

create trigger spot_access_set_updated_at
before update on public.spot_access
for each row execute function public.set_updated_at();

-- Keep the spot's public (rounded) location in sync with the exact one.
create function public.sync_public_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.spots
  set public_location = extensions.st_snaptogrid(
    new.location::extensions.geometry, 0.001
  )::extensions.geography
  where id = new.spot_id;
  return new;
end;
$$;

revoke execute on function public.sync_public_location() from public, anon, authenticated;

create trigger spot_access_sync_public_location
after insert or update of location on public.spot_access
for each row execute function public.sync_public_location();

-------------------------------------------------------------------------------
-- spot_photos: files live in the spot-photos storage bucket
-------------------------------------------------------------------------------
create table public.spot_photos (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index spot_photos_spot_id_idx on public.spot_photos (spot_id, sort_order);

-------------------------------------------------------------------------------
-- availability_rules: weekly opening hours in the spot's timezone.
-- A spot without rules is available 24/7.
-------------------------------------------------------------------------------
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null, -- '24:00' means end of day
  check (end_time > start_time)
);

create index availability_rules_spot_id_idx on public.availability_rules (spot_id, weekday);

-------------------------------------------------------------------------------
-- bookings
-------------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete restrict,
  driver_id uuid not null references public.profiles (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  kind public.booking_kind not null,
  status public.booking_status not null,
  during tstzrange not null
    check (not isempty(during) and lower_inc(during) and not upper_inc(during)),
  -- agreed rate: the listed rate, or the driver's accepted offer
  hourly_rate_paise integer not null check (hourly_rate_paise > 0),
  total_paise integer not null check (total_paise >= 0),
  overstay_paise integer not null default 0 check (overstay_paise >= 0),
  -- shown in both apps so the host can confirm who is at the gate
  checkin_code text not null check (checkin_code ~ '^[0-9]{6}$'),
  expires_at timestamptz, -- only set while an offer is waiting for the host
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Makes double-booking impossible, even when two requests race.
  constraint bookings_no_overlap exclude using gist (spot_id with =, during with &&)
    where (status in ('requested', 'confirmed', 'checked_in'))
);

create index bookings_driver_id_idx on public.bookings (driver_id, created_at desc);
create index bookings_spot_id_idx on public.bookings (spot_id, status);
create index bookings_pending_expiry_idx on public.bookings (expires_at) where status = 'requested';
create index bookings_confirmed_start_idx on public.bookings (lower(during)) where status = 'confirmed';

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- reviews: both sides review each other after a completed booking
-------------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (booking_id, author_id)
);

create index reviews_subject_id_idx on public.reviews (subject_id, created_at desc);

-------------------------------------------------------------------------------
-- Row level security
-------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.spots enable row level security;
alter table public.spot_access enable row level security;
alter table public.spot_photos enable row level security;
alter table public.availability_rules enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;

-- SECURITY DEFINER so policies on other tables can call it without RLS recursion.
create function public.is_spot_host(p_spot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.spots
    where id = p_spot_id and host_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_spot_host(uuid) from public, anon;
grant execute on function public.is_spot_host(uuid) to authenticated;

-- profiles
create policy "Profiles are visible to signed-in users"
on public.profiles for select to authenticated
using (true);

create policy "Users update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- vehicles
create policy "Drivers see their vehicles; hosts see vehicles booked at their spots"
on public.vehicles for select to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.bookings b
    where b.vehicle_id = vehicles.id and public.is_spot_host(b.spot_id)
  )
);

create policy "Drivers add their own vehicles"
on public.vehicles for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "Drivers update their own vehicles"
on public.vehicles for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Drivers delete their own vehicles"
on public.vehicles for delete to authenticated
using (owner_id = (select auth.uid()));

-- spots
create policy "Active spots are public; hosts and their drivers see the rest"
on public.spots for select to authenticated
using (
  status = 'active'
  or host_id = (select auth.uid())
  or exists (
    select 1 from public.bookings b
    where b.spot_id = spots.id and b.driver_id = (select auth.uid())
  )
);

create policy "Hosts create their own spots"
on public.spots for insert to authenticated
with check (host_id = (select auth.uid()) and status <> 'suspended');

-- Suspension is an admin action: hosts can neither edit a suspended spot nor suspend one.
create policy "Hosts update their own spots"
on public.spots for update to authenticated
using (host_id = (select auth.uid()) and status <> 'suspended')
with check (host_id = (select auth.uid()) and status <> 'suspended');

create policy "Hosts delete their own spots"
on public.spots for delete to authenticated
using (host_id = (select auth.uid()));

-- spot_access
create policy "Hosts and confirmed drivers see access details"
on public.spot_access for select to authenticated
using (
  public.is_spot_host(spot_id)
  or exists (
    select 1 from public.bookings b
    where b.spot_id = spot_access.spot_id
      and b.driver_id = (select auth.uid())
      and b.status in ('confirmed', 'checked_in')
  )
);

create policy "Hosts add access details"
on public.spot_access for insert to authenticated
with check (public.is_spot_host(spot_id));

create policy "Hosts update access details"
on public.spot_access for update to authenticated
using (public.is_spot_host(spot_id))
with check (public.is_spot_host(spot_id));

create policy "Hosts delete access details"
on public.spot_access for delete to authenticated
using (public.is_spot_host(spot_id));

-- spot_photos (visible whenever the spot itself is visible)
create policy "Photos follow spot visibility"
on public.spot_photos for select to authenticated
using (exists (select 1 from public.spots s where s.id = spot_photos.spot_id));

create policy "Hosts add photos"
on public.spot_photos for insert to authenticated
with check (public.is_spot_host(spot_id));

create policy "Hosts delete photos"
on public.spot_photos for delete to authenticated
using (public.is_spot_host(spot_id));

-- availability_rules
create policy "Availability follows spot visibility"
on public.availability_rules for select to authenticated
using (exists (select 1 from public.spots s where s.id = availability_rules.spot_id));

create policy "Hosts add availability"
on public.availability_rules for insert to authenticated
with check (public.is_spot_host(spot_id));

create policy "Hosts update availability"
on public.availability_rules for update to authenticated
using (public.is_spot_host(spot_id))
with check (public.is_spot_host(spot_id));

create policy "Hosts delete availability"
on public.availability_rules for delete to authenticated
using (public.is_spot_host(spot_id));

-- bookings: read-only for clients; every change goes through the booking functions
create policy "Drivers and hosts see their bookings"
on public.bookings for select to authenticated
using (driver_id = (select auth.uid()) or public.is_spot_host(spot_id));

-- reviews: read-only for clients; created through submit_review()
create policy "Reviews are visible to signed-in users"
on public.reviews for select to authenticated
using (true);

-------------------------------------------------------------------------------
-- Grants: anon gets nothing (the app requires sign-in). Columns that only the
-- server may change (ids, ratings, derived locations) are left out of the
-- insert/update grants.
-------------------------------------------------------------------------------
revoke all on table
  public.profiles, public.vehicles, public.spots, public.spot_access,
  public.spot_photos, public.availability_rules, public.bookings, public.reviews
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

grant select, delete on public.vehicles to authenticated;
grant insert (owner_id, plate_number, type, make_model) on public.vehicles to authenticated;
grant update (plate_number, type, make_model) on public.vehicles to authenticated;

grant select, delete on public.spots to authenticated;
grant insert (
  host_id, title, description, area_label, vehicle_types, is_covered, has_cctv,
  has_ev_charging, has_security_guard, max_height_cm, hourly_rate_paise, instant_book,
  timezone, status
) on public.spots to authenticated;
grant update (
  title, description, area_label, vehicle_types, is_covered, has_cctv,
  has_ev_charging, has_security_guard, max_height_cm, hourly_rate_paise, instant_book,
  timezone, status
) on public.spots to authenticated;

grant select, delete on public.spot_access to authenticated;
grant insert (spot_id, location, address, access_instructions) on public.spot_access to authenticated;
grant update (location, address, access_instructions) on public.spot_access to authenticated;

grant select, delete on public.spot_photos to authenticated;
grant insert (spot_id, storage_path, sort_order) on public.spot_photos to authenticated;

grant select, delete on public.availability_rules to authenticated;
grant insert (spot_id, weekday, start_time, end_time) on public.availability_rules to authenticated;
grant update (weekday, start_time, end_time) on public.availability_rules to authenticated;

grant select on public.bookings to authenticated;
grant select on public.reviews to authenticated;
