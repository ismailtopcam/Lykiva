-- Lykiva — kulüpler: grup fotoğrafı, kulüp gönderileri, haftalık istatistik
--
-- Mobil: Gruplar sekmesi Meydan okumalar · Kulüpler · Etkinlikler olarak ayrıldı; kulüp (grup) sayfasında
-- Gönderiler, Paylaş ve Haftalık sekmeleri var.
--
-- - Grup fotoğrafı: groups.avatar_url (sütun ilk şemada vardı). Kova `grup` herkese açık (keşfette üye olmayan da görür).
--   Yol: <grup id>/<uuid>.jpg — yalnızca grubun yöneticileri yükler / siler; adresi groups tablosuna yönetici yazar
--   (grup_duzenleme kuralı). grup_detay, gruplarim, kesfet_gruplar avatar_url de döner.
-- - Gönderiler: grup_gonderileri (istemciye kapalı; fonksiyonlarla). Metin (en fazla 2000) ve / veya en fazla 4 fotoğraf.
--   Yalnızca üyeler okur ve paylaşır; yazan ya da grup yöneticisi siler. Fotoğraflar gizli `grup_gonderi` kovasında,
--   yol <grup id>/<uuid>.jpg: grubun üyeleri okur (imzalı adresle) ve yükler; yükleyen ya da grup yöneticisi siler.
--   grup_gonderisi_sil fotoğraf yollarını döner, dosyaları uygulama Storage API ile siler.
-- - Haftalık istatistik: grup_haftalik_istatistik(g) — bu hafta (Pazartesi 00:00, Türkiye saati) üyelerin toplamı,
--   gün gün mesafe, geçen haftayla karşılaştırma ve üye sıralaması. Yalnızca bakan kişinin görebildiği aktiviteler
--   sayılır (aktivite_gorunur_mu: kendi, herkese açık, takip ettiğinin "takipçiler"i, ortak gruptakinin "gruplar"ı);
--   gizli ("yalnızca ben") aktiviteler kimsenin istatistiğine girmez. Aktivitenin kendisi / haritası dönmez, yalnızca toplam.
-- - hesabi_devral: geçici hesabın gönderileri de taşınır.

-- ---------------------------------------------------------------------------
-- Grup fotoğrafı
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('grup', 'grup', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('grup_gonderi', 'grup_gonderi', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "grup_foto_yukleme" on storage.objects;
create policy "grup_foto_yukleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'grup' and public.foto_yolu_gecerli(name) and public.grup_yoneticisi_mi(public.yol_kimligi(name)));
drop policy if exists "grup_foto_silme" on storage.objects;
create policy "grup_foto_silme" on storage.objects for delete to authenticated
  using (bucket_id = 'grup' and public.grup_yoneticisi_mi(public.yol_kimligi(name)));
-- Silebilmek için yönetici dosyaları görür (herkese açık adres bu kurala bağlı değildir)
drop policy if exists "grup_foto_okuma" on storage.objects;
create policy "grup_foto_okuma" on storage.objects for select to authenticated
  using (bucket_id = 'grup' and public.grup_yoneticisi_mi(public.yol_kimligi(name)));

alter table public.groups drop constraint if exists grup_foto_adresi;
alter table public.groups add constraint grup_foto_adresi check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)) not valid;

-- ---------------------------------------------------------------------------
-- Gönderiler
-- ---------------------------------------------------------------------------
-- En fazla 4 fotoğraf, hepsi bu grubun klasöründe
create or replace function public.grup_gonderi_fotolari_gecerli(g uuid, yollar text[])
returns boolean
language sql
immutable
as $$
  select coalesce(array_length(yollar, 1), 0) <= 4
    and not exists (select 1 from unnest(yollar) y where not public.foto_yolu_gecerli(y) or public.yol_kimligi(y) is distinct from g);
$$;

