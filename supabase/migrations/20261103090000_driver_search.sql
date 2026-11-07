-- Driver search: cover photos in search results, and a public spot details function.

-------------------------------------------------------------------------------
-- nearby_spots: same as before, plus each spot's cover photo for map cards.
-- The return type changes, so the function is dropped and recreated.
-------------------------------------------------------------------------------
drop function public.nearby_spots(
  double precision, double precision, integer, timestamptz, timestamptz, public.vehicle_type, integer
);

create function public.nearby_spots(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 2000,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_vehicle_type public.vehicle_type default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  title text,
  area_label text,
  hourly_rate_paise integer,
  instant_book boolean,
  vehicle_types public.vehicle_type[],
  is_covered boolean,
  has_cctv boolean,
  has_ev_charging boolean,
  has_security_guard boolean,
  rating_avg numeric,
  rating_count integer,
  lat double precision,
  lng double precision,
  distance_m double precision,
  cover_photo_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_origin extensions.geography;
  v_range tstzrange;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_lat is null or p_lng is null
    or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'INVALID_COORDINATES';
  end if;
  if (p_starts_at is null) <> (p_ends_at is null) or p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  if p_starts_at is not null then
    v_range := tstzrange(p_starts_at, p_ends_at, '[)');
  end if;

  return query
  select
    s.id,
    s.title,
    s.area_label,
    s.hourly_rate_paise,
    s.instant_book,
    s.vehicle_types,
    s.is_covered,
    s.has_cctv,
    s.has_ev_charging,
    s.has_security_guard,
    s.rating_avg,
    s.rating_count,
    extensions.st_y(s.public_location::extensions.geometry),
    extensions.st_x(s.public_location::extensions.geometry),
    extensions.st_distance(s.public_location, v_origin),
    (
      select p.storage_path from public.spot_photos p
      where p.spot_id = s.id
      order by p.sort_order, p.created_at
      limit 1
    )
  from public.spots s
  where s.status = 'active'
    and extensions.st_dwithin(s.public_location, v_origin, least(greatest(p_radius_m, 100), 10000))
    and (p_vehicle_type is null or p_vehicle_type = any (s.vehicle_types))
    and (
      v_range is null
      or (
        public.is_within_availability(s.id, v_range)
        and not exists (
          select 1 from public.bookings b
          where b.spot_id = s.id
            and b.status in ('requested', 'confirmed', 'checked_in')
            and b.during && v_range
        )
      )
    )
  order by 15
  limit least(greatest(p_limit, 1), 200);
end;
$$;

revoke execute on function
  public.nearby_spots(double precision, double precision, integer, timestamptz, timestamptz, public.vehicle_type, integer)
from public, anon;
grant execute on function
  public.nearby_spots(double precision, double precision, integer, timestamptz, timestamptz, public.vehicle_type, integer)
to authenticated;

-------------------------------------------------------------------------------
-- get_public_spot: what a driver sees on a spot's details page.
-- SECURITY INVOKER, so the spots RLS policy decides visibility (active spots,
-- your own, or ones you have booked). Location is the rounded public one.
-------------------------------------------------------------------------------
create function public.get_public_spot(p_spot_id uuid)
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
  host_first_name text,
  is_own boolean,
  availability jsonb,
  photo_paths jsonb
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
    extensions.st_y(s.public_location::extensions.geometry),
    extensions.st_x(s.public_location::extensions.geometry),
    nullif(split_part(trim(h.full_name), ' ', 1), ''),
    s.host_id = (select auth.uid()),
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
        select jsonb_agg(p.storage_path order by p.sort_order, p.created_at)
        from public.spot_photos p
        where p.spot_id = s.id
      ),
      '[]'::jsonb
    )
  from public.spots s
  left join public.profiles h on h.id = s.host_id
  where s.id = p_spot_id;
$$;

revoke execute on function public.get_public_spot(uuid) from public, anon;
grant execute on function public.get_public_spot(uuid) to authenticated;
