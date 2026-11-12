-- Lykiva — gizlilik kontrolleri (mobil: Ayarlar > Gizlilik kontrolleri)
--
-- Her biri için üç seçenek: 'herkes', 'takipciler' (beni takip edenler), 'kimse'. Kendin her zaman görürsün.
--
-- - profil_gizliligi: profil sayfasındaki ayrıntılar (hakkında, şehir, takipçi / takip / aktivite sayıları,
--   takip listeleri). İzin yoksa kisi_profili() yalnızca ad, kullanıcı adı ve fotoğrafı verir ('kisitli': true);
--   web profili (/u/<kullanıcı>, oturumsuz) yalnızca 'herkes' iken açılır.
-- - aktivite_gizliligi: yeni kayıtların varsayılan görünürlüğü (herkes → public, takipciler → followers,
--   kimse → private). İstenirse geçmiş aktivitelerin hepsine de uygulanır. Aktivite başına seçim (gruplarım dahil)
--   kayıttan sonra yine değiştirilebilir.
-- - grup_aktivite_gizliligi: başkasının aktivitesinde "birlikte" etiketli olduğunu kimin göreceği
--   (aktivitenin sahibi her zaman görür). birlikte_kisiler(), akış kartı ve activity_participants okuma kuralı.
-- - bahsetme_izni: seni bir aktiviteye kimin etiketleyebileceği (herkes = takipleştiğin ya da ortak grubun olan
--   herkes, önceki kural; takipciler = yalnızca seni takip edenler; kimse = hiç kimse).
--
-- Bilinen sınır: profiles ve follows tablolarını doğrudan okuyan biri (uygulama değil, API'yi elle kullanan)
-- hakkında / şehir / sayıları görebilir; uygulama ve web bu fonksiyonlardan okur.

alter table public.profiles add column if not exists profil_gizliligi text not null default 'herkes';
alter table public.profiles add column if not exists aktivite_gizliligi text not null default 'takipciler';
alter table public.profiles add column if not exists grup_aktivite_gizliligi text not null default 'herkes';
alter table public.profiles add column if not exists bahsetme_izni text not null default 'herkes';

alter table public.profiles drop constraint if exists profil_gizlilik_gecerli;
alter table public.profiles add constraint profil_gizlilik_gecerli check (
  profil_gizliligi in ('herkes', 'takipciler', 'kimse')
  and aktivite_gizliligi in ('herkes', 'takipciler', 'kimse')
  and grup_aktivite_gizliligi in ('herkes', 'takipciler', 'kimse')
  and bahsetme_izni in ('herkes', 'takipciler', 'kimse')
);

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

-- Oturumdaki kişi, `sahip`in bu düzeyle korunan bilgisini görebilir / ona bu işi yapabilir mi?
create or replace function public.gizlilik_izin_veriyor_mu(sahip uuid, duzey text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    sahip = auth.uid()
    or duzey = 'herkes'
    or (duzey = 'takipciler' and public.takip_ediyor_mu(sahip))
  );
$$;

create or replace function public.profil_gorunur_mu(kisi uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select public.gizlilik_izin_veriyor_mu(p.id, p.profil_gizliligi) from profiles p where p.id = kisi), false);
$$;

-- Birlikte etiketli kişi bu aktivitede gösterilir mi: kendisi, aktivitenin sahibi ya da kişinin izin verdikleri
create or replace function public.katilimci_gorunur_mu(aktivite uuid, kisi uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    kisi = auth.uid()
    or exists (select 1 from activities a where a.id = aktivite and a.owner_id = auth.uid())
    or coalesce((select public.gizlilik_izin_veriyor_mu(p.id, p.grup_aktivite_gizliligi) from profiles p where p.id = kisi), false)
  );
$$;

-- Oturumdaki kişi `kisi`yi bir aktiviteye etiketleyebilir mi (tanıdık olmak ayrıca gerekir)
create or replace function public.etiketlenebilir_mi(kisi uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.bahsetme_izni <> 'kimse' and public.gizlilik_izin_veriyor_mu(p.id, p.bahsetme_izni)
    from profiles p where p.id = kisi
  ), false);
$$;

create or replace function public.gizlilik_gorunurlugu(duzey text)
returns visibility
language sql
immutable
as $$
  select case duzey when 'herkes' then 'public'::visibility when 'kimse' then 'private'::visibility else 'followers'::visibility end;
$$;

