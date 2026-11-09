-- Lykiva — 15. aşama: birlikte yapılan aktivite
--
-- - Aktivitenin sahibi birlikte yaptığı kişileri etiketler (activity_participants)
--   Yalnızca tanıdıklar etiketlenebilir: takip ettiği, onu takip eden ya da ortak gruptaki kişiler
-- - Etiketlenen kişi aktiviteyi görür (aktivite_gorunur_mu bunu zaten kapsar), bildirim alır,
--   akışında görür ve etiketi kendisi kaldırabilir
-- - birlikte_onerileri(): aynı saatlerde (±15 dk) aynı yoldan (300 m) geçen tanıdıklar;
--   yalnızca senin görebildiğin aktivitelerden (birinin gizli aktivitesi öneriyle ortaya çıkmasın)
-- - Akış kartında "X ve N kişiyle", paylaşım kartında @kullanıcı adları

create index if not exists activity_participants_user_idx on public.activity_participants (user_id);

-- Yazma yalnızca fonksiyonlarla (tanıdık sınırı ve bildirim atlanamasın)
revoke insert, update, delete on public.activity_participants from anon, authenticated;
grant select on public.activity_participants to authenticated;

-- Bildirim türü: birlikte (seni bir aktiviteye etiketledi)
alter table public.bildirimler drop constraint if exists bildirimler_tur_check;
alter table public.bildirimler add constraint bildirimler_tur_check
  check (tur in ('takip', 'begeni', 'yorum', 'katilim_istegi', 'katilim_kabul', 'etkinlik', 'birlikte'));
create unique index if not exists bildirimler_birlikte_tekil on public.bildirimler (alici, activity_id) where tur = 'birlikte';

-- Tanıdık mı: takip (iki yönden biri) ya da ortak grup
create or replace function public.tanidik_mi(kisi uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from follows f where (f.follower_id = auth.uid() and f.followee_id = kisi) or (f.follower_id = kisi and f.followee_id = auth.uid()))
    or public.ortak_grup_var_mi(kisi);
$$;

-- ---------------------------------------------------------------------------
-- Etiketle / kaldır / listele
-- ---------------------------------------------------------------------------
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
    insert into activity_participants (activity_id, user_id) values (aktivite, k) on conflict do nothing;
    get diagnostics satir = row_count;
    eklenen := eklenen + satir;
  end loop;
  return eklenen;
end;
$$;

-- Sahibi herkesi, etiketlenen kendini kaldırır
create or replace function public.birlikte_cikar(aktivite uuid, kisi uuid)
returns boolean
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
  delete from activity_participants ap
  where ap.activity_id = aktivite and ap.user_id = kisi
    and (kisi = auth.uid() or exists (select 1 from activities a where a.id = aktivite and a.owner_id = auth.uid()));
  get diagnostics sayi = row_count;
  return sayi > 0;
end;
$$;

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
    where ap.activity_id = aktivite
  ), '[]'::jsonb) end;
$$;

-- Aynı saatlerde aynı yoldan geçen tanıdıklar (yalnızca sahibine)
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
      and not exists (select 1 from activity_participants ap where ap.activity_id = a.id and ap.user_id = o.owner_id)
    order by o.owner_id, fark
  ) x;
$$;

-- Etiketlenince bildirim (aktör: aktivitenin sahibi); etiket kaldırılınca okunmamış bildirim silinir
create or replace function public.bildirim_birlikte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sahip uuid;
begin
  if tg_op = 'INSERT' then
    select owner_id into sahip from activities where id = new.activity_id;
    if sahip is not null and sahip <> new.user_id then
      insert into bildirimler (alici, aktor, tur, activity_id) values (new.user_id, sahip, 'birlikte', new.activity_id) on conflict do nothing;
    end if;
    return new;
  end if;
  delete from bildirimler where tur = 'birlikte' and alici = old.user_id and activity_id = old.activity_id and not okundu;
  return old;
end;
$$;

drop trigger if exists bildirim_birlikte on public.activity_participants;
create trigger bildirim_birlikte after insert or delete on public.activity_participants
  for each row execute function public.bildirim_birlikte();

