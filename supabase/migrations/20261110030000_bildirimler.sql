-- Lykiva — 14. aşama: uygulama içi bildirimler
--
-- Türler:
--   takip            → biri seni takip etmeye başladı
--   begeni           → aktiviteni beğendi
--   yorum            → aktivitene yorum yaptı
--   katilim_istegi   → yönettiğin gruba katılmak istiyor (sahip ve yöneticilere)
--   katilim_kabul    → gruba katılma isteğin kabul edildi
--   etkinlik         → grubunda yeni etkinlik (oluşturan hariç tüm üyelere)
-- - Bildirimler tetikleyicilerle yazılır; istemci yalnızca okur ve okundu işaretler
-- - Kendi hareketin sana bildirim olmaz; takibi / beğeniyi geri alınca okunmamış bildirim silinir
-- - Aynı kişiden aynı takip / beğeni için tek bildirim
-- - Okunmuş bildirimler 90 gün sonra temizlenir
-- - Telefona anlık bildirim (push) ayrı aşama: Apple / Google ayarı ister

create table if not exists public.bildirimler (
  id uuid primary key default gen_random_uuid(),
  alici uuid not null references public.profiles (id) on delete cascade,
  aktor uuid references public.profiles (id) on delete cascade,
  tur text not null check (tur in ('takip', 'begeni', 'yorum', 'katilim_istegi', 'katilim_kabul', 'etkinlik')),
  activity_id uuid references public.activities (id) on delete cascade,
  comment_id uuid references public.activity_comments (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  okundu boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bildirimler_alici_idx on public.bildirimler (alici, created_at desc);
create index if not exists bildirimler_okunmamis_idx on public.bildirimler (alici) where not okundu;
create unique index if not exists bildirimler_takip_tekil on public.bildirimler (alici, aktor) where tur = 'takip';
create unique index if not exists bildirimler_begeni_tekil on public.bildirimler (alici, aktor, activity_id) where tur = 'begeni';
create unique index if not exists bildirimler_istek_tekil on public.bildirimler (alici, aktor, group_id) where tur = 'katilim_istegi';

alter table public.bildirimler enable row level security;
-- Canlı rozet (Realtime) için yalnızca kendi bildirimlerini görür
create policy "bildirim_okuma" on public.bildirimler for select to authenticated using (alici = auth.uid());
revoke all on public.bildirimler from anon, authenticated;
grant select on public.bildirimler to authenticated;

-- ---------------------------------------------------------------------------
-- Tetikleyiciler
-- ---------------------------------------------------------------------------
create or replace function public.bildirim_takip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into bildirimler (alici, aktor, tur) values (new.followee_id, new.follower_id, 'takip') on conflict do nothing;
    return new;
  end if;
  delete from bildirimler where tur = 'takip' and alici = old.followee_id and aktor = old.follower_id and not okundu;
  return old;
end;
$$;

drop trigger if exists bildirim_takip on public.follows;
create trigger bildirim_takip after insert or delete on public.follows
  for each row execute function public.bildirim_takip();

create or replace function public.bildirim_begeni()
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
      insert into bildirimler (alici, aktor, tur, activity_id) values (sahip, new.user_id, 'begeni', new.activity_id) on conflict do nothing;
    end if;
    return new;
  end if;
  delete from bildirimler where tur = 'begeni' and aktor = old.user_id and activity_id = old.activity_id and not okundu;
  return old;
end;
$$;

drop trigger if exists bildirim_begeni on public.activity_likes;
create trigger bildirim_begeni after insert or delete on public.activity_likes
  for each row execute function public.bildirim_begeni();

create or replace function public.bildirim_yorum()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sahip uuid;
begin
  select owner_id into sahip from activities where id = new.activity_id;
  if sahip is not null and sahip <> new.user_id then
    insert into bildirimler (alici, aktor, tur, activity_id, comment_id) values (sahip, new.user_id, 'yorum', new.activity_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists bildirim_yorum on public.activity_comments;
create trigger bildirim_yorum after insert on public.activity_comments
  for each row execute function public.bildirim_yorum();

-- Katılma isteği: sahip ve yöneticilere; istek geri alınınca / yanıtlanınca okunmamış olanlar silinir
create or replace function public.bildirim_katilim_istegi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into bildirimler (alici, aktor, tur, group_id)
    select m.user_id, new.user_id, 'katilim_istegi', new.group_id
    from group_members m
    where m.group_id = new.group_id and m.role in ('owner', 'admin') and m.user_id <> new.user_id
    on conflict do nothing;
    return new;
  end if;
  delete from bildirimler where tur = 'katilim_istegi' and aktor = old.user_id and group_id = old.group_id and not okundu;
  return old;
end;
$$;

drop trigger if exists bildirim_katilim_istegi on public.group_join_requests;
create trigger bildirim_katilim_istegi after insert or delete on public.group_join_requests
  for each row execute function public.bildirim_katilim_istegi();

-- Grupta yeni etkinlik: oluşturan hariç tüm üyelere
create or replace function public.bildirim_etkinlik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is not null then
    insert into bildirimler (alici, aktor, tur, group_id, event_id)
    select m.user_id, new.created_by, 'etkinlik', new.group_id, new.id
    from group_members m
    where m.group_id = new.group_id and m.user_id <> new.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists bildirim_etkinlik on public.events;
create trigger bildirim_etkinlik after insert on public.events
  for each row execute function public.bildirim_etkinlik();

-- İsteği yanıtla: kabul edilince isteyen kişiye bildirim (20261109030000'deki fonksiyonun yerine geçer)
create or replace function public.istegi_yanitla(g uuid, kullanici uuid, kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.grup_yoneticisi_mi(g) then
    raise exception 'Yalnızca grup yöneticileri yanıtlayabilir';
  end if;
  delete from group_join_requests where group_id = g and user_id = kullanici;
  if not found then
    raise exception 'İstek bulunamadı';
  end if;
  if kabul then
    insert into group_members (group_id, user_id) values (g, kullanici) on conflict do nothing;
    insert into bildirimler (alici, aktor, tur, group_id) values (kullanici, auth.uid(), 'katilim_kabul', g);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Okuma
-- ---------------------------------------------------------------------------
create or replace function public.bildirimlerim(once timestamptz default null, adet integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'tur', b.tur,
    'okundu', b.okundu,
    'created_at', b.created_at,
    'aktor', b.aktor,
    'aktor_adi', p.display_name,
    'takip_ediyorum', case when b.tur = 'takip' then exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = b.aktor) end,
    'activity_id', b.activity_id,
    'aktivite_adi', (select coalesce(a.title, '') from activities a where a.id = b.activity_id),
    'yorum', (select left(c.body, 140) from activity_comments c where c.id = b.comment_id),
    'group_id', b.group_id,
    'grup_adi', (select g.name from groups g where g.id = b.group_id),
    'event_id', b.event_id,
    'etkinlik_adi', (select e.title from events e where e.id = b.event_id),
    'etkinlik_zamani', (select e.starts_at from events e where e.id = b.event_id)
  ) order by b.created_at desc, b.id desc), '[]'::jsonb)
  from (
    select * from bildirimler
    where alici = auth.uid() and (once is null or created_at < once)
    order by created_at desc, id desc
    limit least(greatest(coalesce(adet, 30), 1), 100)
  ) b
  left join profiles p on p.id = b.aktor;
$$;

create or replace function public.bildirim_sayisi()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from bildirimler where alici = auth.uid() and not okundu;
$$;

-- Tümünü (ya da verilen zamana kadarkileri) okundu say; eski okunmuşları temizle
create or replace function public.bildirimleri_okundu_say(son timestamptz default null)
returns void
language sql
security definer
set search_path = public
as $$
  update bildirimler set okundu = true
  where alici = auth.uid() and not okundu and created_at <= coalesce(son, now());
  delete from bildirimler where alici = auth.uid() and okundu and created_at < now() - interval '90 days';
$$;

-- ---------------------------------------------------------------------------
-- Hesap devri: bildirimler de taşınsın (20261110000000'deki fonksiyonun yerine geçer; önceki adımlar aynen)
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
-- Yetkiler ve Realtime
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['bildirimlerim(timestamptz, integer)', 'bildirim_sayisi()', 'bildirimleri_okundu_say(timestamptz)', 'hesabi_devral(uuid)', 'istegi_yanitla(uuid, uuid, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['bildirim_takip()', 'bildirim_begeni()', 'bildirim_yorum()', 'bildirim_katilim_istegi()', 'bildirim_etkinlik()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- Zil rozeti canlı güncellensin: bildirimler Realtime yayınında (yayın varsa)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bildirimler') then
    alter publication supabase_realtime add table public.bildirimler;
  end if;
end;
$$;