-- ---------------------------------------------------------------------------
-- Ayarı değiştir. Aktivitelerde gecmise_uygula: true ise bütün aktivitelerin görünürlüğü de değişir.
-- Dönen: değişen aktivite sayısı (diğer ayarlarda 0).
-- ---------------------------------------------------------------------------
create or replace function public.gizlilik_ayarla(alan text, deger text, gecmise_uygula boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  sayi integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if alan is null or alan not in ('profil_gizliligi', 'aktivite_gizliligi', 'grup_aktivite_gizliligi', 'bahsetme_izni') then
    raise exception 'Bilinmeyen gizlilik ayarı';
  end if;
  if deger is null or deger not in ('herkes', 'takipciler', 'kimse') then
    raise exception 'Geçersiz seçim';
  end if;

  execute format('update profiles set %I = $1 where id = $2', alan) using deger, auth.uid();

  if alan = 'aktivite_gizliligi' and coalesce(gecmise_uygula, false) then
    update activities set visibility = public.gizlilik_gorunurlugu(deger)
    where owner_id = auth.uid() and visibility is distinct from public.gizlilik_gorunurlugu(deger);
    get diagnostics sayi = row_count;
  end if;
  return sayi;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kişi sayfası: izin yoksa yalnızca ad, kullanıcı adı, fotoğraf ve takip durumu
-- (20261110000000_akis_takip.sql'deki fonksiyonun yerine geçer)
-- ---------------------------------------------------------------------------
create or replace function public.kisi_profili(kisi uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'username', p.username,
      'avatar_url', p.avatar_url,
      'bio', case when g.acik then p.bio end,
      'city', case when g.acik then p.city end,
      'created_at', p.created_at,
      'me', p.id = auth.uid(),
      'temporary', not public.kalici_hesap_mi(p.id),
      'follower_count', case when g.acik then (select count(*) from follows f where f.followee_id = p.id) else 0 end,
      'following_count', case when g.acik then (select count(*) from follows f where f.follower_id = p.id) else 0 end,
      'i_follow', exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id),
      'follows_me', exists (select 1 from follows f where f.follower_id = p.id and f.followee_id = auth.uid()),
      'common_group', public.ortak_grup_var_mi(p.id),
      'activity_count', case when g.acik then (select count(*) from activities a where a.owner_id = p.id and public.aktivite_gorunur_mu(a)) else 0 end,
      'kisitli', not g.acik
    )
    from profiles p
    cross join lateral (select public.gizlilik_izin_veriyor_mu(p.id, p.profil_gizliligi) as acik) g
    where p.id = kisi
  ) end;
$$;

-- Takip listeleri de profil ayrıntısı sayılır
create or replace function public.takip_listesi(kisi uuid, yon text default 'takipci')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null or yon not in ('takipci', 'takip') or not public.profil_gorunur_mu(kisi) then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url, 'city', p.city,
      'i_follow', exists (select 1 from follows f2 where f2.follower_id = auth.uid() and f2.followee_id = p.id),
      'follows_me', exists (select 1 from follows f3 where f3.follower_id = p.id and f3.followee_id = auth.uid()),
      'me', p.id = auth.uid()
    ) order by f.created_at desc)
    from follows f
    join profiles p on p.id = case when yon = 'takipci' then f.follower_id else f.followee_id end
    where case when yon = 'takipci' then f.followee_id else f.follower_id end = kisi
  ), '[]'::jsonb) end;
$$;

-- Web profili: oturumsuz ziyaretçi takipçi olamaz, yalnızca 'herkes' iken açılır
-- (20261110090000_profil.sql'deki fonksiyonun yerine geçer)
create or replace function public.herkese_acik_profil(kullanici text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'display_name', p.display_name,
    'username', p.username,
    'city', p.city,
    'bio', p.bio,
    'created_at', p.created_at,
    'takipci', (select count(*) from follows f where f.followee_id = p.id),
    'takip', (select count(*) from follows f where f.follower_id = p.id),
    'aktivite_sayisi', (select count(*) from activities a where a.owner_id = p.id and a.visibility = 'public'),
    'toplam_km', (select round(coalesce(sum(a.distance_m), 0)::numeric / 1000, 1) from activities a where a.owner_id = p.id and a.visibility = 'public'),
    'aktiviteler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', a.title, 'activity', a.activity, 'started_at', a.started_at, 'distance_m', a.distance_m,
        'moving_time_s', a.moving_time_s, 'elevation_gain_m', a.elevation_gain_m
      ) order by a.started_at desc)
      from (select * from activities where owner_id = p.id and visibility = 'public' order by started_at desc limit 10) a
    ), '[]'::jsonb)
  )
  from profiles p
  where p.username = lower(btrim(kullanici)) and public.kalici_hesap_mi(p.id) and p.profil_gizliligi = 'herkes';
$$;

