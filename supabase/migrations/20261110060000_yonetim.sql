-- Lykiva — 17. aşama: yönetim paneli (web /admin)
--
-- - Yönetici: profiles.is_admin = true olan ve geçici olmayan hesap (supabase/yonetici.sh ile atanır)
-- - Panel verisi yalnızca aşağıdaki fonksiyonlarla gelir; her biri önce yöneticiliği kontrol eder
--   (web sunucusu kullanıcının kendi oturumuyla çağırır; tam yetkili anahtar web'e konmaz)
-- - Moderasyon: şikayet durumu ve notu, aktivite silme, rotayı herkese kapatma, grup / etkinlik silme,
--   yönetici yetkisi verme / alma (kendi yetkini alamazsın)
-- - sikayet_et(): uygulamadan şikayet bırakmak için (saatte en fazla 10; aynı hedefe açık şikayet tek)

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('user', 'activity', 'route', 'message', 'group', 'event', 'comment'));
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
create index if not exists reports_status_created_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists profiles_created_idx on public.profiles (created_at desc);

-- ---------------------------------------------------------------------------
-- Yönetici kontrolü
-- ---------------------------------------------------------------------------
create or replace function public.yonetici_mi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false)
    and public.kalici_hesap_mi(auth.uid());
$$;

create or replace function public.yonetici_sart()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.yonetici_mi() then
    raise exception 'Yönetim yetkisi yok' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Genel bakış