create table if not exists public.grup_gonderileri (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint grup_gonderisi_bos_degil check (nullif(trim(coalesce(body, '')), '') is not null or coalesce(array_length(photos, 1), 0) > 0),
  constraint grup_gonderisi_uzunlugu check (body is null or char_length(body) <= 2000),
  constraint grup_gonderisi_fotolari check (public.grup_gonderi_fotolari_gecerli(group_id, photos))
);
create index if not exists grup_gonderileri_grup_idx on public.grup_gonderileri (group_id, created_at desc);
create index if not exists grup_gonderileri_yazan_idx on public.grup_gonderileri (author_id);

alter table public.grup_gonderileri enable row level security;
revoke all on public.grup_gonderileri from anon, authenticated;

drop policy if exists "grup_gonderi_foto_okuma" on storage.objects;
create policy "grup_gonderi_foto_okuma" on storage.objects for select to authenticated
  using (bucket_id = 'grup_gonderi' and public.grup_uyesi_mi(public.yol_kimligi(name)));
drop policy if exists "grup_gonderi_foto_yukleme" on storage.objects;
create policy "grup_gonderi_foto_yukleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'grup_gonderi' and public.foto_yolu_gecerli(name) and public.grup_uyesi_mi(public.yol_kimligi(name)));
drop policy if exists "grup_gonderi_foto_silme" on storage.objects;
create policy "grup_gonderi_foto_silme" on storage.objects for delete to authenticated
  using (bucket_id = 'grup_gonderi' and (owner = auth.uid() or public.grup_yoneticisi_mi(public.yol_kimligi(name))));