-- ---------------------------------------------------------------------------
-- Yeni kayıt: görünürlük verilmezse kişinin varsayılanı
-- (20261109010000_rotalar.sql'deki fonksiyonun yerine geçer; yalnızca visibility satırı değişti)
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
    coalesce(
      (p ->> 'visibility')::visibility,
      (select public.gizlilik_gorunurlugu(pr.aktivite_gizliligi) from profiles pr where pr.id = auth.uid()),
      'followers'
    ),
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

-- ---------------------------------------------------------------------------
-- Grup aktiviteleri: etiketli kişiler yalnızca izin verdikleri kişilere görünür
-- ---------------------------------------------------------------------------
drop policy if exists "katilimci_okuma" on public.activity_participants;
create policy "katilimci_okuma" on public.activity_participants for select to authenticated
  using (public.aktiviteyi_gorebilir_mi(activity_id) and public.katilimci_gorunur_mu(activity_id, user_id));

create or replace function public.birlikte_kisiler(aktivite uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.aktiviteyi_gorebilir_mi(aktivite) then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('user_id', p.id, 'display_name', p.display_name, 'username', p.username, 'me', p.id = auth.uid()) order by p.display_name)
    from activity_participants ap join profiles p on p.id = ap.user_id
    where ap.activity_id = aktivite and public.katilimci_gorunur_mu(ap.activity_id, ap.user_id)
  ), '[]'::jsonb) end;
$$;

-- Bahsetmeler: etiketlenmeye izin vermeyen eklenemez
-- (20261110040000_birlikte.sql'deki fonksiyonun yerine geçer)
create or replace function public.birlikte_ekle(aktivite uuid, kisiler uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  k uuid;
  eklenen integer := 0;
  satir integer;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if not exists (select 1 from activities where id = aktivite and owner_id = auth.uid()) then
    raise exception 'Yalnızca kendi aktivitene kişi ekleyebilirsin';
  end if;
  if (select count(*) from activity_participants where activity_id = aktivite) + coalesce(array_length(kisiler, 1), 0) > 30 then
    raise exception 'Bir aktiviteye en fazla 30 kişi eklenebilir';
  end if;
  foreach k in array coalesce(kisiler, '{}') loop
    if k = auth.uid() then
      continue;
    end if;
    if not public.tanidik_mi(k) then
      raise exception 'Yalnızca takipleştiğin ya da ortak grubun olan kişileri ekleyebilirsin';
    end if;
    if not public.etiketlenebilir_mi(k) then
      raise exception 'Bu kişi aktivitelere etiketlenmeye izin vermiyor';
    end if;
    insert into activity_participants (activity_id, user_id) values (aktivite, k) on conflict do nothing;
    get diagnostics satir = row_count;
    eklenen := eklenen + satir;
  end loop;
  return eklenen;
end;
$$;

-- Öneriler de yalnızca etiketlenebilecek kişiler
create or replace function public.birlikte_onerileri(aktivite uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with a as (select * from activities where id = aktivite and owner_id = auth.uid())
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', x.owner_id, 'display_name', x.display_name, 'username', x.username,
    'activity_id', x.id, 'title', x.title, 'started_at', x.started_at
  ) order by x.fark), '[]'::jsonb)
  from (
    select distinct on (o.owner_id) o.owner_id, p.display_name, p.username, o.id, o.title, o.started_at,
      abs(extract(epoch from o.started_at - a.started_at)) as fark
    from a
    join activities o on o.owner_id <> a.owner_id
      and o.started_at < a.ended_at + interval '15 minutes'
      and o.ended_at > a.started_at - interval '15 minutes'
    join profiles p on p.id = o.owner_id
    where a.track is not null and o.track is not null
      and st_dwithin(o.track, a.track, 300)
      and public.aktivite_gorunur_mu(o)
      and public.tanidik_mi(o.owner_id)
      and public.etiketlenebilir_mi(o.owner_id)
      and not exists (select 1 from activity_participants ap where ap.activity_id = a.id and ap.user_id = o.owner_id)
    order by o.owner_id, fark
  ) x;
$$;

