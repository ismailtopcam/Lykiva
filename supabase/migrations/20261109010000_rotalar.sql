-- Lykiva — 4. aşama: rotalar
-- Rota kaydetme (çizilmiş ya da bir aktiviteden), okuma görünümü; aktiviteye takip edilen rotayı bağlama.

-- ---------------------------------------------------------------------------
-- Rota kaydet / güncelle (p.id verilirse ve sahibiysen günceller)
-- p.points: [{lat, lng, alt}], en az 2 nokta
-- ---------------------------------------------------------------------------
create or replace function public.kaydet_rota(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  yol geography;
  rid uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if jsonb_array_length(coalesce(p -> 'points', '[]'::jsonb)) < 2 then
    raise exception 'Rota için en az iki nokta gerekli';
  end if;
  if coalesce(trim(p ->> 'name'), '') = '' then
    raise exception 'Rota adı gerekli';
  end if;

  select st_makeline(
           st_setsrid(st_makepoint((pt ->> 'lng')::float8, (pt ->> 'lat')::float8, coalesce((pt ->> 'alt')::float8, 0)), 4326)
           order by n
         )::geography
    into yol
    from jsonb_array_elements(p -> 'points') with ordinality as x(pt, n);

  if p ? 'id' then
    update routes set
      name = trim(p ->> 'name'),
      activity = (p ->> 'activity')::activity_type,
      path = yol,
      distance_m = (p ->> 'distance_m')::float8,
      elevation_gain_m = (p ->> 'elevation_gain_m')::float8,
      elevation_loss_m = (p ->> 'elevation_loss_m')::float8,
      difficulty = (p ->> 'difficulty')::difficulty,
      is_loop = coalesce((p ->> 'is_loop')::boolean, false),
      surface = p -> 'surface',
      notes = nullif(p ->> 'notes', ''),
      visibility = coalesce((p ->> 'visibility')::visibility, visibility)
    where id = (p ->> 'id')::uuid and owner_id = auth.uid()
    returning id into rid;
    if rid is null then
      raise exception 'Rota bulunamadı ya da düzenleme iznin yok';
    end if;
    return rid;
  end if;

  insert into routes (owner_id, name, activity, path, distance_m, elevation_gain_m, elevation_loss_m, difficulty, is_loop, surface, notes, visibility)
  values (
    auth.uid(),
    trim(p ->> 'name'),
    (p ->> 'activity')::activity_type,
    yol,
    (p ->> 'distance_m')::float8,
    (p ->> 'elevation_gain_m')::float8,
    (p ->> 'elevation_loss_m')::float8,
    (p ->> 'difficulty')::difficulty,
    coalesce((p ->> 'is_loop')::boolean, false),
    p -> 'surface',
    nullif(p ->> 'notes', ''),
    coalesce((p ->> 'visibility')::visibility, 'private')
  )
  returning id into rid;
  return rid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kendi aktiviteni rota olarak kaydet (tam iz kullanılır, ~2 m sadeleştirilir)
-- ---------------------------------------------------------------------------
create or replace function public.aktiviteden_rota(aktivite uuid, ad text, gorunurluk visibility default 'private')
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  a activities;
  rid uuid;
begin
  select * into a from activities where id = aktivite and owner_id = auth.uid();
  if a.id is null then
    raise exception 'Aktivite bulunamadı ya da senin değil';
  end if;
  if a.track is null then
    raise exception 'Bu aktivitede iz yok';
  end if;
  insert into routes (owner_id, name, activity, path, distance_m, elevation_gain_m, elevation_loss_m, is_loop, visibility)
  values (
    auth.uid(),
    coalesce(nullif(trim(ad), ''), a.title, 'Rotam'),
    a.activity,
    st_simplifypreservetopology(a.track::geometry, 0.00002)::geography,
    a.distance_m,
    a.elevation_gain_m,
    a.elevation_loss_m,
    st_distance(st_startpoint(a.track::geometry)::geography, st_endpoint(a.track::geometry)::geography) < 150,
    gorunurluk
  )
  returning id into rid;
  return rid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rota okuma görünümü: yol GeoJSON (Z = rakım), sahip adı
-- ---------------------------------------------------------------------------
create or replace view public.rota_ozetleri
with (security_invoker = true)
as
select
  r.id, r.owner_id, r.name, r.activity, r.distance_m, r.elevation_gain_m, r.elevation_loss_m,
  r.difficulty, r.is_loop, r.surface, r.notes, r.visibility, r.created_at,
  extensions.st_asgeojson(r.path::extensions.geometry, 6)::jsonb as path_geojson,
  pr.display_name as owner_name,
  pr.username as owner_username
from public.routes r
join public.profiles pr on pr.id = r.owner_id;

-- ---------------------------------------------------------------------------
-- kaydet_aktivite: takip edilen rotayı (route_id) da kaydet
-- ---------------------------------------------------------------------------
create or replace function public.kaydet_aktivite(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  yeni_id uuid;
  mevcut uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;

  if p ? 'client_id' then
    select id into mevcut from activities where client_id = (p ->> 'client_id')::uuid and owner_id = auth.uid();
    if mevcut is not null then
      return mevcut;
    end if;
  end if;

  if jsonb_array_length(coalesce(p -> 'points', '[]'::jsonb)) < 2 then
    raise exception 'En az iki GPS noktası gerekli';
  end if;

  insert into activities (
    owner_id, client_id, route_id, title, activity, started_at, ended_at, moving_time_s, elapsed_time_s,
    distance_m, elevation_gain_m, elevation_loss_m, max_elevation_m,
    avg_speed_mps, max_speed_mps, min_moving_speed_mps, visibility, hide_endpoints, track
  )
  select
    auth.uid(),
    (p ->> 'client_id')::uuid,
    (select r.id from routes r where r.id = (p ->> 'route_id')::uuid),
    nullif(p ->> 'title', ''),
    (p ->> 'activity')::activity_type,
    (p ->> 'started_at')::timestamptz,
    (p ->> 'ended_at')::timestamptz,
    (p ->> 'moving_time_s')::int,
    (p ->> 'elapsed_time_s')::int,
    (p ->> 'distance_m')::double precision,
    (p ->> 'elevation_gain_m')::double precision,
    (p ->> 'elevation_loss_m')::double precision,
    (p ->> 'max_elevation_m')::double precision,
    (p ->> 'avg_speed_mps')::double precision,
    (p ->> 'max_speed_mps')::double precision,
    (p ->> 'min_moving_speed_mps')::double precision,
    coalesce((p ->> 'visibility')::visibility, 'followers'),
    coalesce((p ->> 'hide_endpoints')::boolean, true),
    (
      select st_makeline(st_setsrid(st_makepoint((pt ->> 'lng')::float8, (pt ->> 'lat')::float8, coalesce((pt ->> 'alt')::float8, 0)), 4326) order by (pt ->> 't')::bigint)::geography
      from jsonb_array_elements(p -> 'points') pt
    )
  returning id into yeni_id;

  insert into activity_points (activity_id, seq, recorded_at, location, elevation_m, speed_mps)
  select
    yeni_id,
    (n - 1)::int,
    to_timestamp((pt ->> 't')::bigint / 1000.0),
    st_setsrid(st_makepoint((pt ->> 'lng')::float8, (pt ->> 'lat')::float8), 4326)::geography,
    (pt ->> 'alt')::float8,
    (pt ->> 'speed')::float8
  from jsonb_array_elements(p -> 'points') with ordinality as x(pt, n);

  insert into activity_stops (activity_id, started_at, ended_at, location, distance_at_m)
  select
    yeni_id,
    to_timestamp((s ->> 'startT')::bigint / 1000.0),
    to_timestamp((s ->> 'endT')::bigint / 1000.0),
    st_setsrid(st_makepoint((s ->> 'lng')::float8, (s ->> 'lat')::float8), 4326)::geography,
    (s ->> 'distanceAtM')::float8
  from jsonb_array_elements(coalesce(p -> 'stops', '[]'::jsonb)) s;

  return yeni_id;
end;
$$;


grant execute on function public.kaydet_rota(jsonb) to authenticated;
grant execute on function public.aktiviteden_rota(uuid, text, visibility) to authenticated;
grant select on public.rota_ozetleri to authenticated;
revoke execute on function public.kaydet_rota(jsonb) from public, anon;
revoke execute on function public.aktiviteden_rota(uuid, text, visibility) from public, anon;
revoke execute on function public.kaydet_aktivite(jsonb) from public, anon;
