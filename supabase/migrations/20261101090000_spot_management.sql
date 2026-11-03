-- Host spot management: create and update a listing together with its private
-- access details and opening hours in one transaction.
--
-- Both functions are SECURITY INVOKER: they run with the caller's privileges, so
-- the existing RLS policies and column grants decide what a host may change.
--
-- p_availability is a JSON array of {"weekday": 0-6, "start": "HH:MM", "end": "HH:MM"}
-- (0 = Sunday, "24:00" = end of day). An empty array means open 24/7.

create function public.replace_availability(p_spot_id uuid, p_availability jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_availability is null or jsonb_typeof(p_availability) <> 'array' then
    raise exception 'INVALID_AVAILABILITY';
  end if;

  delete from public.availability_rules where spot_id = p_spot_id;

  insert into public.availability_rules (spot_id, weekday, start_time, end_time)
  select p_spot_id, (rule ->> 'weekday')::smallint, (rule ->> 'start')::time, (rule ->> 'end')::time
  from jsonb_array_elements(p_availability) as rule;
exception
  when check_violation or invalid_datetime_format or invalid_text_representation
    or datetime_field_overflow or not_null_violation then
    raise exception 'INVALID_AVAILABILITY';
end;
$$;

create function public.create_spot(
  p_title text,
  p_description text,
  p_area_label text,
  p_vehicle_types public.vehicle_type[],
  p_is_covered boolean,
  p_has_cctv boolean,
  p_has_ev_charging boolean,
  p_has_security_guard boolean,
  p_max_height_cm integer,
  p_hourly_rate_paise integer,
  p_instant_book boolean,
  p_lat double precision,
  p_lng double precision,
  p_address text,
  p_access_instructions text,
  p_availability jsonb default '[]'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_spot_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_lat is null or p_lng is null
    or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'INVALID_COORDINATES';
  end if;

  insert into public.spots (
    host_id, title, description, area_label, vehicle_types, is_covered, has_cctv,
    has_ev_charging, has_security_guard, max_height_cm, hourly_rate_paise, instant_book
  )
  values (
    auth.uid(), trim(p_title), nullif(trim(p_description), ''), nullif(trim(p_area_label), ''),
    p_vehicle_types, p_is_covered, p_has_cctv, p_has_ev_charging, p_has_security_guard,
    p_max_height_cm, p_hourly_rate_paise, p_instant_book
  )
  returning id into v_spot_id;

  -- The trigger on spot_access fills in the spot's rounded public location.
  insert into public.spot_access (spot_id, location, address, access_instructions)
  values (
    v_spot_id,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    trim(p_address),
    nullif(trim(p_access_instructions), '')
  );

  perform public.replace_availability(v_spot_id, p_availability);

  update public.spots set status = 'active' where id = v_spot_id;

  return v_spot_id;
exception
  when check_violation then
    raise exception 'INVALID_SPOT_DETAILS';
end;
$$;

create function public.update_spot(
  p_spot_id uuid,
  p_title text,
  p_description text,
  p_area_label text,
  p_vehicle_types public.vehicle_type[],
  p_is_covered boolean,
  p_has_cctv boolean,
  p_has_ev_charging boolean,
  p_has_security_guard boolean,
  p_max_height_cm integer,
  p_hourly_rate_paise integer,
  p_instant_book boolean,
  p_lat double precision,
  p_lng double precision,
  p_address text,
  p_access_instructions text,
  p_availability jsonb default '[]'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_lat is null or p_lng is null
    or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'INVALID_COORDINATES';
  end if;

  -- RLS limits this to the caller's own, non-suspended spots.
  update public.spots
  set title = trim(p_title),
      description = nullif(trim(p_description), ''),
      area_label = nullif(trim(p_area_label), ''),
      vehicle_types = p_vehicle_types,
      is_covered = p_is_covered,
      has_cctv = p_has_cctv,
      has_ev_charging = p_has_ev_charging,
      has_security_guard = p_has_security_guard,
      max_height_cm = p_max_height_cm,
      hourly_rate_paise = p_hourly_rate_paise,
      instant_book = p_instant_book
  where id = p_spot_id;

  if not found then
    raise exception 'SPOT_NOT_FOUND';
  end if;

  update public.spot_access
  set location = extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
      address = trim(p_address),
      access_instructions = nullif(trim(p_access_instructions), '')
  where spot_id = p_spot_id;

  perform public.replace_availability(p_spot_id, p_availability);
exception
  when check_violation then
    raise exception 'INVALID_SPOT_DETAILS';
end;
$$;

revoke execute on function
  public.replace_availability(uuid, jsonb),
  public.create_spot(text, text, text, public.vehicle_type[], boolean, boolean, boolean, boolean, integer, integer, boolean, double precision, double precision, text, text, jsonb),
  public.update_spot(uuid, text, text, text, public.vehicle_type[], boolean, boolean, boolean, boolean, integer, integer, boolean, double precision, double precision, text, text, jsonb)
from public, anon;

grant execute on function
  public.replace_availability(uuid, jsonb),
  public.create_spot(text, text, text, public.vehicle_type[], boolean, boolean, boolean, boolean, integer, integer, boolean, double precision, double precision, text, text, jsonb),
  public.update_spot(uuid, text, text, text, public.vehicle_type[], boolean, boolean, boolean, boolean, integer, integer, boolean, double precision, double precision, text, text, jsonb)
to authenticated;

-- Spot photos: one listing may have at most 6.
create function public.limit_spot_photos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.spot_photos where spot_id = new.spot_id) >= 6 then
    raise exception 'TOO_MANY_PHOTOS';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_spot_photos() from public, anon, authenticated;

create trigger spot_photos_limit
before insert on public.spot_photos
for each row execute function public.limit_spot_photos();
