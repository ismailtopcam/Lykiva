-- Lykiva — 33. aşama: hedefler ve meydan okumalar (rozetler telefonda hesaplanır, sunucuda tablo yok)
--
-- Hedefler: kullanıcının kendi haftalık / aylık / yıllık hedefi (mesafe, süre, aktivite sayısı, tırmanış;
--   isteğe bağlı aktivite türü). Yalnızca sahibi görür. İlerleme telefonda, kişisel rekorlarla aynı veriden hesaplanır.
--   Kişi başı en fazla 12 hedef; aynı dönem + ölçü + tür için tek hedef (yeniden kaydedince güncellenir).
--
-- Meydan okumalar: belli bir tarih aralığında bir hedef (ör. "Kasım'da 200 km bisiklet").
--   - Herkese açık olanları yalnızca yönetici açar (web /admin/meydan-okumalar); grup meydan okumasını
--     grubun herhangi bir üyesi açar, yalnızca grup üyeleri görür ve katılır.
--   - Katılımcının o aralıktaki bütün aktiviteleri sayılır (katılmadan önce başlayanlar ve gizli olanlar dahil);
--     sıralamada yalnızca toplam görünür, aktivitenin kendisi görünmez. Uygulama katılırken bunu söyler.
--   - Gruptan ayrılan kişi o grubun meydan okumalarından da çıkar.
--   - Silme: açan kişi, grubun yöneticisi ya da site yöneticisi.
--
-- Ölçü birimleri: mesafe metre, süre saniye (hareket süresi), sayı adet, tırmanış metre.

-- ---------------------------------------------------------------------------
-- Ortak: ölçü ve hedef kontrolü
-- ---------------------------------------------------------------------------
create or replace function public.olcu_hedefi_gecerli(olcu text, hedef double precision)
returns boolean
language sql
immutable
set search_path = public
as $$
  select hedef is not null and hedef > 0 and case olcu
    when 'mesafe' then hedef <= 100000000   -- 100.000 km
    when 'sure' then hedef <= 36000000      -- 10.000 saat
    when 'sayi' then hedef <= 10000 and hedef = trunc(hedef)
    when 'tirmanis' then hedef <= 10000000  -- 10.000 km
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Hedefler
-- ---------------------------------------------------------------------------
create table if not exists public.hedefler (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  donem text not null check (donem in ('hafta', 'ay', 'yil')),
  olcu text not null check (olcu in ('mesafe', 'sure', 'sayi', 'tirmanis')),
  hedef double precision not null,
  activity activity_type, -- null = bütün türler
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hedef_gecerli check (public.olcu_hedefi_gecerli(olcu, hedef)),
  constraint hedef_tekil unique nulls not distinct (owner_id, donem, olcu, activity)
);
alter table public.hedefler enable row level security;
revoke all on public.hedefler from anon, authenticated;
grant select on public.hedefler to authenticated;
drop policy if exists hedef_sahibi_okur on public.hedefler;
create policy hedef_sahibi_okur on public.hedefler for select to authenticated using (owner_id = auth.uid());

