-- Everything a host needs to manage one of their spots, with the exact location
-- as plain lat/lng (geography columns are awkward to consume from the API).
-- SECURITY INVOKER plus the host_id filter: other users get no rows.
create function public.get_my_spot(p_spot_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  area_label text,
  vehicle_types public.vehicle_type[],
  is_covered boolean,
  has_cctv boolean,
  has_ev_charging boolean,
  has_security_guard boolean,
  max_height_cm integer,
  hourly_rate_paise integer,
  instant_book boolean,
  status public.spot_status,
  rating_avg numeric,
  rating_count integer,
  lat double precision,
  lng double precision,
  address text,
  access_instructions text,
  availability jsonb,
  photos jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.title,
    s.description,
    s.area_label,
    s.vehicle_types,
    s.is_covered,
    s.has_cctv,
    s.has_ev_charging,
    s.has_security_guard,
    s.max_height_cm::integer,
    s.hourly_rate_paise,
    s.instant_book,
    s.status,
    s.rating_avg,
    s.rating_count,
    extensions.st_y(a.location::extensions.geometry),
    extensions.st_x(a.location::extensions.geometry),
    a.address,
    a.access_instructions,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'weekday', r.weekday,
            'start', to_char(r.start_time, 'HH24:MI'),
            'end', case when r.end_time = '24:00' then '24:00' else to_char(r.end_time, 'HH24:MI') end
          )
          order by r.weekday, r.start_time
        )
        from public.availability_rules r
        where r.spot_id = s.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', p.id, 'path', p.storage_path)
          order by p.sort_order, p.created_at
        )
        from public.spot_photos p
        where p.spot_id = s.id
      ),
      '[]'::jsonb
    )
  from public.spots s
  join public.spot_access a on a.spot_id = s.id
  where s.id = p_spot_id and s.host_id = (select auth.uid());
$$;

revoke execute on function public.get_my_spot(uuid) from public, anon;
grant execute on function public.get_my_spot(uuid) to authenticated;
