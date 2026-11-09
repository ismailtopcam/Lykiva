-- Lykiva — 11. aşama: akış ve takip
--
-- - akis(): ana sayfadaki aktivite akışı; üç süzgeç:
--     'takip'   → kendim + takip ettiklerim
--     'gruplar' → ortak gruptaki kişiler (kendim hariç)
--     'yakin'   → verilen konuma 25 km içinden geçen aktiviteler
--   Her durumda yalnızca görme iznim olan aktiviteler gelir (aktivite_gorunur_mu).
--   Sayfalama: son öğenin (started_at, id) değeri "önce" olarak verilir.
-- - Takip etme / bırakma ve beğeni doğrudan tablo yazımıyla yapılır (kurallar 20261108000000'de)
-- - kisi_profili(), kisi_ara(), takip_listesi(): kişi sayfası, kişi arama / öneriler, takipçi listeleri
-- - Geçici (anonim) hesaplar aramada ve önerilerde görünmez
-- - hesabi_devral(): geçici hesaptan asıl hesaba geçerken takipler, grup üyelikleri,
--   etkinlik katılımları ve grup mesajları da taşınır

-- ---------------------------------------------------------------------------
-- İndeksler
-- ---------------------------------------------------------------------------
create index if not exists activities_started_id_idx on public.activities (started_at desc, id desc);
create index if not exists activities_track_gix on public.activities using gist (track);
create index if not exists follows_followee_idx on public.follows (followee_id);
create index if not exists activity_comments_activity_idx on public.activity_comments (activity_id);

-- ---------------------------------------------------------------------------
-- Yardımcı: geçici (anonim) olmayan hesap mı
-- ---------------------------------------------------------------------------
create or replace function public.kalici_hesap_mi(kisi uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((select not coalesce(u.is_anonymous, false) from auth.users u where u.id = kisi), false);
$$;

-- ---------------------------------------------------------------------------
-- Akış
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
      'mine', a.owner_id = ben
    ) as satir
    from activities a
    join profiles pr on pr.id = a.owner_id
    where public.aktivite_gorunur_mu(a)
      and (once_zaman is null or (a.started_at, a.id) < (once_zaman, coalesce(once_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
      and case filtre
        when 'takip' then a.owner_id = ben or exists (select 1 from follows f where f.follower_id = ben and f.followee_id = a.owner_id)
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
-- Kişi sayfası
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
      'bio', p.bio,
      'city', p.city,
      'created_at', p.created_at,
      'me', p.id = auth.uid(),
      'temporary', not public.kalici_hesap_mi(p.id),
      'follower_count', (select count(*) from follows f where f.followee_id = p.id),
      'following_count', (select count(*) from follows f where f.follower_id = p.id),
      'i_follow', exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id),
      'follows_me', exists (select 1 from follows f where f.follower_id = p.id and f.followee_id = auth.uid()),
      'common_group', public.ortak_grup_var_mi(p.id),
      'activity_count', (select count(*) from activities a where a.owner_id = p.id and public.aktivite_gorunur_mu(a))
    )
    from profiles p where p.id = kisi
  ) end;
$$;

-- Kişi arama; arama boşsa öneriler: beni takip edenler ve ortak gruptakiler (henüz takip etmediklerim)
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

-- Bir kişinin takipçileri ('takipci') ya da takip ettikleri ('takip')
create or replace function public.takip_listesi(kisi uuid, yon text default 'takipci')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null or yon not in ('takipci', 'takip') then '[]'::jsonb else coalesce((
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

-- ---------------------------------------------------------------------------
-- Hesap devri: takipler, grup üyelikleri, etkinlik katılımları ve mesajlar da taşınsın
-- (20261109000000_giris.sql'deki fonksiyonun yerine geçer; önceki adımlar aynen korunur)
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
  -- Yalnızca geçici hesaplardan taşınır
  if not exists (select 1 from auth.users where id = eski and is_anonymous) then
    raise exception 'Kaynak hesap geçici değil';
  end if;

  update routes set owner_id = auth.uid() where owner_id = eski;
  update activities set owner_id = auth.uid() where owner_id = eski;
  get diagnostics sayi = row_count;

  -- Beğeniler ve yorumlar (çakışanlar atlanır)
  insert into activity_likes (activity_id, user_id, created_at)
    select activity_id, auth.uid(), created_at from activity_likes where user_id = eski
    on conflict do nothing;
  delete from activity_likes where user_id = eski;
  update activity_comments set user_id = auth.uid() where user_id = eski;

  -- Takipler (iki yönde; kendini takip ve çakışanlar atlanır)
  insert into follows (follower_id, followee_id, created_at)
    select auth.uid(), followee_id, created_at from follows where follower_id = eski and followee_id <> auth.uid()
    on conflict do nothing;
  insert into follows (follower_id, followee_id, created_at)
    select follower_id, auth.uid(), created_at from follows where followee_id = eski and follower_id <> auth.uid()
    on conflict do nothing;
  delete from follows where follower_id = eski or followee_id = eski;

  -- Grup üyelikleri (zaten üyeyse mevcut rol kalır), etkinlik katılımları, grup mesajları
  insert into group_members (group_id, user_id, role, joined_at)
    select group_id, auth.uid(), role, joined_at from group_members where user_id = eski
    on conflict do nothing;
  delete from group_members where user_id = eski;
  insert into event_attendees (event_id, user_id, status, updated_at)
    select event_id, auth.uid(), status, updated_at from event_attendees where user_id = eski
    on conflict do nothing;
  delete from event_attendees where user_id = eski;
  update messages set sender_id = auth.uid() where sender_id = eski;

  return sayi;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function public.kalici_hesap_mi(uuid) from public, anon;
grant execute on function public.kalici_hesap_mi(uuid) to authenticated;

revoke execute on function public.akis(text, timestamptz, uuid, float8, float8, integer) from public, anon;
revoke execute on function public.kisi_profili(uuid) from public, anon;
revoke execute on function public.kisi_ara(text) from public, anon;
revoke execute on function public.takip_listesi(uuid, text) from public, anon;
revoke execute on function public.hesabi_devral(uuid) from public, anon;
grant execute on function public.akis(text, timestamptz, uuid, float8, float8, integer) to authenticated;
grant execute on function public.kisi_profili(uuid) to authenticated;
grant execute on function public.kisi_ara(text) to authenticated;
grant execute on function public.takip_listesi(uuid, text) to authenticated;
grant execute on function public.hesabi_devral(uuid) to authenticated;

-- Takip ve beğeni istemciden doğrudan yazılır (kurallar 20261108000000'de)
grant select, insert, delete on public.follows, public.activity_likes to authenticated;
