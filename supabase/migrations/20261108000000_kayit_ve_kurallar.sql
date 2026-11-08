-- Lykiva — 3. aşama: profil tetikleyicisi, güvenlik kuralları (RLS) ve aktivite kaydetme
-- Gruplar, etkinlikler, mesajlar ve canlı konum kuralları 5. aşamada yazılacak (o tablolar kapalı kalır).

-- ---------------------------------------------------------------------------
-- Yeni kullanıcıya otomatik profil
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'k_' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Yeni kullanıcı'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Çevrimdışı kayıtların tekrar gönderilmesinde çift kayıt olmasın
alter table public.activities add column if not exists client_id uuid unique;

-- ---------------------------------------------------------------------------
-- Görünürlük yardımcıları
-- ---------------------------------------------------------------------------
create or replace function public.takip_ediyor_mu(hedef uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from follows where follower_id = auth.uid() and followee_id = hedef);
$$;

create or replace function public.aktivite_gorunur_mu(a public.activities)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    a.owner_id = auth.uid()
    or a.visibility = 'public'
    or (a.visibility = 'followers' and public.takip_ediyor_mu(a.owner_id))
    or exists (select 1 from activity_participants ap where ap.activity_id = a.id and ap.user_id = auth.uid());
$$;

create or replace function public.aktivite_sahibi_mi(aktivite uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from activities where id = aktivite and owner_id = auth.uid());
$$;

create or replace function public.aktiviteyi_gorebilir_mi(aktivite uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from activities a where a.id = aktivite and public.aktivite_gorunur_mu(a));
$$;

-- ---------------------------------------------------------------------------
-- Kurallar
-- ---------------------------------------------------------------------------
-- Profiller: giriş yapmış herkes görür (sosyal uygulama), herkes yalnızca kendini düzenler
create policy "profiller_okuma" on public.profiles for select to authenticated using (true);
create policy "profil_duzenleme" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Takip
create policy "takip_okuma" on public.follows for select to authenticated using (true);
create policy "takip_ekleme" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "takip_silme" on public.follows for delete to authenticated using (follower_id = auth.uid());

-- Aktiviteler
create policy "aktivite_okuma" on public.activities for select to authenticated using (public.aktivite_gorunur_mu(activities));
create policy "aktivite_ekleme" on public.activities for insert to authenticated with check (owner_id = auth.uid());
create policy "aktivite_duzenleme" on public.activities for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "aktivite_silme" on public.activities for delete to authenticated using (owner_id = auth.uid());

-- Aktiviteye bağlı tablolar: aktiviteyi görebilen okur, sahibi yazar
-- Ham noktaları yalnızca sahibi okur (başlangıç/bitiş gizliliği için); diğerleri aktivite_detay ve görünüm üzerinden görür
create policy "nokta_okuma" on public.activity_points for select to authenticated using (public.aktivite_sahibi_mi(activity_id));
create policy "nokta_yazma" on public.activity_points for insert to authenticated with check (public.aktivite_sahibi_mi(activity_id));
create policy "nokta_silme" on public.activity_points for delete to authenticated using (public.aktivite_sahibi_mi(activity_id));

create policy "mola_okuma" on public.activity_stops for select to authenticated using (public.aktiviteyi_gorebilir_mi(activity_id));
create policy "mola_yazma" on public.activity_stops for insert to authenticated with check (public.aktivite_sahibi_mi(activity_id));
create policy "mola_duzenleme" on public.activity_stops for update to authenticated using (public.aktivite_sahibi_mi(activity_id));
create policy "mola_silme" on public.activity_stops for delete to authenticated using (public.aktivite_sahibi_mi(activity_id));

create policy "katilimci_okuma" on public.activity_participants for select to authenticated using (public.aktiviteyi_gorebilir_mi(activity_id));
create policy "katilimci_yazma" on public.activity_participants for insert to authenticated with check (public.aktivite_sahibi_mi(activity_id));
create policy "katilimci_silme" on public.activity_participants for delete to authenticated using (public.aktivite_sahibi_mi(activity_id));

create policy "begeni_okuma" on public.activity_likes for select to authenticated using (public.aktiviteyi_gorebilir_mi(activity_id));
create policy "begeni_ekleme" on public.activity_likes for insert to authenticated with check (user_id = auth.uid() and public.aktiviteyi_gorebilir_mi(activity_id));
create policy "begeni_silme" on public.activity_likes for delete to authenticated using (user_id = auth.uid());

