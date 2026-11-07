-- Driver search and public spot details tests. Run with: pnpm db:test
-- The database may already contain seed data, so assertions only touch this file's fixtures.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', 'search-host@test.local', '{"full_name": "Kavya Rao"}'),
  ('77777777-7777-7777-7777-777777777777', 'search-driver@test.local', '{}');

insert into public.spots (id, host_id, title, hourly_rate_paise) values
  ('cccccccc-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'Photo spot', 2500),
  ('cccccccc-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666666', 'Paused spot', 2500);

insert into public.spot_access (spot_id, location, address) values
  ('cccccccc-0000-0000-0000-000000000001', 'SRID=4326;POINT(80.2707 13.0827)', '1 Anna Salai, Chennai'),
  ('cccccccc-0000-0000-0000-000000000002', 'SRID=4326;POINT(80.2710 13.0830)', '2 Anna Salai, Chennai');

insert into public.spot_photos (spot_id, storage_path, sort_order) values
  ('cccccccc-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666/second.jpg', 1),
  ('cccccccc-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666/first.jpg', 0);

update public.spots set status = 'active' where id = 'cccccccc-0000-0000-0000-000000000001';
update public.spots set status = 'paused' where id = 'cccccccc-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select is(
  (select cover_photo_path from public.nearby_spots(13.0827, 80.2707)
   where id = 'cccccccc-0000-0000-0000-000000000001'),
  '66666666-6666-6666-6666-666666666666/first.jpg',
  'search results include the first photo as the cover'
);

select is(
  (select count(*) from public.nearby_spots(13.0827, 80.2707)
   where id = 'cccccccc-0000-0000-0000-000000000002'),
  0::bigint,
  'paused spots are not in search results'
);

select is(
  (select host_first_name from public.get_public_spot('cccccccc-0000-0000-0000-000000000001')),
  'Kavya',
  'drivers see only the host''s first name'
);

select is(
  (select jsonb_array_length(photo_paths) from public.get_public_spot('cccccccc-0000-0000-0000-000000000001')),
  2,
  'drivers see all photos'
);

select ok(
  (select abs(lat - 13.0827) > 0.00001 or abs(lng - 80.2707) > 0.00001
   from public.get_public_spot('cccccccc-0000-0000-0000-000000000001')),
  'drivers get the rounded location, not the exact pin'
);

select is(
  (select is_own from public.get_public_spot('cccccccc-0000-0000-0000-000000000001')),
  false,
  'is_own is false for other users'
);

select is(
  (select count(*) from public.get_public_spot('cccccccc-0000-0000-0000-000000000002')),
  0::bigint,
  'drivers cannot open a paused spot they have not booked'
);

set local request.jwt.claims to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

select is(
  (select is_own from public.get_public_spot('cccccccc-0000-0000-0000-000000000002')),
  true,
  'hosts can preview their own paused spot'
);

select * from finish();
rollback;
