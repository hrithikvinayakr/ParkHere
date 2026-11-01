-- Booking lifecycle and access-control tests. Run with: pnpm db:test
-- The database may already contain seed data, so counts are scoped to this file's fixtures.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-------------------------------------------------------------------------------
-- Fixtures (as the postgres superuser)
-------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'host@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'driver@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'driver2@test.local');

insert into public.vehicles (id, owner_id, plate_number, type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'KA01AB1234', 'car'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'KA02CD5678', 'car'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'KA03EF9012', 'two_wheeler');

insert into public.spots (id, host_id, title, hourly_rate_paise, instant_book, vehicle_types) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Instant driveway', 4000, true, '{car,suv}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Offer-only garage', 6000, false, '{car}');

insert into public.spot_access (spot_id, location, address) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SRID=4326;POINT(77.5946 12.9716)', '12 MG Road, Bengaluru'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'SRID=4326;POINT(77.6000 12.9750)', '34 Church Street, Bengaluru');

update public.spots set status = 'active';

select is(
  (select count(*) from public.profiles
   where id in ('11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222',
                '33333333-3333-3333-3333-333333333333')),
  3::bigint,
  'a profile is created for every new user'
);

select ok(
  (
    select extensions.st_distance(s.public_location, a.location) between 1 and 150
    from public.spots s
    join public.spot_access a on a.spot_id = s.id
    where s.id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  'public location is rounded, not the exact pin'
);

-------------------------------------------------------------------------------
-- Driver 1: search and instant booking
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select count(*) from public.nearby_spots(12.9716, 77.5946)
   where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002')),
  2::bigint,
  'driver finds both nearby spots'
);

select is(
  (select count(*) from public.spot_access),
  0::bigint,
  'exact address is hidden before booking'
);

select throws_ok(
  $$ insert into public.bookings (spot_id, driver_id, vehicle_id, kind, status, during, hourly_rate_paise, total_paise, checkin_code)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
             'bbbbbbbb-0000-0000-0000-000000000001', 'instant', 'confirmed',
             tstzrange(now(), now() + interval '1 hour'), 1, 1, '000000') $$,
  '42501',
  null,
  'clients cannot insert bookings directly'
);

select throws_ok(
  $$ select public.request_booking('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003',
                                   now(), now() + interval '2 hours') $$,
  'P0001',
  'VEHICLE_TYPE_NOT_ALLOWED',
  'a two-wheeler cannot book a car-only spot'
);

select throws_ok(
  $$ select public.request_booking('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
                                   now(), now() + interval '10 minutes') $$,
  'P0001',
  'INVALID_DURATION',
  'bookings shorter than 30 minutes are rejected'
);

select is(
  (select status from public.request_booking('aaaaaaaa-0000-0000-0000-000000000001',
                                             'bbbbbbbb-0000-0000-0000-000000000001',
                                             now(), now() + interval '2 hours')),
  'confirmed'::public.booking_status,
  'instant booking is confirmed immediately'
);

select is(
  (select total_paise from public.bookings where spot_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  8000,
  'total is the hourly rate times the duration'
);

select is(
  (select count(*) from public.spot_access),
  1::bigint,
  'exact address is revealed after confirmation'
);

select is(
  (select count(*) from public.nearby_spots(12.9716, 77.5946, 2000,
                                            now() + interval '30 minutes', now() + interval '90 minutes')
   where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002')),
  1::bigint,
  'a booked spot is excluded from search for overlapping times'
);

-------------------------------------------------------------------------------
-- Driver 2: conflicts, privacy and offers
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select throws_ok(
  $$ select public.request_booking('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002',
                                   now() + interval '1 hour', now() + interval '3 hours') $$,
  'P0001',
  'SLOT_TAKEN',
  'an overlapping booking is rejected'
);

select is(
  (select count(*) from public.bookings),
  0::bigint,
  'drivers cannot see other drivers'' bookings'
);

select throws_ok(
  $$ select public.request_booking('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
                                   now(), now() + interval '1 hour', 2000) $$,
  'P0001',
  'OFFER_TOO_LOW',
  'offers below half the listed rate are rejected'
);

select is(
  (select status from public.request_booking('aaaaaaaa-0000-0000-0000-000000000002',
                                             'bbbbbbbb-0000-0000-0000-000000000002',
                                             now(), now() + interval '1 hour', 4500)),
  'requested'::public.booking_status,
  'an offer waits for the host'
);

select throws_ok(
  $$ select public.respond_to_booking(
       (select id from public.bookings where spot_id = 'aaaaaaaa-0000-0000-0000-000000000002'), true) $$,
  'P0001',
  'BOOKING_NOT_FOUND',
  'drivers cannot accept their own offer'
);

-------------------------------------------------------------------------------
-- Host
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select status from public.respond_to_booking(
     (select id from public.bookings where spot_id = 'aaaaaaaa-0000-0000-0000-000000000002'), true)),
  'confirmed'::public.booking_status,
  'the host accepts the offer'
);

select is(
  (select hourly_rate_paise from public.bookings where spot_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  4500,
  'an accepted offer keeps the offered rate'
);

select throws_ok(
  $$ select public.request_booking('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
                                   now() + interval '1 day', now() + interval '1 day 1 hour') $$,
  'P0001',
  'CANNOT_BOOK_OWN_SPOT',
  'hosts cannot book their own spot'
);

select throws_ok(
  $$ update public.spots set status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'hosts cannot suspend spots'
);

-------------------------------------------------------------------------------
-- Driver 1: parking session and review
-------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select status from public.check_in(
     (select id from public.bookings where spot_id = 'aaaaaaaa-0000-0000-0000-000000000001'))),
  'checked_in'::public.booking_status,
  'the driver checks in'
);

select is(
  (select status from public.check_out(
     (select id from public.bookings where spot_id = 'aaaaaaaa-0000-0000-0000-000000000001'))),
  'completed'::public.booking_status,
  'the driver checks out'
);

select is(
  (select rating from public.submit_review(
     (select id from public.bookings where spot_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
     5::smallint, 'Easy to find')),
  5::smallint,
  'the driver reviews the spot'
);

select throws_ok(
  $$ select public.expire_stale_bookings() $$,
  '42501',
  null,
  'clients cannot run maintenance jobs'
);

-------------------------------------------------------------------------------
-- Scheduled job (as postgres)
-------------------------------------------------------------------------------
reset role;

insert into public.bookings (
  spot_id, driver_id, vehicle_id, kind, status, during,
  hourly_rate_paise, total_paise, checkin_code, expires_at
) values (
  'aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333',
  'bbbbbbbb-0000-0000-0000-000000000002', 'offer', 'requested',
  tstzrange(now() + interval '2 days', now() + interval '2 days 1 hour'),
  4500, 4500, '123456', now() - interval '1 second'
);

select public.expire_stale_bookings();

select is(
  (select status from public.bookings where checkin_code = '123456'),
  'expired'::public.booking_status,
  'stale offers expire'
);

select * from finish();
rollback;