create or replace function public.hedef_kaydet(p_donem text, p_olcu text, p_hedef double precision, p_activity activity_type default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sonuc uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli' using errcode = '42501';
  end if;
  if p_donem is null or p_donem not in ('hafta', 'ay', 'yil') then
    raise exception 'Hedef dönemi geçersiz' using errcode = 'P0001';
  end if;
  if not public.olcu_hedefi_gecerli(p_olcu, p_hedef) then
    raise exception 'Hedef değeri geçersiz' using errcode = 'P0001';
  end if;

  update hedefler set hedef = p_hedef, updated_at = now()
  where owner_id = auth.uid() and donem = p_donem and olcu = p_olcu and activity is not distinct from p_activity
  returning id into sonuc;
  if sonuc is not null then
    return sonuc;
  end if;

  if (select count(*) from hedefler where owner_id = auth.uid()) >= 12 then
    raise exception 'En fazla 12 hedef koyabilirsin' using errcode = 'P0001';
  end if;
  insert into hedefler (owner_id, donem, olcu, hedef, activity)
  values (auth.uid(), p_donem, p_olcu, p_hedef, p_activity)
  returning id into sonuc;
  return sonuc;
end;
$$;

create or replace function public.hedef_sil(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from hedefler where id = p_id and owner_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Meydan okumalar
-- ---------------------------------------------------------------------------
create table if not exists public.meydan_okumalar (
  id uuid primary key default gen_random_uuid(),
  baslik text not null check (char_length(baslik) between 2 and 80),
  aciklama text check (aciklama is null or char_length(aciklama) <= 1000),
  olcu text not null check (olcu in ('mesafe', 'sure', 'sayi', 'tirmanis')),
  hedef double precision not null,
  turler activity_type[] not null default '{}', -- boş = bütün türler
  baslangic timestamptz not null,
  bitis timestamptz not null,
  group_id uuid references public.groups (id) on delete cascade, -- null = herkese açık (yönetimden)
  olusturan uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint meydan_okuma_hedefi check (public.olcu_hedefi_gecerli(olcu, hedef)),
  constraint meydan_okuma_araligi check (bitis > baslangic and bitis <= baslangic + interval '366 days')
);
create index if not exists meydan_okumalar_bitis_idx on public.meydan_okumalar (bitis desc);
create index if not exists meydan_okumalar_grup_idx on public.meydan_okumalar (group_id) where group_id is not null;

create table if not exists public.meydan_okuma_katilimcilari (
  meydan_okuma_id uuid not null references public.meydan_okumalar (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  katildi timestamptz not null default now(),
  primary key (meydan_okuma_id, user_id)
);
create index if not exists meydan_okuma_katilimcilari_kisi_idx on public.meydan_okuma_katilimcilari (user_id);

alter table public.meydan_okumalar enable row level security;
alter table public.meydan_okuma_katilimcilari enable row level security;
revoke all on public.meydan_okumalar from anon, authenticated;
revoke all on public.meydan_okuma_katilimcilari from anon, authenticated;

-- Görebilir mi: herkese açık olanı her oturum, grubunkini grup üyeleri (ve site yöneticisi)
create or replace function public.meydan_okumayi_gorebilir_mi(m public.meydan_okumalar)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (m.group_id is null or public.grup_uyesi_mi(m.group_id) or public.yonetici_mi());
$$;

-- Bir kişinin meydan okumadaki değeri (aralıktaki bütün aktiviteleri)
create or replace function public.meydan_okuma_degeri(m public.meydan_okumalar, kisi uuid)
returns double precision
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(case m.olcu
      when 'mesafe' then sum(a.distance_m)
      when 'sure' then sum(a.moving_time_s)::double precision
      when 'sayi' then count(*)::double precision
      when 'tirmanis' then sum(coalesce(a.elevation_gain_m, 0))
    end, 0)
  from activities a
  where a.owner_id = kisi
    and a.started_at >= m.baslangic and a.started_at < m.bitis
    and (cardinality(m.turler) = 0 or a.activity = any (m.turler));
$$;

create or replace function public.meydan_okuma_ozeti(m public.meydan_okumalar)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with b as (select exists (select 1 from meydan_okuma_katilimcilari k where k.meydan_okuma_id = m.id and k.user_id = auth.uid()) as katildim)
  select jsonb_build_object(
    'id', m.id, 'baslik', m.baslik, 'aciklama', m.aciklama, 'olcu', m.olcu, 'hedef', m.hedef, 'turler', to_jsonb(m.turler),
    'baslangic', m.baslangic, 'bitis', m.bitis, 'group_id', m.group_id,
    'grup_adi', (select g.name from groups g where g.id = m.group_id),
    'katilimci_sayisi', (select count(*) from meydan_okuma_katilimcilari k where k.meydan_okuma_id = m.id),
    'katildim', b.katildim,
    'degerim', case when b.katildim then public.meydan_okuma_degeri(m, auth.uid()) end,
    'yonetebilir', m.olusturan = auth.uid() or (m.group_id is not null and public.grup_yoneticisi_mi(m.group_id)) or public.yonetici_mi()
  )
  from b;
$$;

-- Liste: görebildiğim, bitişinin üstünden 30 günden az geçmiş ya da katıldığım meydan okumalar.
-- g verilirse yalnızca o grubunkiler.
create or replace function public.meydan_okumalar_listesi(g uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.meydan_okuma_ozeti(m) order by m.bitis desc), '[]'::jsonb)
  from meydan_okumalar m
  where (g is null or m.group_id = g)
    and public.meydan_okumayi_gorebilir_mi(m)
    and (m.bitis > now() - interval '30 days'
         or exists (select 1 from meydan_okuma_katilimcilari k where k.meydan_okuma_id = m.id and k.user_id = auth.uid()));
$$;

-- Detay + sıralama (ilk 50 ve benim yerim). Göremiyorsa null.
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
    select s.satir, s.user_id, jsonb_build_object(
      'user_id', s.user_id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url,
      'deger', s.deger, 'sira', s.sira, 'ben', s.user_id = auth.uid()
    ) as o
    from s join profiles p on p.id = s.user_id
  )
  select coalesce((select jsonb_agg(o order by satir) from j where satir <= 50), '[]'::jsonb),
         (select o from j where user_id = auth.uid())
  into liste, benim;

  return public.meydan_okuma_ozeti(m) || jsonb_build_object('siralama', liste, 'benim', benim);
end;
$$;

create or replace function public.meydan_okuma_olustur(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grup uuid := nullif(p ->> 'group_id', '')::uuid;
  v_bas timestamptz := (p ->> 'baslangic')::timestamptz;
  v_son timestamptz := (p ->> 'bitis')::timestamptz;
  v_ad text := trim(coalesce(p ->> 'baslik', ''));
  v_aciklama text := nullif(trim(coalesce(p ->> 'aciklama', '')), '');
  v_olcu text := p ->> 'olcu';
  v_hedef double precision := (p ->> 'hedef')::double precision;
  v_turler activity_type[];
  v_yeni uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli' using errcode = '42501';
  end if;
  if v_grup is null then
    perform public.yonetici_sart();
  elsif not public.grup_uyesi_mi(v_grup) then
    raise exception 'Bu grubun üyesi değilsin' using errcode = '42501';
  end if;
  if char_length(v_ad) not between 2 and 80 then
    raise exception 'Meydan okuma adı 2–80 karakter olmalı' using errcode = 'P0001';
  end if;
  if v_aciklama is not null and char_length(v_aciklama) > 1000 then
    raise exception 'Açıklama en fazla 1000 karakter olabilir' using errcode = 'P0001';
  end if;
  if not public.olcu_hedefi_gecerli(v_olcu, v_hedef) then
    raise exception 'Hedef değeri geçersiz' using errcode = 'P0001';
  end if;
  if v_bas is null or v_son is null or v_son <= v_bas then
    raise exception 'Bitiş başlangıçtan sonra olmalı' using errcode = 'P0001';
  end if;
  if v_son <= now() then
    raise exception 'Bitiş gelecekte olmalı' using errcode = 'P0001';
  end if;
  if v_bas < now() - interval '31 days' or v_bas > now() + interval '366 days' then
    raise exception 'Başlangıç en fazla bir ay önce, en fazla bir yıl sonra olabilir' using errcode = 'P0001';
  end if;
  if v_son > v_bas + interval '366 days' then
    raise exception 'Meydan okuma en fazla bir yıl sürebilir' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements_text(coalesce(p -> 'turler', '[]'::jsonb)) x
             where x not in (select unnest(enum_range(null::activity_type))::text)) then
    raise exception 'Aktivite türü geçersiz' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct x::activity_type), '{}') into v_turler
  from jsonb_array_elements_text(coalesce(p -> 'turler', '[]'::jsonb)) x;
  if not public.yonetici_mi()
     and (select count(*) from meydan_okumalar m where m.olusturan = auth.uid() and m.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Bir günde en fazla 10 meydan okuma açabilirsin' using errcode = 'P0001';
  end if;

  insert into meydan_okumalar (baslik, aciklama, olcu, hedef, turler, baslangic, bitis, group_id, olusturan)
  values (v_ad, v_aciklama, v_olcu, v_hedef, v_turler, v_bas, v_son, v_grup, auth.uid())
  returning id into v_yeni;
  -- Grupta açan kişi kendiliğinden katılır
  if v_grup is not null then
    insert into meydan_okuma_katilimcilari (meydan_okuma_id, user_id) values (v_yeni, auth.uid());
  end if;
  return v_yeni;
end;
$$;

create or replace function public.meydan_okumaya_katil(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m meydan_okumalar;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli' using errcode = '42501';
  end if;
  select * into m from meydan_okumalar where id = p_id;
  if m.id is null or not public.meydan_okumayi_gorebilir_mi(m) then
    raise exception 'Meydan okuma bulunamadı' using errcode = 'P0001';
  end if;
  if m.group_id is not null and not public.grup_uyesi_mi(m.group_id) then
    raise exception 'Bu grubun üyesi değilsin' using errcode = '42501';
  end if;
  if m.bitis <= now() then
    raise exception 'Bu meydan okuma bitti' using errcode = 'P0001';
  end if;
  insert into meydan_okuma_katilimcilari (meydan_okuma_id, user_id) values (m.id, auth.uid()) on conflict do nothing;
end;
$$;

create or replace function public.meydan_okumadan_ayril(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from meydan_okuma_katilimcilari where meydan_okuma_id = p_id and user_id = auth.uid();
$$;

create or replace function public.meydan_okuma_sil(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m meydan_okumalar;
begin
  select * into m from meydan_okumalar where id = p_id;
  if m.id is null then
    return;
  end if;
  if not (m.olusturan = auth.uid() or (m.group_id is not null and public.grup_yoneticisi_mi(m.group_id)) or public.yonetici_mi()) then
    raise exception 'Bu meydan okumayı silme yetkin yok' using errcode = '42501';
  end if;
  delete from meydan_okumalar where id = m.id;
end;
$$;

-- Gruptan ayrılan (ya da çıkarılan) kişi o grubun meydan okumalarından da çıkar
create or replace function public.gruptan_ayrilinca_meydan_okumadan_cik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from meydan_okuma_katilimcilari k using meydan_okumalar m
  where m.id = k.meydan_okuma_id and m.group_id = old.group_id and k.user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists grup_uyeligi_bitince_meydan_okuma on public.group_members;
create trigger grup_uyeligi_bitince_meydan_okuma
  after delete on public.group_members
  for each row execute function public.gruptan_ayrilinca_meydan_okumadan_cik();

-- ---------------------------------------------------------------------------
-- Yönetim: bütün meydan okumalar (herkese açık + grup)
-- ---------------------------------------------------------------------------
create or replace function public.yonetim_meydan_okumalar(arama text default null, sayfa integer default 0)
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
      select m.*, p.display_name as olusturan_adi, g.name as grup
      from meydan_okumalar m left join profiles p on p.id = m.olusturan left join groups g on g.id = m.group_id
      where q is null or strpos(lower(m.baslik), q) > 0 or strpos(lower(coalesce(g.name, '')), q) > 0
    )
    select jsonb_build_object(
      'toplam', (select count(*) from liste),
      'satirlar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'baslik', l.baslik, 'olcu', l.olcu, 'hedef', l.hedef, 'turler', to_jsonb(l.turler),
          'baslangic', l.baslangic, 'bitis', l.bitis, 'grup', l.grup, 'olusturan', l.olusturan_adi,
          'durum', case when l.bitis <= now() then 'bitti' when l.baslangic > now() then 'baslamadi' else 'suruyor' end,
          'katilimci', (select count(*) from meydan_okuma_katilimcilari k where k.meydan_okuma_id = l.id)
        ) order by l.bitis desc)
        from (select * from liste order by bitis desc offset greatest(sayfa, 0) * 50 limit 50) l
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Hesap devri: hedefler ve meydan okuma katılımları da taşınsın (20261110040000'deki fonksiyonun yerine geçer)
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
  foreach f in array array['hedef_kaydet(text, text, double precision, activity_type)', 'hedef_sil(uuid)',
                           'meydan_okumalar_listesi(uuid)', 'meydan_okuma_detay(uuid)', 'meydan_okuma_olustur(jsonb)',
                           'meydan_okumaya_katil(uuid)', 'meydan_okumadan_ayril(uuid)', 'meydan_okuma_sil(uuid)',
                           'yonetim_meydan_okumalar(text, integer)', 'hesabi_devral(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['meydan_okumayi_gorebilir_mi(public.meydan_okumalar)', 'meydan_okuma_degeri(public.meydan_okumalar, uuid)',
                           'meydan_okuma_ozeti(public.meydan_okumalar)', 'gruptan_ayrilinca_meydan_okumadan_cik()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$$;