-- ---------------------------------------------------------------------------
-- Akış: kartta birlikte yapılanlar; etiketlendiğin aktiviteler "Takip ettiklerim"de
-- (20261110000000'deki fonksiyonun yerine geçer)
-- ---------------------------------------------------------------------------
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
      -- Birlikte yapılanlar: ilk 3 kişi ve toplam sayı
      'with', coalesce((
        select jsonb_agg(jsonb_build_object('id', w.user_id, 'ad', w.display_name) order by w.display_name)
        from (
          select ap.user_id, pp.display_name from activity_participants ap join profiles pp on pp.id = ap.user_id
          where ap.activity_id = a.id order by pp.display_name limit 3
        ) w
      ), '[]'::jsonb),
      'with_count', (select count(*) from activity_participants ap where ap.activity_id = a.id),
      'tagged_me', exists (select 1 from activity_participants ap where ap.activity_id = a.id and ap.user_id = ben)
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
-- Hesap devri: birlikte etiketleri de taşınsın (20261110030000'deki fonksiyonun yerine geçer)
-- ---------------------------------------------------------------------------
create or replace function public.hesabi_devral(p_kod uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  eski uuid;
  sayi integer;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Önce Google ya da Apple ile giriş yapılmalı';
  end if;

  delete from hesap_devirleri
  where kod = p_kod and olusturuldu > now() - interval '15 minutes'
  returning kaynak into eski;

  if eski is null then
    raise exception 'Devir kodu geçersiz ya da süresi dolmuş';
  end if;
  if eski = auth.uid() then
    return 0;
  end if;
  if not exists (select 1 from auth.users where id = eski and is_anonymous) then
    raise exception 'Kaynak hesap geçici değil';
  end if;

  update routes set owner_id = auth.uid() where owner_id = eski;
  update activities set owner_id = auth.uid() where owner_id = eski;
  get diagnostics sayi = row_count;

  insert into activity_likes (activity_id, user_id, created_at)
    select activity_id, auth.uid(), created_at from activity_likes where user_id = eski
    on conflict do nothing;
  delete from activity_likes where user_id = eski;
  update activity_comments set user_id = auth.uid() where user_id = eski;

  insert into follows (follower_id, followee_id, created_at)
    select auth.uid(), followee_id, created_at from follows where follower_id = eski and followee_id <> auth.uid()
    on conflict do nothing;
  insert into follows (follower_id, followee_id, created_at)
    select follower_id, auth.uid(), created_at from follows where followee_id = eski and follower_id <> auth.uid()
    on conflict do nothing;
  delete from follows where follower_id = eski or followee_id = eski;

  insert into group_members (group_id, user_id, role, joined_at)
    select group_id, auth.uid(), role, joined_at from group_members where user_id = eski
    on conflict do nothing;
  delete from group_members where user_id = eski;
  insert into event_attendees (event_id, user_id, status, updated_at)
    select event_id, auth.uid(), status, updated_at from event_attendees where user_id = eski
    on conflict do nothing;
  delete from event_attendees where user_id = eski;
  update messages set sender_id = auth.uid() where sender_id = eski;
  -- Birlikte etiketleri (kendi aktivitesinde kendini etiket olmaz)
  insert into activity_participants (activity_id, user_id)
    select ap.activity_id, auth.uid() from activity_participants ap join activities ac on ac.id = ap.activity_id
    where ap.user_id = eski and ac.owner_id <> auth.uid()
    on conflict do nothing;
  delete from activity_participants where user_id = eski;
  delete from activity_participants ap using activities ac where ac.id = ap.activity_id and ap.user_id = ac.owner_id;

  -- Bildirimler: alıcı olarak taşınır; kendine dönüşen (aktör = yeni hesap) olanlar silinir
  update bildirimler set alici = auth.uid() where alici = eski and coalesce(aktor, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
    and not exists (
      select 1 from bildirimler x
      where x.alici = auth.uid() and x.aktor is not distinct from bildirimler.aktor and x.tur = bildirimler.tur
        and x.tur in ('takip', 'begeni', 'katilim_istegi')
        and x.activity_id is not distinct from bildirimler.activity_id and x.group_id is not distinct from bildirimler.group_id
    );
  delete from bildirimler where alici = eski;
  update bildirimler set aktor = auth.uid() where aktor = eski and alici <> auth.uid()
    and not exists (
      select 1 from bildirimler x
      where x.aktor = auth.uid() and x.alici = bildirimler.alici and x.tur = bildirimler.tur
        and x.tur in ('takip', 'begeni', 'katilim_istegi')
        and x.activity_id is not distinct from bildirimler.activity_id and x.group_id is not distinct from bildirimler.group_id
    );
  delete from bildirimler where aktor = eski;

  return sayi;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['tanidik_mi(uuid)', 'birlikte_ekle(uuid, uuid[])', 'birlikte_cikar(uuid, uuid)', 'birlikte_kisiler(uuid)', 'birlikte_onerileri(uuid)',
                           'akis(text, timestamptz, uuid, float8, float8, integer)', 'hesabi_devral(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke execute on function public.bildirim_birlikte() from public, anon, authenticated';
end;
$$;
