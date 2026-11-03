-- Host spot management tests. Run with: pnpm db:test
-- The database may already contain seed data, so assertions only touch this file's fixtures.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'spot-host@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'other-user@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

create temporary table created (id uuid) on commit drop;

select lives_ok(
  $$ insert into created
     select public.create_spot(
       'Corner garage', 'Covered, near the metro', 'Indiranagar, Bengaluru',
       '{car,suv}', true, true, false, false, null, 3000, true,
       12.9784, 77.6408, '42 100 Feet Road, Indiranagar', 'Blue gate on the left',
       '[{"weekday": 1, "start": "08:00", "end": "20:00"},
         {"weekday": 2, "start": "08:00", "end": "24:00"}]') $$,
  'a host creates a spot'
);

select is(
  (select status from public.spots where id = (select id from created)),
  'active'::public.spot_status,
  'a new spot is published'
);

select isnt(
  (select public_location from public.spots where id = (select id from created)),
  null,
  'the public location is derived from the exact pin'
);

select is(
  (select count(*) from public.availability_rules where spot_id = (select id from created)),
  2::bigint,
  'opening hours are saved'
);

select is(
  (select address from public.spot_access where spot_id = (select id from created)),
  '42 100 Feet Road, Indiranagar',
  'the host can read their access details'
);

select throws_ok(
  $$ select public.create_spot(
       'Bad hours', null, null, '{car}', false, false, false, false, null, 3000, true,
       12.97, 77.64, '1 Test Street', null,
       '[{"weekday": 9, "start": "08:00", "end": "20:00"}]') $$,
  'P0001',
  'INVALID_AVAILABILITY',
  'invalid opening hours are rejected'
);

select throws_ok(
  $$ select public.create_spot(
       'Too cheap', null, null, '{car}', false, false, false, false, null, 100, true,
       12.97, 77.64, '1 Test Street', null, '[]') $$,
  'P0001',
  'INVALID_SPOT_DETAILS',
  'rates below the minimum are rejected'
);

select ok(
  (select abs(lat - 12.9784) < 0.00001 and abs(lng - 77.6408) < 0.00001
   from public.get_my_spot((select id from created))),
  'get_my_spot returns the exact pin as lat/lng'
);

select is(
  (select availability -> 1 ->> 'end' from public.get_my_spot((select id from created))),
  '24:00',
  'get_my_spot returns opening hours, including end of day'
);

select lives_ok(
  $$ select public.update_spot(
       (select id from created), 'Corner garage (covered)', null, 'Indiranagar, Bengaluru',
       '{car}', true, true, true, false, 210, 3500, false,
       12.9790, 77.6410, '42 100 Feet Road, Indiranagar', null, '[]') $$,
  'the host updates the spot'
);

select is(
  (select hourly_rate_paise from public.spots where id = (select id from created)),
  3500,
  'the new rate is saved'
);

select is(
  (select count(*) from public.availability_rules where spot_id = (select id from created)),
  0::bigint,
  'clearing opening hours makes the spot 24/7'
);

set local request.jwt.claims to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select throws_ok(
  $$ select public.update_spot(
       (select id from created), 'Hijacked', null, null, '{car}', false, false, false, false,
       null, 500, true, 12.97, 77.64, '1 Test Street', null, '[]') $$,
  'P0001',
  'SPOT_NOT_FOUND',
  'other users cannot update the spot'
);

select is(
  (select count(*) from public.spot_access where spot_id = (select id from created)),
  0::bigint,
  'other users cannot read the exact address'
);

select is(
  (select count(*) from public.get_my_spot((select id from created))),
  0::bigint,
  'get_my_spot returns nothing for other users'
);

select * from finish();
rollback;
