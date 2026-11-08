-- Lykiva — 8. aşama: gruplar, topluluklar ve grup sohbeti
--
-- - Özel grup (is_private): keşfette görünmez, davet koduyla katılınır
-- - Topluluk / açık grup (is_private = false): keşfette görünür; requires_approval ise yönetici onaylar
-- - Üyelik değişiklikleri yalnızca aşağıdaki fonksiyonlarla yapılır (doğrudan yazma kuralı yok)
-- - Sohbet: üyeler okur ve yazar; Supabase Realtime ile canlı (messages yayına eklenir)
-- - "Gruplar" görünürlüğündeki aktivite ve rotaları ortak gruptaki kişiler görür
-- - Rota gruba paylaşılabilir (route_shares.group_id)

-- ---------------------------------------------------------------------------
-- Yardımcılar (RLS içinde döngüye girmemek için security definer)
-- ---------------------------------------------------------------------------
create or replace function public.grup_rolu(g uuid)
returns member_role
language sql
stable
security definer
set search_path = public
as $$
  select role from group_members where group_id = g and user_id = auth.uid();
$$;

create or replace function public.grup_uyesi_mi(g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid());
$$;

create or replace function public.grup_yoneticisi_mi(g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

create or replace function public.ortak_grup_var_mi(diger uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = diger
  );
$$;

create or replace function public.acik_grup_mu(g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from groups where id = g and not is_private);
$$;

create or replace function public.rota_sahibi_mi(r uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from routes where id = r and owner_id = auth.uid());
$$;

create or replace function public.rota_bana_paylasildi_mi(r uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from route_shares rs
    where rs.route_id = r
      and (rs.user_id = auth.uid() or (rs.group_id is not null and exists (
        select 1 from group_members m where m.group_id = rs.group_id and m.user_id = auth.uid()
      )))
  );
$$;

-- ---------------------------------------------------------------------------
-- Yeni tablolar
-- ---------------------------------------------------------------------------
create table if not exists public.group_invites (
  group_id uuid primary key references public.groups (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.group_join_requests (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Sohbette en son nereye kadar okundu (okunmamış sayısı için)
create table if not exists public.group_reads (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_invites enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.group_reads enable row level security;

alter table public.groups add constraint grup_adi_uzunlugu check (char_length(trim(name)) between 2 and 60) not valid;
alter table public.messages add constraint mesaj_icerigi check (
  (body is not null and char_length(body) between 1 and 4000) or attachment_type is not null
) not valid;
create unique index if not exists route_shares_grup_tekil on public.route_shares (route_id, group_id) where group_id is not null;
create index if not exists group_members_user_idx on public.group_members (user_id);

-- 8 karakterlik okunaklı davet kodu (0/O, 1/I gibi karışanlar yok)
create or replace function public.yeni_davet_kodu()
returns text
language sql
volatile
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 8);
$$;

-- ---------------------------------------------------------------------------
-- Kurallar
-- ---------------------------------------------------------------------------
create policy "grup_okuma" on public.groups for select to authenticated
  using (not is_private or public.grup_uyesi_mi(id));
create policy "grup_duzenleme" on public.groups for update to authenticated
  using (public.grup_yoneticisi_mi(id)) with check (public.grup_yoneticisi_mi(id));
create policy "grup_silme" on public.groups for delete to authenticated
  using (public.grup_rolu(id) = 'owner');

create policy "uye_okuma" on public.group_members for select to authenticated
  using (public.grup_uyesi_mi(group_id) or public.acik_grup_mu(group_id));

create policy "istek_okuma" on public.group_join_requests for select to authenticated
  using (user_id = auth.uid() or public.grup_yoneticisi_mi(group_id));

create policy "okuma_isareti" on public.group_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.grup_uyesi_mi(group_id));

create policy "mesaj_okuma" on public.messages for select to authenticated
  using (public.grup_uyesi_mi(group_id));
create policy "mesaj_yazma" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.grup_uyesi_mi(group_id)
    and (attachment_type is null or attachment_type in ('route', 'activity', 'location'))
  );
create policy "mesaj_silme" on public.messages for delete to authenticated
  using (sender_id = auth.uid() or public.grup_yoneticisi_mi(group_id));

create policy "rota_paylasim_okuma" on public.route_shares for select to authenticated
  using (user_id = auth.uid() or public.rota_sahibi_mi(route_id) or (group_id is not null and public.grup_uyesi_mi(group_id)));
create policy "rota_paylasim_ekleme" on public.route_shares for insert to authenticated
  with check (public.rota_sahibi_mi(route_id) and (group_id is null or public.grup_uyesi_mi(group_id)));
create policy "rota_paylasim_silme" on public.route_shares for delete to authenticated
  using (public.rota_sahibi_mi(route_id));

-- Rota okuma: gruba / kişiye paylaşılan, takipçilere ve gruplara açık rotalar da
drop policy if exists "rota_okuma" on public.routes;
create policy "rota_okuma" on public.routes for select to authenticated using (
  owner_id = auth.uid()
  or visibility = 'public'
  or (visibility = 'followers' and public.takip_ediyor_mu(owner_id))
  or (visibility = 'groups' and public.ortak_grup_var_mi(owner_id))
  or public.rota_bana_paylasildi_mi(id)
);

-- Aktivite görünürlüğü: "groups" ortak gruptaki kişilere açık
create or replace function public.aktivite_gorunur_mu(a public.activities)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    a.owner_id = auth.uid()
    or a.visibility = 'public'
    or (a.visibility = 'followers' and public.takip_ediyor_mu(a.owner_id))
    or (a.visibility = 'groups' and public.ortak_grup_var_mi(a.owner_id))
    or exists (select 1 from activity_participants ap where ap.activity_id = a.id and ap.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Grup işlemleri
-- ---------------------------------------------------------------------------
create or replace function public.grup_olustur(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yeni uuid;
  ad text := trim(coalesce(p ->> 'name', ''));
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if char_length(ad) < 2 or char_length(ad) > 60 then
    raise exception 'Grup adı 2–60 karakter olmalı';
  end if;
  insert into groups (name, description, is_community, is_private, requires_approval, primary_activity, city, created_by)
  values (
    ad,
    nullif(left(trim(coalesce(p ->> 'description', '')), 500), ''),
    coalesce((p ->> 'is_community')::boolean, false),
    coalesce((p ->> 'is_private')::boolean, true),
    coalesce((p ->> 'requires_approval')::boolean, false),
    nullif(p ->> 'primary_activity', '')::activity_type,
    nullif(left(trim(coalesce(p ->> 'city', '')), 60), ''),
    auth.uid()
  )
  returning id into yeni;
  insert into group_members (group_id, user_id, role) values (yeni, auth.uid(), 'owner');
  insert into group_invites (group_id, code) values (yeni, yeni_davet_kodu());
  return yeni;
end;
$$;

-- Tek grup: bilgiler + üye sayısı + benim durumum (yöneticiyse davet kodu ve bekleyen istekler)
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

-- Üye olduğum gruplar: son mesaj ve okunmamış sayısıyla, son hareket önce
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

-- Keşfet: üyesi olmadığım açık gruplar / topluluklar (üye sayısına göre)
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

-- Açık gruba katıl: onay gerekiyorsa istek bırakır. Döner: 'uye' ya da 'istek'
create or replace function public.gruba_katil(g uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  gr groups;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  select * into gr from groups where id = g;
  if gr.id is null then
    raise exception 'Grup bulunamadı';
  end if;
  if public.grup_uyesi_mi(g) then
    return 'uye';
  end if;
  if gr.is_private then
    raise exception 'Bu gruba davet koduyla katılınır';
  end if;
  if gr.requires_approval then
    insert into group_join_requests (group_id, user_id) values (g, auth.uid()) on conflict do nothing;
    return 'istek';
  end if;
  insert into group_members (group_id, user_id) values (g, auth.uid()) on conflict do nothing;
  return 'uye';
end;
$$;

create or replace function public.istegi_geri_al(g uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from group_join_requests where group_id = g and user_id = auth.uid();
$$;

-- Davet koduyla katıl (özel ya da açık her grup). Döner: grup kimliği
create or replace function public.davetle_katil(kod text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  g uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  select group_id into g from group_invites where code = upper(regexp_replace(coalesce(kod, ''), '[^A-Za-z0-9]', '', 'g'));
  if g is null then
    raise exception 'Davet kodu geçersiz';
  end if;
  insert into group_members (group_id, user_id) values (g, auth.uid()) on conflict do nothing;
  delete from group_join_requests where group_id = g and user_id = auth.uid();
  return g;
end;
$$;

create or replace function public.bekleyen_istekler(g uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.grup_yoneticisi_mi(g) then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url, 'created_at', r.created_at) order by r.created_at)
    from group_join_requests r join profiles p on p.id = r.user_id
    where r.group_id = g
  ), '[]'::jsonb) end;
$$;

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
  end if;
end;
$$;

-- Gruptan ayrıl. Sahip ayrılırsa sahiplik önce yöneticilere, yoksa en eski üyeye geçer; son kişi ayrılırsa grup silinir
create or replace function public.gruptan_ayril(g uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rol member_role := public.grup_rolu(g);
  sonraki uuid;
begin
  if rol is null then
    return;
  end if;
  delete from group_members where group_id = g and user_id = auth.uid();
  delete from group_reads where group_id = g and user_id = auth.uid();
  if rol = 'owner' then
    select user_id into sonraki from group_members
    where group_id = g
    order by (role = 'admin') desc, joined_at
    limit 1;
    if sonraki is null then
      delete from groups where id = g;
    else
      update group_members set role = 'owner' where group_id = g and user_id = sonraki;
    end if;
  end if;
end;
$$;

-- Yönetici: üye çıkar (sahip çıkarılamaz; yöneticiyi yalnızca sahip çıkarır)
create or replace function public.uye_cikar(g uuid, kullanici uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hedef member_role;
begin
  if not public.grup_yoneticisi_mi(g) then
    raise exception 'Yalnızca grup yöneticileri üye çıkarabilir';
  end if;
  select role into hedef from group_members where group_id = g and user_id = kullanici;
  if hedef is null then
    return;
  end if;
  if hedef = 'owner' then
    raise exception 'Grup sahibi çıkarılamaz';
  end if;
  if hedef = 'admin' and public.grup_rolu(g) <> 'owner' then
    raise exception 'Yöneticiyi yalnızca grup sahibi çıkarabilir';
  end if;
  delete from group_members where group_id = g and user_id = kullanici;
end;
$$;

-- Sahip: üyeyi yönetici yap / yöneticilikten al
create or replace function public.uye_rolu_degistir(g uuid, kullanici uuid, yonetici boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.grup_rolu(g) is distinct from 'owner' then
    raise exception 'Yalnızca grup sahibi rol değiştirebilir';
  end if;
  update group_members set role = case when yonetici then 'admin'::member_role else 'member'::member_role end
  where group_id = g and user_id = kullanici and role <> 'owner';
end;
$$;

create or replace function public.davet_kodu_yenile(g uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  kod text := yeni_davet_kodu();
begin
  if not public.grup_yoneticisi_mi(g) then
    raise exception 'Yalnızca grup yöneticileri davet kodunu yenileyebilir';
  end if;
  insert into group_invites (group_id, code) values (g, kod)
  on conflict (group_id) do update set code = excluded.code, created_at = now();
  return kod;
end;
$$;

create or replace function public.grup_uyeleri(g uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not (public.grup_uyesi_mi(g) or public.acik_grup_mu(g)) then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role, 'joined_at', m.joined_at, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url)
      order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at)
    from group_members m join profiles p on p.id = m.user_id
    where m.group_id = g
  ), '[]'::jsonb) end;
$$;

create or replace function public.okundu_isaretle(g uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into group_reads (group_id, user_id, last_read_at)
  select g, auth.uid(), now() where public.grup_uyesi_mi(g)
  on conflict (group_id, user_id) do update set last_read_at = now();
$$;

-- Kendi rotanı gruba paylaş: paylaşım kaydı + sohbete rota kartı
create or replace function public.rotayi_gruba_paylas(rota uuid, g uuid, notu text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  mesaj uuid;
begin
  if not public.rota_sahibi_mi(rota) then
    raise exception 'Yalnızca kendi rotanı paylaşabilirsin';
  end if;
  if not public.grup_uyesi_mi(g) then
    raise exception 'Bu grubun üyesi değilsin';
  end if;
  insert into route_shares (route_id, group_id) values (rota, g) on conflict do nothing;
  insert into messages (group_id, sender_id, body, attachment_type, attachment_id)
  values (g, auth.uid(), nullif(left(trim(coalesce(notu, '')), 4000), ''), 'route', rota)
  returning id into mesaj;
  return mesaj;
end;
$$;

-- Gruba paylaşılan rotalar (en yeni önce)
create or replace function public.grup_rotalari(g uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case when not public.grup_uyesi_mi(g) then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'activity', r.activity, 'distance_m', r.distance_m,
      'elevation_gain_m', r.elevation_gain_m, 'is_loop', r.is_loop,
      'owner_name', p.display_name, 'shared_at', rs.created_at,
      'preview', st_asgeojson(st_simplify(r.path::geometry, greatest(r.distance_m / 80 / 111195, 0.00001)), 5)::jsonb -> 'coordinates'
    ) order by rs.created_at desc)
    from route_shares rs
    join routes r on r.id = rs.route_id
    join profiles p on p.id = r.owner_id
    where rs.group_id = g
  ), '[]'::jsonb) end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'grup_olustur(jsonb)', 'grup_detay(uuid)', 'gruplarim()', 'kesfet_gruplar(text)', 'gruba_katil(uuid)',
    'istegi_geri_al(uuid)', 'davetle_katil(text)', 'bekleyen_istekler(uuid)', 'istegi_yanitla(uuid, uuid, boolean)',
    'gruptan_ayril(uuid)', 'uye_cikar(uuid, uuid)', 'uye_rolu_degistir(uuid, uuid, boolean)', 'davet_kodu_yenile(uuid)',
    'grup_uyeleri(uuid)', 'okundu_isaretle(uuid)', 'rotayi_gruba_paylas(uuid, uuid, text)', 'grup_rotalari(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'grup_rolu(uuid)', 'grup_uyesi_mi(uuid)', 'grup_yoneticisi_mi(uuid)', 'ortak_grup_var_mi(uuid)', 'acik_grup_mu(uuid)',
    'rota_sahibi_mi(uuid)', 'rota_bana_paylasildi_mi(uuid)'
  ] loop
    -- Kurallar içinde kullanılıyor: oturum açmış kullanıcı çağırabilmeli
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
revoke execute on function public.yeni_davet_kodu() from public, anon, authenticated;

grant select on public.groups, public.group_members, public.group_join_requests to authenticated;
grant select, insert, update on public.group_reads to authenticated;
grant select, insert, delete on public.messages, public.route_shares to authenticated;
grant update on public.groups to authenticated;
grant delete on public.groups to authenticated;

-- Canlı sohbet: messages tablosunu Supabase Realtime yayınına ekle (yayın varsa)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
