-------------------------------------------------------------------------------
-- Storage: spot photos. Public read (served via CDN URLs); hosts write only
-- inside a folder named after their user id: spot-photos/<user_id>/<file>
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spot-photos',
  'spot-photos',
  true,
  5242880, -- 5 MB; the app compresses photos to ~200 KB before upload
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Users upload spot photos to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'spot-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users replace spot photos in their own folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'spot-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users delete spot photos in their own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'spot-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-------------------------------------------------------------------------------
-- Realtime: the app listens to booking changes (offer accepted, check-in...).
-- Realtime applies the bookings RLS policy, so users only receive their own rows.
-------------------------------------------------------------------------------
alter publication supabase_realtime add table public.bookings;

-------------------------------------------------------------------------------
-- Scheduled jobs
-------------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'expire-stale-bookings',
  '* * * * *',
  $$ select public.expire_stale_bookings(); $$
);
