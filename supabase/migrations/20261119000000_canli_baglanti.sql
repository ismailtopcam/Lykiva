-- Lykiva — canlı konum bağlantısı (aileyle, arkadaşla paylaşım; AllTrails Live Share / Garmin LiveTrack gibi)
--
-- - Kayıt başlatırken "Bağlantıyla paylaş" seçilirse canli_baglanti_ac() tahmin edilemez bir anahtar üretir
--   (32 onaltılık, gen_random_uuid). https://lykiva.app/c/<anahtar> adresini bilen, uygulaması olmayan biri de
--   kaydı süren kişinin canlı konumunu görür (web sayfası anon anahtarla canli_baglanti() çağırır).
-- - Bağlantı en fazla 24 saat geçerlidir; kayıt bitince / silinince (canli_konum_bitir) ya da elle
--   (canli_baglanti_kapat) hemen kapanır. Kapanınca sayfa "paylaşım bitti" der, konum göstermez.
-- - Konum yine live_locations'ta (kullanıcı başına tek satır). Grupla paylaşım ayrıdır; ikisi birlikte de olabilir.
--   canli_konum_gonder artık grup olmadan da çağrılabilir (açık bağlantı varsa).
-- - Bağlantı açıkken son iz satırda tutulur (iz: [[lng, lat, unix sn], ...], en fazla 480 nokta ≈ 15 sn'de bir
--   2 saat); yeni kayıt başlayınca sıfırlanır, kayıt bitince satırla birlikte silinir.
-- - Hareketsizlik: konum, son "hareket noktasından" 30 m'den fazla uzaklaşınca son_hareket güncellenir. Sayfa,
--   molada değilken uzun süre hareket yoksa ve konum uzun süre gelmezse uyarır.
-- - Anahtarlar istemciye kapalı tabloda; sayfaya kullanıcının kimliği değil yalnızca görünen adı gider.

alter table public.live_locations add column if not exists iz jsonb;
alter table public.live_locations add column if not exists hareket_noktasi geography(Point, 4326);
alter table public.live_locations add column if not exists son_hareket timestamptz;