-- Grubun gönderileri, yeniden eskiye, 30'ar (once: sayfalama için son görülen gönderinin zamanı)
create or replace function public.grup_gonderileri(g uuid, once timestamptz default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.grup_uyesi_mi(g) then '[]'::jsonb else coalesce((
    select jsonb_agg(x.j order by x.t desc)
    from (
      select
        gp.created_at as t,
        jsonb_build_object(
          'id', gp.id,
          'body', gp.body,
          'photos', to_jsonb(gp.photos),
          'created_at', gp.created_at,
          'author_id', gp.author_id,
          'display_name', p.display_name,
          'username', p.username,
          'avatar_url', p.avatar_url,
          'mine', gp.author_id = auth.uid(),
          'silebilir', gp.author_id = auth.uid() or public.grup_yoneticisi_mi(g)
        ) as j
      from grup_gonderileri gp
      join profiles p on p.id = gp.author_id
      where gp.group_id = g and (once is null or gp.created_at < once)
      order by gp.created_at desc
      limit 30
    ) x
  ), '[]'::jsonb) end;
$$;

create or replace function public.grup_gonderisi_paylas(g uuid, metin text, fotolar text[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yeni uuid;
  m text := nullif(trim(coalesce(metin, '')), '');
  f text[] := coalesce(fotolar, '{}');
begin
  if not public.grup_uyesi_mi(g) then
    raise exception 'Bu grubun üyesi değilsin';
  end if;
  if m is null and coalesce(array_length(f, 1), 0) = 0 then
    raise exception 'Boş gönderi paylaşılamaz';
  end if;
  if char_length(m) > 2000 then
    raise exception 'Gönderi en fazla 2000 karakter olabilir';
  end if;
  if not public.grup_gonderi_fotolari_gecerli(g, f) then
    raise exception 'Fotoğraflar geçersiz (en fazla 4)';
  end if;
  -- Taşkın sınırı: kişi başı saatte 30 gönderi
  if (select count(*) from grup_gonderileri x where x.author_id = auth.uid() and x.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Çok sık paylaşım; biraz sonra yeniden dene';
  end if;
  insert into grup_gonderileri (group_id, author_id, body, photos) values (g, auth.uid(), m, f) returning id into yeni;
  return yeni;
end;
$$;

-- Yazan ya da grup yöneticisi siler; fotoğraf yollarını döner (dosyaları uygulama siler)
create or replace function public.grup_gonderisi_sil(gonderi uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  f text[];
begin
  delete from grup_gonderileri gp
  where gp.id = gonderi and (gp.author_id = auth.uid() or public.grup_yoneticisi_mi(gp.group_id))
  returning gp.photos into f;
  if f is null then
    raise exception 'Gönderi bulunamadı ya da silme yetkin yok';
  end if;
  return f;
end;
$$;

-- ---------------------------------------------------------------------------
-- Haftalık istatistik
-- ---------------------------------------------------------------------------
create or replace function public.grup_haftalik_istatistik(g uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with sinir as (
    select (date_trunc('week', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as bas
  ),
  akt as (
    select
      a.owner_id,
      a.distance_m,
      a.moving_time_s,
      coalesce(a.elevation_gain_m, 0) as tirmanis,
      a.started_at,
      a.started_at >= s.bas as bu_hafta
    from activities a
    join group_members m on m.group_id = g and m.user_id = a.owner_id
    cross join sinir s
    where a.started_at >= s.bas - interval '7 days'
      and a.started_at < s.bas + interval '7 days'
      and a.visibility <> 'private'
      and public.aktivite_gorunur_mu(a)
  ),
  bu as (select * from akt where bu_hafta)
  select case when not public.grup_uyesi_mi(g) then null else jsonb_build_object(
    'hafta_basi', (select bas from sinir),
    'uye_sayisi', (select count(*) from group_members m where m.group_id = g),
    'aktivite', (select count(*) from bu),
    'mesafe_m', (select coalesce(sum(distance_m), 0) from bu),
    'sure_s', (select coalesce(sum(moving_time_s), 0) from bu),
    'tirmanis_m', (select coalesce(round(sum(tirmanis)::numeric), 0) from bu),
    'aktif_uye', (select count(distinct owner_id) from bu),
    'gecen_hafta_mesafe_m', (select coalesce(sum(distance_m), 0) from akt where not bu_hafta),
    'gecen_hafta_aktivite', (select count(*) from akt where not bu_hafta),
    'gunler', (
      select jsonb_agg(coalesce((
        select sum(b.distance_m) from bu b
        where b.started_at >= s.bas + make_interval(days => d) and b.started_at < s.bas + make_interval(days => d + 1)
      ), 0) order by d)
      from generate_series(0, 6) d cross join sinir s
    ),
    'siralama', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', u.owner_id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url,
        'mesafe_m', u.mesafe, 'sure_s', u.sure, 'aktivite', u.sayi, 'ben', u.owner_id = auth.uid()
      ) order by u.mesafe desc, u.sure desc)
      from (
        select owner_id, sum(distance_m) as mesafe, sum(moving_time_s) as sure, count(*) as sayi
        from bu group by owner_id
        order by sum(distance_m) desc
        limit 50
      ) u
      join profiles p on p.id = u.owner_id
    ), '[]'::jsonb)
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Grup fotoğrafı da dönsün (gerisi 20261109030000_gruplar.sql ile aynı)
-- ---------------------------------------------------------------------------
create or replace function public.grup_detay(g uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not (not gr.is_private or public.grup_uyesi_mi(gr.id)) then null else jsonb_build_object(
    'id', gr.id,
    'name', gr.name,
    'description', gr.description,
    'is_community', gr.is_community,
    'is_private', gr.is_private,
    'requires_approval', gr.requires_approval,
    'primary_activity', gr.primary_activity,
    'city', gr.city,
    'avatar_url', gr.avatar_url,
    'created_at', gr.created_at,
    'member_count', (select count(*) from group_members m where m.group_id = gr.id),
    'my_role', public.grup_rolu(gr.id),
    'requested', exists (select 1 from group_join_requests r where r.group_id = gr.id and r.user_id = auth.uid()),
    'invite_code', case when public.grup_yoneticisi_mi(gr.id) then (select code from group_invites i where i.group_id = gr.id) end,
    'pending_count', case when public.grup_yoneticisi_mi(gr.id) then (select count(*) from group_join_requests r where r.group_id = gr.id) else 0 end
  ) end
  from groups gr
  where gr.id = g;
$$;
create or replace function public.gruplarim()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.j order by x.son desc nulls last), '[]'::jsonb)
  from (
    select
      coalesce(sm.created_at, m.joined_at) as son,
      jsonb_build_object(
        'id', gr.id,
        'name', gr.name,
        'is_community', gr.is_community,
        'is_private', gr.is_private,
        'primary_activity', gr.primary_activity,
        'city', gr.city,
        'avatar_url', gr.avatar_url,
        'my_role', m.role,
        'member_count', (select count(*) from group_members mm where mm.group_id = gr.id),
        'last_message', sm.body,
        'last_message_type', sm.attachment_type,
        'last_message_at', sm.created_at,
        'last_sender', sp.display_name,
        'unread', (
          select count(*) from messages um
          where um.group_id = gr.id and um.sender_id <> auth.uid()
            and um.created_at > coalesce((select last_read_at from group_reads r where r.group_id = gr.id and r.user_id = auth.uid()), m.joined_at)
        )
      ) as j
    from group_members m
    join groups gr on gr.id = m.group_id
    left join lateral (select * from messages mg where mg.group_id = gr.id order by mg.created_at desc limit 1) sm on true
    left join profiles sp on sp.id = sm.sender_id
    where m.user_id = auth.uid()
  ) x;
$$;
create or replace function public.kesfet_gruplar(arama text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.j order by x.sayi desc, x.ad), '[]'::jsonb)
  from (
    select
      (select count(*) from group_members m where m.group_id = gr.id) as sayi,
      gr.name as ad,
      jsonb_build_object(
        'id', gr.id,
        'name', gr.name,
        'description', gr.description,
        'is_community', gr.is_community,
        'requires_approval', gr.requires_approval,
        'primary_activity', gr.primary_activity,
        'city', gr.city,
        'avatar_url', gr.avatar_url,
        'member_count', (select count(*) from group_members m where m.group_id = gr.id),
        'requested', exists (select 1 from group_join_requests r where r.group_id = gr.id and r.user_id = auth.uid())
      ) as j
    from groups gr
    where not gr.is_private
      and not public.grup_uyesi_mi(gr.id)
      and (arama is null or trim(arama) = '' or gr.name ilike '%' || trim(arama) || '%' or gr.city ilike '%' || trim(arama) || '%')
    order by sayi desc
    limit 30
  ) x;
$$;

-- ---------------------------------------------------------------------------
-- Hesap devri: gönderiler de taşınır (gerisi 20261113000000_hedefler_meydan_okumalar.sql ile aynı)
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

  -- Hedefler: asıl hesapta aynısı yoksa taşınır (12 sınırı aşılmaz)
  update hedefler h set owner_id = auth.uid()
  where h.owner_id = eski
    and not exists (select 1 from hedefler x where x.owner_id = auth.uid() and x.donem = h.donem and x.olcu = h.olcu and x.activity is not distinct from h.activity)
    and h.id in (
      select y.id from hedefler y where y.owner_id = eski
      order by y.created_at limit greatest(0, 12 - (select count(*) from hedefler z where z.owner_id = auth.uid()))
    );
  delete from hedefler where owner_id = eski;
  -- Meydan okuma katılımları (grup üyelikleri taşınmadan önce: üyelik silinince eski hesabın katılımı da silinir)
  insert into meydan_okuma_katilimcilari (meydan_okuma_id, user_id, katildi)
    select meydan_okuma_id, auth.uid(), katildi from meydan_okuma_katilimcilari where user_id = eski
    on conflict do nothing;
  delete from meydan_okuma_katilimcilari where user_id = eski;
  update meydan_okumalar set olusturan = auth.uid() where olusturan = eski;

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
  update grup_gonderileri set author_id = auth.uid() where author_id = eski;
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

do $$
declare
  f text;
begin
  foreach f in array array[
    'grup_gonderileri(uuid, timestamptz)', 'grup_gonderisi_paylas(uuid, text, text[])', 'grup_gonderisi_sil(uuid)',
    'grup_haftalik_istatistik(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