-- ---------------------------------------------------------------------------
create or replace function public.yonetim_ozet()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  perform public.yonetici_sart();
  return jsonb_build_object(
    'kullanici', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false)),
    'gecici', (select count(*) from auth.users u where coalesce(u.is_anonymous, false)),
    'yeni_kullanici_7g', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false) and u.created_at > now() - interval '7 days'),
    'aktif_7g', (select count(distinct owner_id) from activities where started_at > now() - interval '7 days'),
    'aktivite', (select count(*) from activities),
    'aktivite_7g', (select count(*) from activities where started_at > now() - interval '7 days'),
    'rota_acik', (select count(*) from routes where visibility = 'public'),
    'grup', (select count(*) from groups where not is_community),
    'topluluk', (select count(*) from groups where is_community),
    'etkinlik_yaklasan', (select count(*) from events where starts_at > now()),
    'sikayet_acik', (select count(*) from reports where status in ('open', 'reviewing')),
    'canli', (select count(*) from live_locations where updated_at > now() - interval '15 minutes'),
    'gunluk', (
      select coalesce(jsonb_agg(jsonb_build_object('gun', g.gun, 'aktivite', g.aktivite, 'kayit', g.kayit) order by g.gun), '[]'::jsonb)
      from (
        select d::date as gun,
          (select count(*) from activities a where a.started_at >= d and a.started_at < d + interval '1 day') as aktivite,
          (select count(*) from auth.users u where not coalesce(u.is_anonymous, false) and u.created_at >= d and u.created_at < d + interval '1 day') as kayit
        from generate_series(date_trunc('day', now() at time zone 'Europe/Istanbul') - interval '13 days',
                             date_trunc('day', now() at time zone 'Europe/Istanbul'), interval '1 day') d
      ) g
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Listeler (sayfa başına 50; { toplam, satirlar })
-- ---------------------------------------------------------------------------
create or replace function public.yonetim_kullanicilar(arama text default null, sayfa integer default 0, gecici_dahil boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  q text := nullif(lower(trim(coalesce(arama, ''))), '');
begin
  perform public.yonetici_sart();
  return (
    with liste as (
      select p.*, u.email, u.last_sign_in_at, coalesce(u.is_anonymous, false) as gecici
      from profiles p join auth.users u on u.id = p.id
      where (gecici_dahil or not coalesce(u.is_anonymous, false))
        and (q is null or strpos(lower(p.display_name), q) > 0 or strpos(p.username, q) > 0 or strpos(lower(coalesce(u.email, '')), q) > 0)
    )
    select jsonb_build_object(
      'toplam', (select count(*) from liste),
      'satirlar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'display_name', l.display_name, 'username', l.username, 'email', l.email, 'city', l.city,
          'created_at', l.created_at, 'last_sign_in_at', l.last_sign_in_at, 'is_admin', l.is_admin, 'gecici', l.gecici,
          'aktivite', (select count(*) from activities a where a.owner_id = l.id),
          'takipci', (select count(*) from follows f where f.followee_id = l.id),
          'sikayet', (select count(*) from reports r where r.target_type = 'user' and r.target_id = l.id)
        ) order by l.created_at desc)
        from (select * from liste order by created_at desc offset greatest(sayfa, 0) * 50 limit 50) l
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.yonetim_aktiviteler(arama text default null, sayfa integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := nullif(lower(trim(coalesce(arama, ''))), '');
begin
  perform public.yonetici_sart();
  return (
    with liste as (
      select a.id, a.title, a.activity, a.started_at, a.distance_m, a.moving_time_s, a.visibility, a.owner_id, p.display_name, p.username
      from activities a join profiles p on p.id = a.owner_id
      where q is null or strpos(lower(coalesce(a.title, '')), q) > 0 or strpos(lower(p.display_name), q) > 0 or strpos(p.username, q) > 0
    )
    select jsonb_build_object(
      'toplam', (select count(*) from liste),
      'satirlar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'title', l.title, 'activity', l.activity, 'started_at', l.started_at, 'distance_m', l.distance_m,
          'moving_time_s', l.moving_time_s, 'visibility', l.visibility, 'owner_id', l.owner_id, 'owner_name', l.display_name, 'owner_username', l.username,
          'begeni', (select count(*) from activity_likes x where x.activity_id = l.id),
          'yorum', (select count(*) from activity_comments x where x.activity_id = l.id),
          'sikayet', (select count(*) from reports r where r.target_type = 'activity' and r.target_id = l.id)
        ) order by l.started_at desc)
        from (select * from liste order by started_at desc offset greatest(sayfa, 0) * 50 limit 50) l
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.yonetim_rotalar(arama text default null, sayfa integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := nullif(lower(trim(coalesce(arama, ''))), '');
begin
  perform public.yonetici_sart();
  return (
    with liste as (
      select r.id, r.name, r.activity, r.distance_m, r.elevation_gain_m, r.visibility, r.created_at, r.owner_id, p.display_name
      from routes r join profiles p on p.id = r.owner_id
      where q is null or strpos(lower(r.name), q) > 0 or strpos(lower(p.display_name), q) > 0
    )
    select jsonb_build_object(
      'toplam', (select count(*) from liste),
      'satirlar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'name', l.name, 'activity', l.activity, 'distance_m', l.distance_m, 'elevation_gain_m', l.elevation_gain_m,
          'visibility', l.visibility, 'created_at', l.created_at, 'owner_id', l.owner_id, 'owner_name', l.display_name,
          'sikayet', (select count(*) from reports x where x.target_type = 'route' and x.target_id = l.id)
        ) order by l.created_at desc)
        from (select * from liste order by created_at desc offset greatest(sayfa, 0) * 50 limit 50) l
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.yonetim_gruplar(arama text default null, sayfa integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := nullif(lower(trim(coalesce(arama, ''))), '');
begin
  perform public.yonetici_sart();
  return (
    with liste as (
      select g.*, p.display_name as kuran
      from groups g join profiles p on p.id = g.created_by
      where q is null or strpos(lower(g.name), q) > 0 or strpos(lower(coalesce(g.city, '')), q) > 0
    )
    select jsonb_build_object(
      'toplam', (select count(*) from liste),
      'satirlar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'name', l.name, 'is_community', l.is_community, 'is_private', l.is_private, 'requires_approval', l.requires_approval,
          'city', l.city, 'created_at', l.created_at, 'kuran', l.kuran,
          'uye', (select count(*) from group_members m where m.group_id = l.id),
          'mesaj_7g', (select count(*) from messages m where m.group_id = l.id and m.created_at > now() - interval '7 days'),
          'sikayet', (select count(*) from reports x where x.target_type = 'group' and x.target_id = l.id)
        ) order by l.created_at desc)
        from (select * from liste order by created_at desc offset greatest(sayfa, 0) * 50 limit 50) l
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.yonetim_etkinlikler(arama text default null, sayfa integer default 0, gecmis boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := nullif(lower(trim(coalesce(arama, ''))), '');
begin
  perform public.yonetici_sart();
  return (
    with liste as (
      select e.*, p.display_name as olusturan, g.name as grup
      from events e join profiles p on p.id = e.created_by left join groups g on g.id = e.group_id
      where (case when gecmis then e.starts_at <= now() else e.starts_at > now() end)
        and (q is null or strpos(lower(e.title), q) > 0 or strpos(lower(coalesce(g.name, '')), q) > 0)
    )
    select jsonb_build_object(
      'toplam', (select count(*) from liste),
      'satirlar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'title', l.title, 'activity', l.activity, 'starts_at', l.starts_at, 'visibility', l.visibility,
          'capacity', l.capacity, 'grup', l.grup, 'olusturan', l.olusturan, 'meeting_point_name', l.meeting_point_name,
          'katilan', (select count(*) from event_attendees a where a.event_id = l.id and a.status::text = 'going'),
          'sikayet', (select count(*) from reports x where x.target_type = 'event' and x.target_id = l.id)
        ) order by case when gecmis then extract(epoch from l.starts_at) * -1 else extract(epoch from l.starts_at) end)
        from (
          select * from liste
          order by case when gecmis then extract(epoch from starts_at) * -1 else extract(epoch from starts_at) end
          offset greatest(sayfa, 0) * 50 limit 50
        ) l
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Şikayet hedefinin kısa özeti (silinmişse null)
create or replace function public.sikayet_hedefi(tur text, hedef uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case tur
    when 'user' then (select jsonb_build_object('ad', p.display_name, 'alt', '@' || p.username) from profiles p where p.id = hedef)
    when 'activity' then (select jsonb_build_object('ad', coalesce(a.title, a.activity::text), 'alt', p.display_name) from activities a join profiles p on p.id = a.owner_id where a.id = hedef)
    when 'route' then (select jsonb_build_object('ad', r.name, 'alt', p.display_name) from routes r join profiles p on p.id = r.owner_id where r.id = hedef)
    when 'message' then (select jsonb_build_object('ad', left(coalesce(m.body, '(ek)'), 140), 'alt', p.display_name || ' · ' || g.name) from messages m join profiles p on p.id = m.sender_id join groups g on g.id = m.group_id where m.id = hedef)
    when 'comment' then (select jsonb_build_object('ad', left(c.body, 140), 'alt', p.display_name) from activity_comments c join profiles p on p.id = c.user_id where c.id = hedef)
    when 'group' then (select jsonb_build_object('ad', g.name, 'alt', case when g.is_community then 'Topluluk' else 'Grup' end) from groups g where g.id = hedef)
    when 'event' then (select jsonb_build_object('ad', e.title, 'alt', to_char(e.starts_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')) from events e where e.id = hedef)
  end;
$$;

create or replace function public.yonetim_sikayetler(durum text default 'acik', sayfa integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.yonetici_sart();
  return (
    with liste as (
      select r.*, p.display_name as bildiren
      from reports r join profiles p on p.id = r.reporter_id
      where case durum
        when 'acik' then r.status in ('open', 'reviewing')
        when 'kapali' then r.status in ('resolved', 'dismissed')
        else true
      end
    )
    select jsonb_build_object(
      'toplam', (select count(*) from liste),
      'satirlar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'target_type', l.target_type, 'target_id', l.target_id, 'reason', l.reason, 'status', l.status,
          'admin_note', l.admin_note, 'created_at', l.created_at, 'bildiren', l.bildiren,
          'hedef', public.sikayet_hedefi(l.target_type, l.target_id),
          'ayni_hedef', (select count(*) from reports x where x.target_type = l.target_type and x.target_id = l.target_id)
        ) order by l.created_at desc)
        from (select * from liste order by created_at desc offset greatest(sayfa, 0) * 50 limit 50) l
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderasyon işlemleri
-- ---------------------------------------------------------------------------
create or replace function public.yonetim_sikayet_guncelle(sikayet uuid, durum text, notu text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.yonetici_sart();
  if durum not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'Geçersiz durum';
  end if;
  update reports set status = durum, admin_note = nullif(left(trim(coalesce(notu, '')), 1000), '') where id = sikayet;
  if not found then
    raise exception 'Şikayet bulunamadı';
  end if;
end;
$$;

create or replace function public.yonetim_aktivite_sil(aktivite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.yonetici_sart();
  delete from activities where id = aktivite;
end;
$$;

create or replace function public.yonetim_rota_gizle(rota uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.yonetici_sart();
  update routes set visibility = 'private' where id = rota;
  delete from route_shares where route_id = rota and group_id is null;
end;
$$;

create or replace function public.yonetim_grup_sil(g uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.yonetici_sart();
  delete from groups where id = g;
end;
$$;

create or replace function public.yonetim_etkinlik_sil(e uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.yonetici_sart();
  delete from events where id = e;
end;
$$;

create or replace function public.yonetim_yetki(kisi uuid, yonetici boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.yonetici_sart();
  if kisi = auth.uid() and not yonetici then
    raise exception 'Kendi yönetici yetkini alamazsın';
  end if;
  if yonetici and not public.kalici_hesap_mi(kisi) then
    raise exception 'Geçici hesaba yönetici yetkisi verilemez';
  end if;
  update profiles set is_admin = yonetici where id = kisi;
end;
$$;

-- ---------------------------------------------------------------------------
-- Uygulamadan şikayet
-- ---------------------------------------------------------------------------
create or replace function public.sikayet_et(tur text, hedef uuid, neden text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  temiz text := btrim(coalesce(neden, ''));
  yeni uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if tur not in ('user', 'activity', 'route', 'message', 'group', 'event', 'comment') then
    raise exception 'Geçersiz şikayet türü';
  end if;
  if char_length(temiz) < 3 or char_length(temiz) > 500 then
    raise exception 'Şikayet nedeni 3–500 karakter olmalı';
  end if;
  if public.sikayet_hedefi(tur, hedef) is null then
    raise exception 'Şikayet edilen içerik bulunamadı';
  end if;
  if (select count(*) from reports where reporter_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Çok fazla şikayet gönderdin, biraz bekle';
  end if;
  select id into yeni from reports
  where reporter_id = auth.uid() and target_type = tur and target_id = hedef and status in ('open', 'reviewing');
  if yeni is not null then
    return yeni;
  end if;
  insert into reports (reporter_id, target_type, target_id, reason) values (auth.uid(), tur, hedef, temiz) returning id into yeni;
  return yeni;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'yonetici_mi()', 'yonetim_ozet()', 'yonetim_kullanicilar(text, integer, boolean)', 'yonetim_aktiviteler(text, integer)',
    'yonetim_rotalar(text, integer)', 'yonetim_gruplar(text, integer)', 'yonetim_etkinlikler(text, integer, boolean)',
    'yonetim_sikayetler(text, integer)', 'yonetim_sikayet_guncelle(uuid, text, text)', 'yonetim_aktivite_sil(uuid)',
    'yonetim_rota_gizle(uuid)', 'yonetim_grup_sil(uuid)', 'yonetim_etkinlik_sil(uuid)', 'yonetim_yetki(uuid, boolean)',
    'sikayet_et(text, uuid, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['yonetici_sart()', 'sikayet_hedefi(text, uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$$;