create table if not exists public.canli_baglantilar (
  anahtar text primary key check (anahtar ~ '^[0-9a-f]{32}$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  bitis timestamptz not null
);
create index if not exists canli_baglantilar_kullanici_idx on public.canli_baglantilar (user_id, bitis desc);
alter table public.canli_baglantilar enable row level security;
revoke all on public.canli_baglantilar from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bağlantı aç / kapat
-- ---------------------------------------------------------------------------
create or replace function public.canli_baglanti_ac()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  -- Açık bağlantı varsa aynısı (kayıt yeniden başlatılsa da aile aynı adresten izlemeye devam eder)
  select anahtar into v from canli_baglantilar where user_id = auth.uid() and bitis > now() order by created_at desc limit 1;
  if v is not null then
    return v;
  end if;
  if (select count(*) from canli_baglantilar where user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Bugün çok fazla bağlantı açtın, biraz sonra yeniden dene';
  end if;
  insert into canli_baglantilar (anahtar, user_id, bitis)
  values (replace(gen_random_uuid()::text, '-', ''), auth.uid(), now() + interval '24 hours')
  returning anahtar into v;
  return v;
end;
$$;

create or replace function public.canli_baglanti_kapat()
returns void
language sql
security definer
set search_path = public
as $$
  update canli_baglantilar set bitis = now() where user_id = auth.uid() and bitis > now();
$$;

-- ---------------------------------------------------------------------------
-- İz: son 480 nokta
-- ---------------------------------------------------------------------------
create or replace function public.canli_iz_ekle(iz jsonb, lng float8, lat float8)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
  from (
    select e, i
    from jsonb_array_elements(
      coalesce(iz, '[]'::jsonb) || jsonb_build_array(jsonb_build_array(round(lng::numeric, 6), round(lat::numeric, 6), extract(epoch from now())::bigint))
    ) with ordinality as t(e, i)
    order by i desc
    limit 480
  ) x;
$$;

-- ---------------------------------------------------------------------------
-- Konumu yayınla: grup ya da açık bağlantı gerekir (20261109050000'deki sürümün yerine)
-- ---------------------------------------------------------------------------
create or replace function public.canli_konum_gonder(p jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  grup uuid := nullif(p ->> 'group_id', '')::uuid;
  lng float8 := (p ->> 'lng')::float8;
  lat float8 := (p ->> 'lat')::float8;
  baglanti boolean;
  nokta geography;
  baslangic timestamptz := nullif(p ->> 'started_at', '')::timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  baglanti := exists (select 1 from canli_baglantilar where user_id = auth.uid() and bitis > now());
  if grup is not null and not public.grup_uyesi_mi(grup) then
    raise exception 'Bu grubun üyesi değilsin';
  end if;
  if grup is null and not baglanti then
    raise exception 'Konum paylaşımı açık değil';
  end if;
  if lng is null or lat is null or lng not between -180 and 180 or lat not between -90 and 90 then
    raise exception 'Konum geçersiz';
  end if;
  nokta := st_setsrid(st_makepoint(lng, lat), 4326)::geography;
  insert into live_locations (user_id, activity, location, speed_mps, is_paused, shared_with_group, distance_m, started_at, updated_at,
                              iz, hareket_noktasi, son_hareket)
  values (
    auth.uid(),
    nullif(p ->> 'activity', '')::activity_type,
    nokta,
    case when (p ->> 'speed_mps')::float8 >= 0 then least((p ->> 'speed_mps')::float8, 100) end,
    coalesce((p ->> 'is_paused')::boolean, false),
    grup,
    nullif(p ->> 'distance_m', '')::float8,
    baslangic,
    now(),
    case when baglanti then public.canli_iz_ekle(null, lng, lat) end,
    nokta,
    now()
  )
  on conflict (user_id) do update set
    activity = excluded.activity,
    location = excluded.location,
    speed_mps = excluded.speed_mps,
    is_paused = excluded.is_paused,
    shared_with_group = excluded.shared_with_group,
    distance_m = excluded.distance_m,
    started_at = excluded.started_at,
    updated_at = now(),
    -- Yeni kayıtta iz baştan başlar; bağlantı yoksa iz tutulmaz
    iz = case
      when not baglanti then null
      when live_locations.started_at is distinct from excluded.started_at then public.canli_iz_ekle(null, lng, lat)
      else public.canli_iz_ekle(live_locations.iz, lng, lat)
    end,
    hareket_noktasi = case
      when live_locations.hareket_noktasi is null or live_locations.started_at is distinct from excluded.started_at
        or st_distance(live_locations.hareket_noktasi, excluded.location) > 30 then excluded.location
      else live_locations.hareket_noktasi
    end,
    son_hareket = case
      when live_locations.hareket_noktasi is null or live_locations.started_at is distinct from excluded.started_at
        or st_distance(live_locations.hareket_noktasi, excluded.location) > 30 then now()
      else live_locations.son_hareket
    end;
end;
$$;

-- Paylaşımı bitir: satırı sil, açık bağlantıyı kapat (20261109050000'deki sürümün yerine)
create or replace function public.canli_konum_bitir()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from live_locations where user_id = auth.uid();
  update canli_baglantilar set bitis = now() where user_id = auth.uid() and bitis > now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Web sayfası: bağlantının durumu ve canlı konum (giriş gerekmez)
-- ---------------------------------------------------------------------------
create or replace function public.canli_baglanti(anahtar text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  b canli_baglantilar;
  ad text;
  l live_locations;
begin
  select * into b from canli_baglantilar where canli_baglantilar.anahtar = canli_baglanti.anahtar;
  if b.anahtar is null then
    return null;
  end if;
  select display_name into ad from profiles where id = b.user_id;
  if b.bitis <= now() then
    return jsonb_build_object('durum', 'bitti', 'ad', ad);
  end if;
  select * into l from live_locations where user_id = b.user_id;
  if l.user_id is null then
    return jsonb_build_object('durum', 'bekliyor', 'ad', ad, 'bitis', b.bitis);
  end if;
  return jsonb_build_object(
    'durum', 'canli',
    'ad', ad,
    'activity', l.activity,
    'lng', st_x(l.location::geometry),
    'lat', st_y(l.location::geometry),
    'speed_mps', l.speed_mps,
    'is_paused', l.is_paused,
    'distance_m', l.distance_m,
    'started_at', l.started_at,
    'updated_at', l.updated_at,
    'son_hareket', l.son_hareket,
    'iz', coalesce(l.iz, '[]'::jsonb),
    'bitis', b.bitis
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function public.canli_baglanti_ac() from public, anon;
revoke execute on function public.canli_baglanti_kapat() from public, anon;
grant execute on function public.canli_baglanti_ac() to authenticated;
grant execute on function public.canli_baglanti_kapat() to authenticated;
revoke execute on function public.canli_baglanti(text) from public;
grant execute on function public.canli_baglanti(text) to anon, authenticated;
revoke execute on function public.canli_iz_ekle(jsonb, float8, float8) from public, anon, authenticated;
