-- Lykiva — 23. aşama: profil düzenleme, herkese açık web profili, aktivite / rota düzenleme
--
-- GÜVENLİK DÜZELTMESİ: "profil_duzenleme" kuralı kullanıcının kendi profil satırındaki HER sütunu güncellemesine
-- izin veriyordu; buna is_admin de dahildi (kendini yönetici yapabiliyordu). Artık istemci yalnızca display_name ve
-- avatar_url sütunlarını doğrudan güncelleyebilir; ad, kullanıcı adı, şehir ve biyografi profil_guncelle() ile
-- (denetimli) değişir. is_admin yalnızca yonetim_yetki() ve yonetici.sh ile değişir.
--
-- - kullanici_adi_musait(ad): kullanıcı adı boş mu
-- - herkese_acik_profil(kullanici): web /u/<kullanıcı> sayfası (anon okur): ad, şehir, biyografi, sayılar ve
--   yalnızca "herkese açık" aktivitelerin özeti (iz yok); geçici hesaplar gösterilmez
-- - Aktivite başlığı ve rota adı en fazla 80 karakter (sahibi yeniden adlandırabilir; silme kuralları zaten var)

revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

alter table public.profiles drop constraint if exists profil_ad_uzunlugu;
alter table public.profiles add constraint profil_ad_uzunlugu check (char_length(btrim(display_name)) between 1 and 60) not valid;
alter table public.profiles drop constraint if exists profil_bio_uzunlugu;
alter table public.profiles add constraint profil_bio_uzunlugu check (bio is null or char_length(bio) <= 160) not valid;
alter table public.profiles drop constraint if exists profil_sehir_uzunlugu;
alter table public.profiles add constraint profil_sehir_uzunlugu check (city is null or char_length(city) <= 40) not valid;
alter table public.activities drop constraint if exists aktivite_baslik_uzunlugu;
alter table public.activities add constraint aktivite_baslik_uzunlugu check (title is null or char_length(title) <= 80) not valid;
alter table public.routes drop constraint if exists rota_ad_uzunlugu;
alter table public.routes add constraint rota_ad_uzunlugu check (char_length(btrim(name)) between 1 and 80) not valid;

-- Kullanılamayacak kullanıcı adları
create or replace function public.kullanici_adi_ayrilmis(ad text)
returns boolean
language sql
immutable
as $$
  select ad = any (array['admin', 'yonetim', 'yonetici', 'lykiva', 'destek', 'yardim', 'api', 'www', 'root', 'sistem', 'moderator'])
    or ad like 'k\_%';
$$;

create or replace function public.kullanici_adi_musait(ad text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(btrim(coalesce(ad, ''))) ~ '^[a-z0-9_.]{3,30}$'
    and not public.kullanici_adi_ayrilmis(lower(btrim(ad)))
    and not exists (select 1 from profiles p where p.username = lower(btrim(ad)) and p.id <> auth.uid());
$$;

create or replace function public.profil_guncelle(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad text := btrim(coalesce(p ->> 'display_name', ''));
  v_kadi text := lower(btrim(coalesce(p ->> 'username', '')));
  v_sehir text := nullif(btrim(coalesce(p ->> 'city', '')), '');
  v_bio text := nullif(btrim(coalesce(p ->> 'bio', '')), '');
  mevcut profiles;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  select * into mevcut from profiles where id = auth.uid();
  if mevcut.id is null then
    raise exception 'Profil bulunamadı';
  end if;
  if char_length(v_ad) < 2 or char_length(v_ad) > 40 then
    raise exception 'Ad 2–40 karakter olmalı';
  end if;
  if v_kadi !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'Kullanıcı adı 3–30 karakter olmalı; yalnızca küçük harf, rakam, nokta ve alt çizgi';
  end if;
  if v_kadi <> mevcut.username and public.kullanici_adi_ayrilmis(v_kadi) then
    raise exception 'Bu kullanıcı adı kullanılamaz';
  end if;
  if v_sehir is not null and char_length(v_sehir) > 40 then
    raise exception 'Şehir en fazla 40 karakter olabilir';
  end if;
  if v_bio is not null and char_length(v_bio) > 160 then
    raise exception 'Hakkında en fazla 160 karakter olabilir';
  end if;
  begin
    update profiles set display_name = v_ad, username = v_kadi, city = v_sehir, bio = v_bio where id = auth.uid();
  exception when unique_violation then
    raise exception 'Bu kullanıcı adı alınmış';
  end;
  return jsonb_build_object('display_name', v_ad, 'username', v_kadi, 'city', v_sehir, 'bio', v_bio);
end;
$$;

-- ---------------------------------------------------------------------------
-- Herkese açık web profili (anon okur)
-- ---------------------------------------------------------------------------
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
  where p.username = lower(btrim(kullanici)) and public.kalici_hesap_mi(p.id);
$$;

revoke execute on function public.kullanici_adi_musait(text) from public, anon;
revoke execute on function public.profil_guncelle(jsonb) from public, anon;
grant execute on function public.kullanici_adi_musait(text) to authenticated;
grant execute on function public.profil_guncelle(jsonb) to authenticated;
revoke execute on function public.herkese_acik_profil(text) from public;
grant execute on function public.herkese_acik_profil(text) to anon, authenticated;
