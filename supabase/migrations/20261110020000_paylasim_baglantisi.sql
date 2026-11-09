-- Lykiva — 13. aşama: aktivite paylaşım bağlantısı (web sayfası)
--
-- - Aktivitenin sahibi bir bağlantı açar: https://lykiva.ismailtopcam.dev/a/<anahtar>
-- - Anahtar 32 karakter rastgele (gen_random_uuid, 122 bit); tahmin edilemez
-- - Bağlantısı olan herkes giriş yapmadan görür (web sayfası anon anahtarla okur)
-- - Sahibi bağlantıyı kapatınca sayfa açılmaz; yeniden açarsa yeni anahtar üretilir
-- - Sayfaya giden iz, başlangıç/bitiş gizliyse baştan ve sondan 200 m kırpılır; ham GPS noktaları verilmez
-- - Anahtarlar ayrı tabloda ve istemciye kapalı: aktiviteyi görebilen biri bile anahtarı okuyamaz

create table if not exists public.aktivite_baglantilari (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  anahtar text not null unique check (anahtar ~ '^[0-9a-f]{32}$'),
  created_at timestamptz not null default now()
);
alter table public.aktivite_baglantilari enable row level security;
revoke all on public.aktivite_baglantilari from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sahibi için: bağlantı aç / durum / kapat
-- ---------------------------------------------------------------------------
create or replace function public.paylasim_baglantisi_ac(aktivite uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  mevcut text;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if not exists (select 1 from activities where id = aktivite and owner_id = auth.uid()) then
    raise exception 'Yalnızca kendi aktiviten için bağlantı açabilirsin';
  end if;
  select anahtar into mevcut from aktivite_baglantilari where activity_id = aktivite;
  if mevcut is not null then
    return mevcut;
  end if;
  insert into aktivite_baglantilari (activity_id, anahtar)
  values (aktivite, replace(gen_random_uuid()::text, '-', ''))
  returning anahtar into mevcut;
  return mevcut;
end;
$$;

-- Açık bağlantının anahtarı; yoksa null
create or replace function public.paylasim_baglantisi(aktivite uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select b.anahtar
  from aktivite_baglantilari b
  join activities a on a.id = b.activity_id
  where b.activity_id = aktivite and a.owner_id = auth.uid();
$$;

create or replace function public.paylasim_baglantisi_kapat(aktivite uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from aktivite_baglantilari b
  using activities a
  where b.activity_id = aktivite and a.id = b.activity_id and a.owner_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Herkese açık okuma: web paylaşım sayfası (anon)
-- ---------------------------------------------------------------------------
create or replace function public.paylasilan_aktivite(anahtar text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with a as (
    select ac.*
    from aktivite_baglantilari b
    join activities ac on ac.id = b.activity_id
    where b.anahtar = paylasilan_aktivite.anahtar
  ),
  iz as (
    -- Kimin çağırdığına bakmadan kırp (sahibi kendi oturumuyla çağırsa bile sayfa herkese açık)
    select case
      when a.track is null then null
      when not a.hide_endpoints then a.track::geometry
      when st_length(a.track) < 1000 then null
      else st_linesubstring(a.track::geometry, 200 / st_length(a.track), 1 - 200 / st_length(a.track))
    end as g
    from a
  ),
  noktalar as (
    select
      p.seq,
      p.elevation_m,
      coalesce(sum(st_distance(p.location, p.onceki)) over (order by p.seq), 0) as d
    from (
      select pt.*, lag(pt.location) over (order by pt.seq) as onceki
      from activity_points pt, a
      where pt.activity_id = a.id
    ) p
  ),
  profil as (
    -- Yükseklik profili: en fazla ~120 nokta [mesafe m, yükseklik m]; konum içermez
    select coalesce(jsonb_agg(jsonb_build_array(round(d::numeric), round(elevation_m::numeric, 1)) order by seq), '[]'::jsonb) as j
    from (
      select seq, d, elevation_m, row_number() over (order by seq) as sira, count(*) over () as toplam
      from noktalar
      where elevation_m is not null
    ) x
    where (sira - 1) % greatest(1, ceil(toplam / 120.0)::int) = 0 or sira = toplam
  )
  select jsonb_build_object(
    'title', a.title,
    'activity', a.activity,
    'started_at', a.started_at,
    'moving_time_s', a.moving_time_s,
    'elapsed_time_s', a.elapsed_time_s,
    'distance_m', a.distance_m,
    'elevation_gain_m', a.elevation_gain_m,
    'elevation_loss_m', a.elevation_loss_m,
    'max_elevation_m', a.max_elevation_m,
    'avg_speed_mps', a.avg_speed_mps,
    'max_speed_mps', a.max_speed_mps,
    'owner_name', pr.display_name,
    'endpoints_hidden', a.hide_endpoints,
    'track', (select st_asgeojson(st_simplify(st_force2d(iz.g), 0.00005), 5)::jsonb -> 'coordinates' from iz where iz.g is not null),
    'elevation', (select j from profil),
    'stop_count', (select count(*) from activity_stops s where s.activity_id = a.id),
    'like_count', (select count(*) from activity_likes l where l.activity_id = a.id),
    'comment_count', (select count(*) from activity_comments c where c.activity_id = a.id)
  )
  from a
  join profiles pr on pr.id = a.owner_id;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function public.paylasim_baglantisi_ac(uuid) from public, anon;
revoke execute on function public.paylasim_baglantisi(uuid) from public, anon;
revoke execute on function public.paylasim_baglantisi_kapat(uuid) from public, anon;
grant execute on function public.paylasim_baglantisi_ac(uuid) to authenticated;
grant execute on function public.paylasim_baglantisi(uuid) to authenticated;
grant execute on function public.paylasim_baglantisi_kapat(uuid) to authenticated;

revoke execute on function public.paylasilan_aktivite(text) from public;
grant execute on function public.paylasilan_aktivite(text) to anon, authenticated;
