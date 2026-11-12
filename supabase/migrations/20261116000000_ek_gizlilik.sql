-- Lykiva — ek gizlilik kontrolleri ve kullanıcı engelleme (mobil: Gizlilik kontrolleri > Ek kontroller)
--
-- - Harita görünürlüğü: profiles.uclari_gizle — yeni kayıtlarda başlangıç / bitiş gizleme varsayılanı
--   (kaydet_aktivite, hide_endpoints verilmezse bunu kullanır). Geçmişe gecmis_aktiviteleri_duzenle ile uygulanır.
-- - Gizli ayrıntılar: profiles.gizli_hiz (ortalama / en yüksek / en düşük hız ve hız grafiği), profiles.gizli_molalar
--   (mola noktaları ve fotoğrafları). Sahibi hep görür. aktivite_ozetleri, akis, aktivite_detay, activity_stops ve
--   mola fotoğrafı okuma kuralı bunlara uyar. Paylaşım bağlantısı (paylasilan_aktivite) sahibinin açık isteği olduğu
--   için hepsini göstermeye devam eder.
-- - Geçmiş aktiviteleri düzenle: gecmis_aktiviteleri_duzenle(gorunurluk, uclari_gizle) bütün aktivitelere uygular.
-- - Kişisel bilgilerimi paylaşmayın: profiles.kisisel_veri_paylasimi_kapali — tercih kaydı. Lykiva bugün kişisel bilgi
--   satmıyor ve reklam / pazarlama için paylaşmıyor; ileride böyle bir paylaşım eklenirse bu hesaplarda kapalı kalmalı.
-- - Meydan okuma katılımı: profiles.meydan_okuma_gizliligi (herkes / takipciler / kimse) — sıralamada adını kim görür;
--   izin yoksa satır "gizli katılımcı" olarak döner (yer ve değer görünür, kim olduğu görünmez).
-- - Engelleme: engellemeler tablosu, kisi_engelle / engellenenler. Engel iki yönlü çalışır: birbirinizin aktivitelerini
--   (akış, kişi sayfası, aktivite, yorum, beğeni) göremezsiniz, aramada çıkmazsınız, takip edemez ve etiketleyemezsiniz.
--   Engellenince aradaki takipler ve birbirinizin aktivitelerindeki etiketler kalkar. Engellenen kişi engelleyenin
--   profilini "bulunamadı" görür; engelleyen engellediği kişinin adını görür (engeli kaldırabilsin diye).
--   Ortak gruplardaki sohbet ve üye listeleri etkilenmez.

alter table public.profiles add column if not exists uclari_gizle boolean not null default true;
alter table public.profiles add column if not exists gizli_hiz boolean not null default false;
alter table public.profiles add column if not exists gizli_molalar boolean not null default false;
alter table public.profiles add column if not exists kisisel_veri_paylasimi_kapali boolean not null default false;
alter table public.profiles add column if not exists meydan_okuma_gizliligi text not null default 'herkes';

alter table public.profiles drop constraint if exists profil_meydan_okuma_gizlilik_gecerli;
alter table public.profiles add constraint profil_meydan_okuma_gizlilik_gecerli
  check (meydan_okuma_gizliligi in ('herkes', 'takipciler', 'kimse'));

-- ---------------------------------------------------------------------------
-- Engelleme
-- ---------------------------------------------------------------------------
create table if not exists public.engellemeler (
  engelleyen uuid not null references public.profiles (id) on delete cascade,
  engellenen uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (engelleyen, engellenen),
  constraint engel_kendine_degil check (engelleyen <> engellenen)
);
create index if not exists engellemeler_engellenen_idx on public.engellemeler (engellenen);

alter table public.engellemeler enable row level security;
drop policy if exists "engel_okuma" on public.engellemeler;
create policy "engel_okuma" on public.engellemeler for select to authenticated using (engelleyen = auth.uid());
revoke insert, update, delete on public.engellemeler from anon, authenticated;
revoke select on public.engellemeler from anon;
grant select on public.engellemeler to authenticated;

