-- Search and booking lifecycle functions, called from the app with supabase.rpc().
-- Errors are raised with stable UPPER_SNAKE_CASE messages that the app maps to
-- user-facing text (see packages/shared/src/errors.ts).
--
-- Business rules (keep in sync with packages/shared/src/constants.ts):
--   booking length 30 min .. 24 h, start at most 14 days ahead
--   offers expire after 3 minutes and must be at least 50% of the listed rate
--   a driver may have at most 3 offers waiting at once
--   check-in opens 15 minutes before the start; no-show 15 minutes after it

-------------------------------------------------------------------------------
-- Helpers (internal, not callable by clients)
-------------------------------------------------------------------------------
create function public.generate_checkin_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select lpad(
    ((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text,
    6,
    '0'
  );
$$;

-- v1 rule: a booking must fit inside a single availability window on one local day.
create function public.is_within_availability(p_spot_id uuid, p_range tstzrange)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_start timestamp;
  v_end timestamp;
  v_day date;
  v_end_time time;
begin
  if not exists (select 1 from public.availability_rules where spot_id = p_spot_id) then
    return true;
  end if;

  select timezone into v_tz from public.spots where id = p_spot_id;
  v_start := lower(p_range) at time zone v_tz;
  v_end := upper(p_range) at time zone v_tz;
  v_day := v_start::date;

  v_end_time := case
    when v_end = (v_day + 1)::timestamp then '24:00'::time
    when v_end::date = v_day then v_end::time
  end;

  if v_end_time is null then
    return false;
  end if;

  return exists (
    select 1 from public.availability_rules r
    where r.spot_id = p_spot_id
      and r.weekday = extract(dow from v_day)
      and r.start_time <= v_start::time
      and r.end_time >= v_end_time
  );
end;
$$;

-------------------------------------------------------------------------------
-- nearby_spots: map search. Returns only public data (rounded location).
-------------------------------------------------------------------------------
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
  distance_m double precision
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
    extensions.st_distance(s.public_location, v_origin)
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

-------------------------------------------------------------------------------
-- request_booking: instant booking, or an offer the host must answer.
-------------------------------------------------------------------------------
create function public.request_booking(
  p_spot_id uuid,
  p_vehicle_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_offered_rate_paise integer default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_spot public.spots;
  v_vehicle public.vehicles;
  v_minutes integer;
  v_rate integer;
  v_kind public.booking_kind;
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_spot from public.spots where id = p_spot_id;
  if not found or v_spot.status <> 'active' then
    raise exception 'SPOT_NOT_AVAILABLE';
  end if;
  if v_spot.host_id = v_uid then
    raise exception 'CANNOT_BOOK_OWN_SPOT';
  end if;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id and owner_id = v_uid;
  if not found then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;
  if not (v_vehicle.type = any (v_spot.vehicle_types)) then
    raise exception 'VEHICLE_TYPE_NOT_ALLOWED';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME_RANGE';
  end if;
  v_minutes := ceil(extract(epoch from (p_ends_at - p_starts_at)) / 60);
  if v_minutes < 30 or v_minutes > 1440 then
    raise exception 'INVALID_DURATION';
  end if;
  if p_starts_at < now() - interval '5 minutes' or p_starts_at > now() + interval '14 days' then
    raise exception 'INVALID_START_TIME';
  end if;
  if not public.is_within_availability(p_spot_id, tstzrange(p_starts_at, p_ends_at, '[)')) then
    raise exception 'OUTSIDE_AVAILABILITY';
  end if;

  if p_offered_rate_paise is null or p_offered_rate_paise >= v_spot.hourly_rate_paise then
    v_rate := v_spot.hourly_rate_paise;
    v_kind := case when v_spot.instant_book then 'instant' else 'offer' end;
  else
    if p_offered_rate_paise * 2 < v_spot.hourly_rate_paise then
      raise exception 'OFFER_TOO_LOW';
    end if;
    v_rate := p_offered_rate_paise;
    v_kind := 'offer';
  end if;

  if v_kind = 'offer' and (
    select count(*) from public.bookings
    where driver_id = v_uid and status = 'requested' and expires_at > now()
  ) >= 3 then
    raise exception 'TOO_MANY_PENDING_OFFERS';
  end if;

  insert into public.bookings (
    spot_id, driver_id, vehicle_id, kind, status, during,
    hourly_rate_paise, total_paise, checkin_code, expires_at
  )
  values (
    p_spot_id,
    v_uid,
    p_vehicle_id,
    v_kind,
    case when v_kind = 'instant' then 'confirmed' else 'requested' end::public.booking_status,
    tstzrange(p_starts_at, p_ends_at, '[)'),
    v_rate,
    ceil(v_rate * v_minutes / 60.0)::integer,
    public.generate_checkin_code(),
    case when v_kind = 'offer' then now() + interval '3 minutes' end
  )
  returning * into v_booking;

  return v_booking;
exception
  when exclusion_violation then
    raise exception 'SLOT_TAKEN';
end;
$$;

-------------------------------------------------------------------------------
-- respond_to_booking: the host accepts or rejects an offer.
-------------------------------------------------------------------------------
create function public.respond_to_booking(p_booking_id uuid, p_accept boolean)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select b.* into v_booking
  from public.bookings b
  join public.spots s on s.id = b.spot_id
  where b.id = p_booking_id and s.host_id = auth.uid()
  for update of b;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.status <> 'requested' then
    raise exception 'INVALID_BOOKING_STATUS';
  end if;
  if v_booking.expires_at <= now() then
    raise exception 'OFFER_EXPIRED';
  end if;

  update public.bookings
  set status = case when p_accept then 'confirmed' else 'rejected' end::public.booking_status,
      expires_at = null
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-------------------------------------------------------------------------------
-- cancel_booking: the driver withdraws, or the host cancels, before check-in.
-------------------------------------------------------------------------------
create function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and (driver_id = v_uid or public.is_spot_host(spot_id))
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.status not in ('requested', 'confirmed') then
    raise exception 'INVALID_BOOKING_STATUS';
  end if;

  update public.bookings
  set status = 'cancelled',
      expires_at = null,
      cancelled_by = v_uid,
      cancel_reason = left(nullif(trim(p_reason), ''), 300)
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-------------------------------------------------------------------------------
-- check_in / check_out: start and end the parking session.
-------------------------------------------------------------------------------
create function public.check_in(p_booking_id uuid)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and (driver_id = auth.uid() or public.is_spot_host(spot_id))
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'INVALID_BOOKING_STATUS';
  end if;
  if now() < lower(v_booking.during) - interval '15 minutes' or now() >= upper(v_booking.during) then
    raise exception 'OUTSIDE_CHECK_IN_WINDOW';
  end if;

  update public.bookings
  set status = 'checked_in', checked_in_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

create function public.check_out(p_booking_id uuid)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_overstay_minutes integer;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and (driver_id = auth.uid() or public.is_spot_host(spot_id))
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.status <> 'checked_in' then
    raise exception 'INVALID_BOOKING_STATUS';
  end if;

  -- 5 minutes of grace, then overstay is billed per started minute at the agreed rate
  v_overstay_minutes := greatest(
    0,
    ceil(extract(epoch from (now() - upper(v_booking.during) - interval '5 minutes')) / 60)
  );

  update public.bookings
  set status = 'completed',
      checked_out_at = now(),
      overstay_paise = ceil(v_booking.hourly_rate_paise * v_overstay_minutes / 60.0)::integer
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-------------------------------------------------------------------------------
-- submit_review: one review per side, within 14 days of check-out.
-------------------------------------------------------------------------------
create function public.submit_review(p_booking_id uuid, p_rating smallint, p_comment text default null)
returns public.reviews
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_host_id uuid;
  v_review public.reviews;
begin
  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
    and (b.driver_id = v_uid or public.is_spot_host(b.spot_id));

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  select host_id into v_host_id from public.spots where id = v_booking.spot_id;
  if v_booking.status <> 'completed' or v_booking.checked_out_at < now() - interval '14 days' then
    raise exception 'REVIEW_NOT_ALLOWED';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'INVALID_RATING';
  end if;

  insert into public.reviews (booking_id, author_id, subject_id, rating, comment)
  values (
    p_booking_id,
    v_uid,
    case when v_uid = v_booking.driver_id then v_host_id else v_booking.driver_id end,
    p_rating,
    left(nullif(trim(p_comment), ''), 500)
  )
  returning * into v_review;

  -- Driver reviews feed the spot's rating.
  if v_uid = v_booking.driver_id then
    update public.spots s
    set rating_avg = agg.avg_rating,
        rating_count = agg.review_count
    from (
      select round(avg(r.rating), 1) as avg_rating, count(*)::integer as review_count
      from public.reviews r
      join public.bookings b on b.id = r.booking_id
      where b.spot_id = v_booking.spot_id and r.author_id = b.driver_id
    ) agg
    where s.id = v_booking.spot_id;
  end if;

  return v_review;
exception
  when unique_violation then
    raise exception 'ALREADY_REVIEWED';
end;
$$;

-------------------------------------------------------------------------------
-- expire_stale_bookings: run every minute by pg_cron (see the next migration).
-------------------------------------------------------------------------------
create function public.expire_stale_bookings()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.bookings
  set status = 'expired', expires_at = null
  where status = 'requested' and expires_at <= now();

  update public.bookings
  set status = 'no_show'
  where status = 'confirmed' and lower(during) + interval '15 minutes' < now();
end;
$$;

-------------------------------------------------------------------------------
-- Function privileges: clients may only call the public API functions.
-------------------------------------------------------------------------------
revoke execute on function
  public.generate_checkin_code(),
  public.is_within_availability(uuid, tstzrange),
  public.expire_stale_bookings(),
  public.nearby_spots(double precision, double precision, integer, timestamptz, timestamptz, public.vehicle_type, integer),
  public.request_booking(uuid, uuid, timestamptz, timestamptz, integer),
  public.respond_to_booking(uuid, boolean),
  public.cancel_booking(uuid, text),
  public.check_in(uuid),
  public.check_out(uuid),
  public.submit_review(uuid, smallint, text)
from public, anon, authenticated;

grant execute on function
  public.nearby_spots(double precision, double precision, integer, timestamptz, timestamptz, public.vehicle_type, integer),
  public.request_booking(uuid, uuid, timestamptz, timestamptz, integer),
  public.respond_to_booking(uuid, boolean),
  public.cancel_booking(uuid, text),
  public.check_in(uuid),
  public.check_out(uuid),
  public.submit_review(uuid, smallint, text)
to authenticated;