create policy "yorum_okuma" on public.activity_comments for select to authenticated using (public.aktiviteyi_gorebilir_mi(activity_id));
create policy "yorum_ekleme" on public.activity_comments for insert to authenticated with check (user_id = auth.uid() and public.aktiviteyi_gorebilir_mi(activity_id));
create policy "yorum_silme" on public.activity_comments for delete to authenticated using (user_id = auth.uid());

-- Rotalar: sahibi, herkese açıksa herkes, paylaşıldıysa paylaşılan kişi görür
create policy "rota_okuma" on public.routes for select to authenticated using (
  owner_id = auth.uid()
  or visibility = 'public'
  or exists (select 1 from route_shares rs where rs.route_id = routes.id and rs.user_id = auth.uid())
);
create policy "rota_ekleme" on public.routes for insert to authenticated with check (owner_id = auth.uid());
create policy "rota_duzenleme" on public.routes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "rota_silme" on public.routes for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Aktiviteyi tek seferde kaydet (aktivite + noktalar + molalar, tek işlem)
-- Çağıranın yetkileriyle çalışır (security invoker): kurallar geçerlidir.
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
    owner_id, client_id, title, activity, started_at, ended_at, moving_time_s, elapsed_time_s,
    distance_m, elevation_gain_m, elevation_loss_m, max_elevation_m,
    avg_speed_mps, max_speed_mps, min_moving_speed_mps, visibility, hide_endpoints, track
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

-- Başkasına gösterilen iz: hide_endpoints açıksa baştan ve sondan 200 m kırpılır
create or replace function public.gosterilecek_iz(a public.activities)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select case
    when a.track is null then null
    when a.owner_id = auth.uid() or not a.hide_endpoints then st_asgeojson(a.track::geometry)::jsonb
    when st_length(a.track) < 1000 then null
    else st_asgeojson(st_linesubstring(a.track::geometry, 200 / st_length(a.track), 1 - 200 / st_length(a.track)))::jsonb
  end;
$$;

-- Aktiviteyi okumayı kolaylaştıran görünüm: iz GeoJSON olarak, sahip bilgisiyle
create or replace view public.aktivite_ozetleri
with (security_invoker = true)
as
select
  a.id, a.owner_id, a.title, a.activity, a.started_at, a.ended_at, a.moving_time_s, a.elapsed_time_s,
  a.distance_m, a.elevation_gain_m, a.elevation_loss_m, a.max_elevation_m,
  a.avg_speed_mps, a.max_speed_mps, a.min_moving_speed_mps, a.visibility, a.hide_endpoints, a.created_at,
  public.gosterilecek_iz(a) as track_geojson,
  pr.display_name as owner_name,
  pr.username as owner_username
from public.activities a
join public.profiles pr on pr.id = a.owner_id;

-- Bir aktivitenin molaları ve hız/rakım profili (koordinatsız; mesafe ekseniyle)
create or replace function public.aktivite_detay(aktivite uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case when not public.aktiviteyi_gorebilir_mi(aktivite) then null else jsonb_build_object(
    'stops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'started_at', s.started_at, 'ended_at', s.ended_at, 'distance_at_m', s.distance_at_m,
        'lng', st_x(s.location::geometry), 'lat', st_y(s.location::geometry), 'note', s.note
      ) order by s.started_at)
      from activity_stops s where s.activity_id = aktivite
    ), '[]'::jsonb),
    'profile', coalesce((
      select jsonb_agg(jsonb_build_object('t', q.t, 'd', round(q.d::numeric, 1), 'alt', q.alt, 'speed', q.speed) order by q.seq)
      from (
        select
          p.seq,
          extract(epoch from p.recorded_at) * 1000 as t,
          coalesce(sum(st_distance(p.location, p.onceki)) over (order by p.seq), 0) as d,
          p.elevation_m as alt,
          p.speed_mps as speed
        from (
          select *, lag(location) over (order by seq) as onceki
          from activity_points where activity_id = aktivite
        ) p
      ) q
    ), '[]'::jsonb)
  ) end;
$$;

grant execute on function public.kaydet_aktivite(jsonb) to authenticated;
grant execute on function public.aktivite_detay(uuid) to authenticated;
grant select on public.aktivite_ozetleri to authenticated;
revoke execute on function public.kaydet_aktivite(jsonb) from public, anon;
revoke execute on function public.aktivite_detay(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