-- Oturumdaki kişiyle `kisi` arasında (hangi yönde olursa olsun) engel var mı
create or replace function public.engel_var_mi(kisi uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and kisi is not null and kisi <> auth.uid() and exists (
    select 1 from engellemeler e
    where (e.engelleyen = auth.uid() and e.engellenen = kisi) or (e.engelleyen = kisi and e.engellenen = auth.uid())
  );
$$;

create or replace function public.kisi_engelle(kisi uuid, engelle boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ben uuid := auth.uid();
begin
  if ben is null then
    raise exception 'Giriş gerekli';
  end if;
  if kisi is null or kisi = ben then
    raise exception 'Kendini engelleyemezsin';
  end if;
  if not exists (select 1 from profiles where id = kisi) then
    raise exception 'Kişi bulunamadı';
  end if;

  if coalesce(engelle, true) then
    insert into engellemeler (engelleyen, engellenen) values (ben, kisi) on conflict do nothing;
    delete from follows where (follower_id = ben and followee_id = kisi) or (follower_id = kisi and followee_id = ben);
    delete from activity_participants ap using activities a
    where a.id = ap.activity_id
      and ((ap.user_id = kisi and a.owner_id = ben) or (ap.user_id = ben and a.owner_id = kisi));
  else
    delete from engellemeler where engelleyen = ben and engellenen = kisi;
  end if;
end;
$$;

create or replace function public.engellenenler()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url, 'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb)
  from engellemeler e join profiles p on p.id = e.engellenen
  where e.engelleyen = auth.uid();
$$;

-- Aktivite görünürlüğü: engel varsa sahibi dışında kimse görmez
-- (20261109030000_gruplar.sql'deki fonksiyonun yerine geçer)
create or replace function public.aktivite_gorunur_mu(a public.activities)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    a.owner_id = auth.uid()
    or (
      not public.engel_var_mi(a.owner_id)
      and (
        a.visibility = 'public'
        or (a.visibility = 'followers' and public.takip_ediyor_mu(a.owner_id))
        or (a.visibility = 'groups' and public.ortak_grup_var_mi(a.owner_id))
        or exists (select 1 from activity_participants ap where ap.activity_id = a.id and ap.user_id = auth.uid())
      )
    );
$$;

-- Engelli kişi takip edilemez
drop policy if exists "takip_ekleme" on public.follows;
create policy "takip_ekleme" on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.engel_var_mi(followee_id));

-- 20261115000000_gizlilik.sql'deki yardımcılar: engel de sayılır
create or replace function public.profil_gorunur_mu(kisi uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.engel_var_mi(kisi)
    and coalesce((select public.gizlilik_izin_veriyor_mu(p.id, p.profil_gizliligi) from profiles p where p.id = kisi), false);
$$;

create or replace function public.katilimci_gorunur_mu(aktivite uuid, kisi uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    kisi = auth.uid()
    or (
      not public.engel_var_mi(kisi)
      and (
        exists (select 1 from activities a where a.id = aktivite and a.owner_id = auth.uid())
        or coalesce((select public.gizlilik_izin_veriyor_mu(p.id, p.grup_aktivite_gizliligi) from profiles p where p.id = kisi), false)
      )
    )
  );
$$;

create or replace function public.etiketlenebilir_mi(kisi uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.engel_var_mi(kisi) and coalesce((
    select p.bahsetme_izni <> 'kimse' and public.gizlilik_izin_veriyor_mu(p.id, p.bahsetme_izni)
    from profiles p where p.id = kisi
  ), false);
$$;

-- Kişi sayfası: beni engelleyenin sayfası yok; engellediğim kişinin yalnızca adı ('engelledim')
-- (20261115000000_gizlilik.sql'deki fonksiyonun yerine geçer)
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
      'kisitli', not g.acik,
      'engelledim', exists (select 1 from engellemeler e where e.engelleyen = auth.uid() and e.engellenen = p.id)
    )
    from profiles p
    cross join lateral (select public.profil_gorunur_mu(p.id) as acik) g
    where p.id = kisi
      and not exists (select 1 from engellemeler e where e.engelleyen = p.id and e.engellenen = auth.uid())
  ) end;
$$;

-- Kişi arama: engel varsa çıkmaz (20261110000000_akis_takip.sql'deki fonksiyonun yerine geçer)
create or replace function public.kisi_ara(arama text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with q as (select nullif(lower(trim(coalesce(arama, ''))), '') as metin),
  aday as (
    select
      p.id, p.display_name, p.username, p.avatar_url, p.city,
      exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id) as i_follow,
      exists (select 1 from follows f where f.follower_id = p.id and f.followee_id = auth.uid()) as follows_me,
      (
        select count(*) from group_members a join group_members b on a.group_id = b.group_id
        where a.user_id = auth.uid() and b.user_id = p.id
      ) as common_groups
    from profiles p, q
    where auth.uid() is not null
      and p.id <> auth.uid()
      and public.kalici_hesap_mi(p.id)
      and not public.engel_var_mi(p.id)
      and (
        (q.metin is not null and char_length(q.metin) >= 2
          and (strpos(lower(p.display_name), q.metin) > 0 or strpos(p.username, q.metin) > 0))
        or (q.metin is null and not exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
          and (
            exists (select 1 from follows f where f.follower_id = p.id and f.followee_id = auth.uid())
            or public.ortak_grup_var_mi(p.id)
          ))
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'display_name', display_name, 'username', username, 'avatar_url', avatar_url, 'city', city,
    'i_follow', i_follow, 'follows_me', follows_me, 'common_groups', common_groups
  ) order by follows_me desc, common_groups desc, display_name), '[]'::jsonb)
  from (select * from aday order by follows_me desc, common_groups desc, display_name limit 30) s;
$$;

-- Takip listeleri: engelli kişiler listede görünmez (20261115000000_gizlilik.sql'deki fonksiyonun yerine geçer)
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
      and not public.engel_var_mi(p.id)
  ), '[]'::jsonb) end;
$$;

-- ---------------------------------------------------------------------------
-- Ayarlar
-- ---------------------------------------------------------------------------

-- 20261115000000_gizlilik.sql'deki fonksiyonun yerine geçer: meydan okuma katılımı da eklendi
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
  if alan is null or alan not in ('profil_gizliligi', 'aktivite_gizliligi', 'grup_aktivite_gizliligi', 'bahsetme_izni', 'meydan_okuma_gizliligi') then
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

-- Açık / kapalı ayarlar
create or replace function public.gizlilik_bayragi_ayarla(alan text, deger boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if alan is null or alan not in ('uclari_gizle', 'gizli_hiz', 'gizli_molalar', 'kisisel_veri_paylasimi_kapali') then
    raise exception 'Bilinmeyen gizlilik ayarı';
  end if;
  if deger is null then
    raise exception 'Geçersiz seçim';
  end if;
  execute format('update profiles set %I = $1 where id = $2', alan) using deger, auth.uid();
end;
$$;

-- Bütün aktivitelere uygula; null verilen değişmez. Dönen: değişen aktivite sayısı.
create or replace function public.gecmis_aktiviteleri_duzenle(gorunurluk visibility default null, uclari_gizle boolean default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  sayi integer;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if gorunurluk is null and uclari_gizle is null then
    raise exception 'Değiştirilecek bir şey seçilmedi';
  end if;
  update activities a
  set visibility = coalesce(gorunurluk, a.visibility),
      hide_endpoints = coalesce(uclari_gizle, a.hide_endpoints)
  where a.owner_id = auth.uid()
    and (a.visibility is distinct from coalesce(gorunurluk, a.visibility)
      or a.hide_endpoints is distinct from coalesce(uclari_gizle, a.hide_endpoints));
  get diagnostics sayi = row_count;
  return sayi;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gizli ayrıntılar
-- ---------------------------------------------------------------------------
create or replace function public.hiz_gizli_mi(sahip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select sahip is distinct from auth.uid() and coalesce((select p.gizli_hiz from profiles p where p.id = sahip), false);
$$;

create or replace function public.molalar_gizli_mi(aktivite uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from activities a join profiles p on p.id = a.owner_id
    where a.id = aktivite and a.owner_id is distinct from auth.uid() and p.gizli_molalar
  );
$$;

-- Aynı sütunlar; hız gizliyse başkasına boş (20261110070000_hava.sql'deki görünümün yerine geçer)
create or replace view public.aktivite_ozetleri
with (security_invoker = true)
as
select
  a.id, a.owner_id, a.title, a.activity, a.started_at, a.ended_at, a.moving_time_s, a.elapsed_time_s,
  a.distance_m, a.elevation_gain_m, a.elevation_loss_m, a.max_elevation_m,
  case when a.owner_id = auth.uid() or not pr.gizli_hiz then a.avg_speed_mps end as avg_speed_mps,
  case when a.owner_id = auth.uid() or not pr.gizli_hiz then a.max_speed_mps end as max_speed_mps,
  case when a.owner_id = auth.uid() or not pr.gizli_hiz then a.min_moving_speed_mps end as min_moving_speed_mps,
  a.visibility, a.hide_endpoints, a.created_at,
  public.gosterilecek_iz(a) as track_geojson,
  pr.display_name as owner_name,
  pr.username as owner_username,
  a.weather
from public.activities a
join public.profiles pr on pr.id = a.owner_id;

grant select on public.aktivite_ozetleri to authenticated;

drop policy if exists "mola_okuma" on public.activity_stops;
create policy "mola_okuma" on public.activity_stops for select to authenticated
  using (public.aktiviteyi_gorebilir_mi(activity_id) and not public.molalar_gizli_mi(activity_id));

drop policy if exists "mola_foto_okuma" on storage.objects;
create policy "mola_foto_okuma" on storage.objects for select to authenticated
  using (bucket_id = 'mola' and public.aktiviteyi_gorebilir_mi(public.yol_kimligi(name)) and not public.molalar_gizli_mi(public.yol_kimligi(name)));

-- (20261110100000_fotograflar.sql'deki fonksiyonun yerine geçer)
create or replace function public.aktivite_detay(aktivite uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case when not public.aktiviteyi_gorebilir_mi(aktivite) then null else jsonb_build_object(
    'stops', case when public.molalar_gizli_mi(aktivite) then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'started_at', s.started_at, 'ended_at', s.ended_at, 'distance_at_m', s.distance_at_m,
        'lng', st_x(s.location::geometry), 'lat', st_y(s.location::geometry), 'note', s.note, 'photos', to_jsonb(s.photo_urls)
      ) order by s.started_at)
      from activity_stops s where s.activity_id = aktivite
    ), '[]'::jsonb) end,
    'profile', coalesce((
      select jsonb_agg(jsonb_build_object('t', q.t, 'd', round(q.d::numeric, 1), 'alt', q.alt, 'speed', q.speed) order by q.seq)
      from (
        select
          p.seq,
          extract(epoch from p.recorded_at) * 1000 as t,
          coalesce(sum(st_distance(p.location, p.onceki)) over (order by p.seq), 0) as d,
          p.elevation_m as alt,
          case when h.gizli then null else p.speed_mps end as speed
        from (
          select *, lag(location) over (order by seq) as onceki
          from activity_points where activity_id = aktivite
        ) p
        cross join (select public.hiz_gizli_mi((select owner_id from activities where id = aktivite)) as gizli) h
      ) q
    ), '[]'::jsonb)
  ) end;
$$;

-- Akış kartı: hız ve mola sayısı da gizlenir (20261115000000_gizlilik.sql'deki fonksiyonun yerine geçer)
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
      'avg_speed_mps', case when a.owner_id = ben or not pr.gizli_hiz then a.avg_speed_mps end,
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
      'stop_count', case when a.owner_id = ben or not pr.gizli_molalar then (select count(*) from activity_stops s where s.activity_id = a.id) else 0 end,
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
-- Yeni kayıt: başlangıç / bitiş gizleme verilmezse kişinin varsayılanı
-- (20261115000000_gizlilik.sql'deki fonksiyonun yerine geçer; yalnızca hide_endpoints satırı değişti)
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
    coalesce(
      (p ->> 'hide_endpoints')::boolean,
      (select pr.uclari_gizle from profiles pr where pr.id = auth.uid()),
      true
    ),
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
-- Meydan okuma katılımı: izin yoksa sıralamada "gizli katılımcı"
-- (20261113000000_hedefler_meydan_okumalar.sql'deki fonksiyonun yerine geçer)
-- ---------------------------------------------------------------------------
create or replace function public.meydan_okuma_detay(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m meydan_okumalar;
  liste jsonb;
  benim jsonb;
begin
  select * into m from meydan_okumalar where id = p_id;
  if m.id is null or not public.meydan_okumayi_gorebilir_mi(m) then
    return null;
  end if;

  with d as (
    select k.user_id, k.katildi, public.meydan_okuma_degeri(m, k.user_id) as deger
    from meydan_okuma_katilimcilari k where k.meydan_okuma_id = m.id
  ),
  s as (
    select d.*, rank() over (order by d.deger desc) as sira, row_number() over (order by d.deger desc, d.katildi, d.user_id) as satir
    from d
  ),
  j as (
    select s.satir, s.user_id,
      case when s.user_id = auth.uid() or (not public.engel_var_mi(s.user_id) and public.gizlilik_izin_veriyor_mu(s.user_id, p.meydan_okuma_gizliligi))
        then jsonb_build_object(
          'user_id', s.user_id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url,
          'deger', s.deger, 'sira', s.sira, 'ben', s.user_id = auth.uid(), 'gizli', false
        )
        else jsonb_build_object(
          'user_id', null, 'display_name', null, 'username', null, 'avatar_url', null,
          'deger', s.deger, 'sira', s.sira, 'ben', false, 'gizli', true
        )
      end as o
    from s join profiles p on p.id = s.user_id
  )
  select coalesce((select jsonb_agg(o order by satir) from j where satir <= 50), '[]'::jsonb),
         (select o from j where user_id = auth.uid())
  into liste, benim;

  return public.meydan_okuma_ozeti(m) || jsonb_build_object('siralama', liste, 'benim', benim);
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function public.engel_var_mi(uuid) from public, anon;
revoke execute on function public.kisi_engelle(uuid, boolean) from public, anon;
revoke execute on function public.engellenenler() from public, anon;
revoke execute on function public.gizlilik_bayragi_ayarla(text, boolean) from public, anon;
revoke execute on function public.gecmis_aktiviteleri_duzenle(visibility, boolean) from public, anon;
revoke execute on function public.hiz_gizli_mi(uuid) from public, anon;
revoke execute on function public.molalar_gizli_mi(uuid) from public, anon;
grant execute on function public.engel_var_mi(uuid) to authenticated;
grant execute on function public.kisi_engelle(uuid, boolean) to authenticated;
grant execute on function public.engellenenler() to authenticated;
grant execute on function public.gizlilik_bayragi_ayarla(text, boolean) to authenticated;
grant execute on function public.gecmis_aktiviteleri_duzenle(visibility, boolean) to authenticated;
grant execute on function public.hiz_gizli_mi(uuid) to authenticated;
grant execute on function public.molalar_gizli_mi(uuid) to authenticated;