-- Akış kartındaki "X ve N kişiyle" de aynı kurala uyar
-- (20261110070000_hava.sql'deki fonksiyonun yerine geçer; yalnızca 'with' ve 'with_count' değişti)
create or replace function public.akis(
  filtre text default 'takip',
  once_zaman timestamptz default null,
  once_id uuid default null,
  lng float8 default null,
  lat float8 default null,
  adet integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  ben uuid := auth.uid();
  nokta geography;
  sonuc jsonb;
begin
  if ben is null then
    raise exception 'Giriş gerekli';
  end if;
  if filtre not in ('takip', 'gruplar', 'yakin') then
    raise exception 'Bilinmeyen süzgeç: %', filtre;
  end if;
  if filtre = 'yakin' then
    if lng is null or lat is null or lng not between -180 and 180 or lat not between -90 and 90 then
      raise exception 'Yakınımdakiler için konum gerekli';
    end if;
    nokta := st_setsrid(st_makepoint(lng, lat), 4326)::geography;
  end if;
  adet := least(greatest(coalesce(adet, 20), 1), 50);

  select coalesce(jsonb_agg(satir order by (satir ->> 'started_at')::timestamptz desc, (satir ->> 'id')::uuid desc), '[]'::jsonb)
  into sonuc
  from (
    select jsonb_build_object(
      'id', a.id,
      'owner_id', a.owner_id,
      'owner_name', pr.display_name,
      'owner_username', pr.username,
      'owner_avatar', pr.avatar_url,
      'title', a.title,
      'activity', a.activity,
      'started_at', a.started_at,
      'moving_time_s', a.moving_time_s,
      'distance_m', a.distance_m,
      'elevation_gain_m', a.elevation_gain_m,
      'avg_speed_mps', a.avg_speed_mps,
      'visibility', a.visibility,
      -- Akış kartı küçük bir harita: iz sadeleştirilir (~10 m), yükseklik atılır
      'track', (
        select st_asgeojson(st_simplify(st_force2d(st_geomfromgeojson(iz::text)), 0.0001), 5)::jsonb -> 'coordinates'
        from (select public.gosterilecek_iz(a) as iz) g
        where g.iz is not null
      ),
      'like_count', (select count(*) from activity_likes l where l.activity_id = a.id),
      'comment_count', (select count(*) from activity_comments c where c.activity_id = a.id),
      'liked', exists (select 1 from activity_likes l where l.activity_id = a.id and l.user_id = ben),
      'stop_count', (select count(*) from activity_stops s where s.activity_id = a.id),
      'mine', a.owner_id = ben,
      -- Birlikte yapılanlar: ilk 3 kişi ve toplam sayı (yalnızca görünmeye izin verenler)
      'with', coalesce((
        select jsonb_agg(jsonb_build_object('id', w.user_id, 'ad', w.display_name) order by w.display_name)
        from (
          select ap.user_id, pp.display_name from activity_participants ap join profiles pp on pp.id = ap.user_id
          where ap.activity_id = a.id and public.katilimci_gorunur_mu(ap.activity_id, ap.user_id)
          order by pp.display_name limit 3
        ) w
      ), '[]'::jsonb),
      'with_count', (
        select count(*) from activity_participants ap
        where ap.activity_id = a.id and public.katilimci_gorunur_mu(ap.activity_id, ap.user_id)
      ),
      'tagged_me', exists (select 1 from activity_participants ap where ap.activity_id = a.id and ap.user_id = ben),
      'weather', a.weather
    ) as satir
    from activities a
    join profiles pr on pr.id = a.owner_id
    where public.aktivite_gorunur_mu(a)
      and (once_zaman is null or (a.started_at, a.id) < (once_zaman, coalesce(once_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
      and case filtre
        when 'takip' then a.owner_id = ben
          or exists (select 1 from follows f where f.follower_id = ben and f.followee_id = a.owner_id)
          -- Birlikte etiketlendiğim aktiviteler de akışımda
          or exists (select 1 from activity_participants ap where ap.activity_id = a.id and ap.user_id = ben)
        when 'gruplar' then a.owner_id <> ben and public.ortak_grup_var_mi(a.owner_id)
        else a.track is not null and st_dwithin(a.track, nokta, 25000)
      end
    order by a.started_at desc, a.id desc
    limit adet
  ) x;
  return sonuc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function public.gizlilik_ayarla(text, text, boolean) from public, anon;
grant execute on function public.gizlilik_ayarla(text, text, boolean) to authenticated;
revoke execute on function public.gizlilik_izin_veriyor_mu(uuid, text) from public, anon;
revoke execute on function public.profil_gorunur_mu(uuid) from public, anon;
revoke execute on function public.katilimci_gorunur_mu(uuid, uuid) from public, anon;
revoke execute on function public.etiketlenebilir_mi(uuid) from public, anon;
grant execute on function public.gizlilik_izin_veriyor_mu(uuid, text) to authenticated;
grant execute on function public.profil_gorunur_mu(uuid) to authenticated;
grant execute on function public.katilimci_gorunur_mu(uuid, uuid) to authenticated;
grant execute on function public.etiketlenebilir_mi(uuid) to authenticated;
