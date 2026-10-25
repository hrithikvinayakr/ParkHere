-- Local development data. Loaded by `pnpm db:reset`. Never run against production.
--
-- Test accounts (sign in with email; the 6-digit code arrives in the local
-- Mailpit inbox at http://127.0.0.1:54324):
--   host1@parkhere.test, host2@parkhere.test, host3@parkhere.test
--   driver1@parkhere.test, driver2@parkhere.test

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  '',
  now(),
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('full_name', u.full_name),
  now(),
  now(),
  '', '', '', ''
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'host1@parkhere.test', 'Asha Rao'),
  ('00000000-0000-0000-0000-0000000000a2'::uuid, 'host2@parkhere.test', 'Vikram Shetty'),
  ('00000000-0000-0000-0000-0000000000a3'::uuid, 'host3@parkhere.test', 'Meera Iyer'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'driver1@parkhere.test', 'Rahul Nair'),
  ('00000000-0000-0000-0000-0000000000d2'::uuid, 'driver2@parkhere.test', 'Priya Menon')
) as u (id, email, full_name);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.email like '%@parkhere.test';

insert into public.vehicles (owner_id, plate_number, type, make_model) values
  ('00000000-0000-0000-0000-0000000000d1', 'KA01AB1234', 'car', 'Maruti Swift'),
  ('00000000-0000-0000-0000-0000000000d1', 'KA05MX4321', 'two_wheeler', 'Honda Activa'),
  ('00000000-0000-0000-0000-0000000000d2', 'KA03HN7788', 'suv', 'Mahindra XUV700');

-- 40 spots scattered within ~3 km of MG Road, Bengaluru (deterministic layout).
create temporary table spot_seed as
  select
    i,
    ('00000000-0000-0000-0000-0000000000a' || (1 + i % 3))::uuid as host_id,
    (array['Covered driveway', 'Apartment basement slot', 'Shop front (after hours)',
           'Gated house parking', 'Office lot (weekends)', 'Open plot', 'Villa garage',
           'Society visitor slot'])[1 + i % 8] as kind,
    (array['Indiranagar', 'Koramangala', 'Shivajinagar', 'Richmond Town', 'Ulsoor',
           'Domlur', 'Frazer Town', 'Vasanth Nagar'])[1 + i % 8] as area,
    12.9716 + 0.025 * sin(i * 1.7) * (0.3 + (i % 7) / 10.0) as lat,
    77.5946 + 0.025 * cos(i * 2.3) * (0.3 + (i % 5) / 7.0) as lng
  from generate_series(1, 40) as i;

insert into public.spots (
  id, host_id, title, area_label, vehicle_types, is_covered, has_cctv, has_ev_charging,
  has_security_guard, hourly_rate_paise, instant_book
)
select
  ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  host_id,
  kind || ' #' || i,
  area || ', Bengaluru',
  case
    when i % 5 = 0 then '{two_wheeler}'
    when i % 4 = 0 then '{two_wheeler,car,suv}'
    else '{car,suv}'
  end::public.vehicle_type[],
  i % 2 = 0,
  i % 3 = 0,
  i % 9 = 0,
  i % 6 = 0,
  case when i % 5 = 0 then 1000 else 2000 + (i % 6) * 1000 end,
  i % 4 <> 1
from spot_seed;

insert into public.spot_access (spot_id, location, address, access_instructions)
select
  ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
  (10 + i) || ', ' || (i % 12 + 1) || 'th Cross, ' || area || ', Bengaluru',
  'Ring the bell at the gate and show your check-in code.'
from spot_seed;

update public.spots set status = 'active' where host_id::text like '00000000-0000-0000-0000-0000000000a%';

-- Every third spot is only open Monday to Saturday, 08:00-20:00.
insert into public.availability_rules (spot_id, weekday, start_time, end_time)
select s.id, d, '08:00', '20:00'
from public.spots s
cross join generate_series(1, 6) as d
where right(s.id::text, 2)::int % 3 = 0;

drop table spot_seed;
