-- Lykiva — 5. aşama: rotalar
--
-- - rota_kaydet(p): çizilen rotayı kaydeder (noktalar [[lng, lat, ele], ...])
-- - rota_detay(id): rota + koordinatlar (GeoJSON) + sahibi
-- - rota_ozetleri: liste için görünüm (seyreltilmiş önizleme koordinatlarıyla)
-- - aktiviteden_rota(aktivite, ad): kendi aktiviteni rota olarak kaydet
-- - kaydet_aktivite: takip edilen rota (route_id) da kaydedilir
--
-- Yüksekliği bilinmeyen noktalar (serbest çizim) Z = 0 ile saklanır; tırmanış istemcide yalnızca
-- bilinen yüksekliklerden hesaplanır ve elevation_gain_m alanına yazılır.

create or replace function public.rota_kaydet(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  yeni_id uuid;
  ad text := nullif(trim(p ->> 'name'), '');
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if ad is null then
    raise exception 'Rota adı gerekli';
  end if;
  if jsonb_array_length(coalesce(p -> 'points', '[]'::jsonb)) < 2 then
    raise exception 'En az iki nokta gerekli';
  end if;
  if jsonb_array_length(p -> 'points') > 20000 then
    raise exception 'Rota çok uzun (en fazla 20.000 nokta)';
  end if;

  insert into routes (
    owner_id, name, activity, path, distance_m, elevation_gain_m, elevation_loss_m,
    difficulty, is_loop, surface, notes, visibility
  )
  select
    auth.uid(),
    left(ad, 120),
    (p ->> 'activity')::activity_type,
    (
      select st_makeline(
        st_setsrid(st_makepoint((c ->> 0)::float8, (c ->> 1)::float8, coalesce((c ->> 2)::float8, 0)), 4326)
        order by n
      )::geography
      from jsonb_array_elements(p -> 'points') with ordinality as x(c, n)
    ),
    (p ->> 'distance_m')::double precision,
    (p ->> 'elevation_gain_m')::double precision,
    (p ->> 'elevation_loss_m')::double precision,
    nullif(p ->> 'difficulty', '')::difficulty,
    coalesce((p ->> 'is_loop')::boolean, false),
    p -> 'surface',
    nullif(trim(p ->> 'notes'), ''),
    coalesce(nullif(p ->> 'visibility', '')::visibility, 'private')
  returning id into yeni_id;

  return yeni_id;
end;
$$;

-- Liste görünümü: önizleme için ~150 noktaya inen sadeleştirilmiş çizgi
create or replace view public.rota_ozetleri
with (security_invoker = true)
as
select
  r.id, r.owner_id, r.name, r.activity, r.distance_m, r.elevation_gain_m, r.elevation_loss_m,
  r.difficulty, r.is_loop, r.surface, r.visibility, r.created_at,
  st_asgeojson(st_simplify(r.path::geometry, greatest(r.distance_m / 150 / 111195, 0.00001)), 6)::jsonb as preview_geojson,
  pr.display_name as owner_name,
  pr.username as owner_username
from public.routes r
join public.profiles pr on pr.id = r.owner_id;

-- Tek rota: tüm koordinatlar [lng, lat, ele]
create or replace function public.rota_detay(rota uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', r.id,
    'owner_id', r.owner_id,
    'owner_name', pr.display_name,
    'name', r.name,
    'activity', r.activity,
    'distance_m', r.distance_m,
    'elevation_gain_m', r.elevation_gain_m,
    'elevation_loss_m', r.elevation_loss_m,
    'difficulty', r.difficulty,
    'is_loop', r.is_loop,
    'surface', r.surface,
    'notes', r.notes,
    'visibility', r.visibility,
    'created_at', r.created_at,
    'coordinates', st_asgeojson(r.path::geometry, 6)::jsonb -> 'coordinates',
    'done_count', (select count(*) from activities a where a.route_id = r.id)
  )
  from routes r
  join profiles pr on pr.id = r.owner_id
  where r.id = rota;
$$;

-- Kendi aktiviteni rota olarak kaydet (sadeleştirilmiş iz kullanılır)
create or replace function public.aktiviteden_rota(aktivite uuid, ad text)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  yeni_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  insert into routes (owner_id, name, activity, path, distance_m, elevation_gain_m, elevation_loss_m, is_loop, visibility)
  select
    auth.uid(),
    left(coalesce(nullif(trim(ad), ''), a.title, 'Rota'), 120),
    a.activity,
    a.track,
    a.distance_m,
    a.elevation_gain_m,
    a.elevation_loss_m,
    st_distance(st_startpoint(a.track::geometry)::geography, st_endpoint(a.track::geometry)::geography) < 150,
    'private'
  from activities a
  where a.id = aktivite and a.owner_id = auth.uid() and a.track is not null
  returning id into yeni_id;

  if yeni_id is null then
    raise exception 'Aktivite bulunamadı';
  end if;
  return yeni_id;
end;
$$;

-- Aktivite kaydı: takip edilen rota da yazılır (önceki tanımın aynısı + route_id)
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
    owner_id, client_id, title, activity, started_at, ended_at, moving_time_s, elapsed_time_s,
    distance_m, elevation_gain_m, elevation_loss_m, max_elevation_m,
    avg_speed_mps, max_speed_mps, min_moving_speed_mps, visibility, hide_endpoints, track, route_id
  )
  select
    auth.uid(),
    (p ->> 'client_id')::uuid,
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
    ),
    -- Takip edilen rota: silinmiş ya da görülemiyorsa boş kalır (kayıt yine de kaydedilir)
    (select r.id from routes r where r.id = nullif(p ->> 'route_id', '')::uuid)
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

grant execute on function public.rota_kaydet(jsonb) to authenticated;
grant execute on function public.rota_detay(uuid) to authenticated;
grant execute on function public.aktiviteden_rota(uuid, text) to authenticated;
revoke execute on function public.rota_kaydet(jsonb) from public, anon;
revoke execute on function public.rota_detay(uuid) from public, anon;
revoke execute on function public.aktiviteden_rota(uuid, text) from public, anon;
grant select on public.rota_ozetleri to authenticated;
