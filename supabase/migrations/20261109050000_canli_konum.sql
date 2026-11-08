-- Lykiva — 10. aşama: canlı konum
--
-- - Kullanıcı kayıt başlatırken açıkça seçtiği bir grupla son konumunu paylaşır
-- - Yalnızca son konum tutulur (kullanıcı başına tek satır); kayıt bitince satır silinir
-- - Yalnızca o grubun üyeleri görür; 15 dakikadan eski konumlar gösterilmez ve temizlenir
-- - Yazma yalnızca fonksiyonlarla

alter table public.live_locations add column if not exists distance_m double precision;
alter table public.live_locations add column if not exists started_at timestamptz;
create index if not exists live_locations_group_idx on public.live_locations (shared_with_group, updated_at desc);

-- Konum ancak grup üyesine ve tazeyse görünür
create policy "canli_konum_okuma" on public.live_locations for select to authenticated
  using (
    user_id = auth.uid()
    or (shared_with_group is not null and updated_at > now() - interval '15 minutes' and public.grup_uyesi_mi(shared_with_group))
  );

-- Konumu yayınla / güncelle
create or replace function public.canli_konum_gonder(p jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  grup uuid := nullif(p ->> 'group_id', '')::uuid;
  lng float8 := (p ->> 'lng')::float8;
  lat float8 := (p ->> 'lat')::float8;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if grup is null or not public.grup_uyesi_mi(grup) then
    raise exception 'Bu grubun üyesi değilsin';
  end if;
  if lng is null or lat is null or lng not between -180 and 180 or lat not between -90 and 90 then
    raise exception 'Konum geçersiz';
  end if;
  insert into live_locations (user_id, activity, location, speed_mps, is_paused, shared_with_group, distance_m, started_at, updated_at)
  values (
    auth.uid(),
    nullif(p ->> 'activity', '')::activity_type,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography,
    case when (p ->> 'speed_mps')::float8 >= 0 then least((p ->> 'speed_mps')::float8, 100) end,
    coalesce((p ->> 'is_paused')::boolean, false),
    grup,
    nullif(p ->> 'distance_m', '')::float8,
    nullif(p ->> 'started_at', '')::timestamptz,
    now()
  )
  on conflict (user_id) do update set
    activity = excluded.activity,
    location = excluded.location,
    speed_mps = excluded.speed_mps,
    is_paused = excluded.is_paused,
    shared_with_group = excluded.shared_with_group,
    distance_m = excluded.distance_m,
    started_at = excluded.started_at,
    updated_at = now();
end;
$$;

-- Paylaşımı bitir: satırı sil
create or replace function public.canli_konum_bitir()
returns void
language sql
security definer
set search_path = public
as $$
  delete from live_locations where user_id = auth.uid();
$$;

-- Grubun şu an paylaşan üyeleri (kendim dahil); eski satırları da temizler
create or replace function public.grup_canli_konumlari(g uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sonuc jsonb;
begin
  if not public.grup_uyesi_mi(g) then
    return '[]'::jsonb;
  end if;
  delete from live_locations where updated_at < now() - interval '1 day';
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', l.user_id,
      'display_name', p.display_name,
      'activity', l.activity,
      'lng', st_x(l.location::geometry),
      'lat', st_y(l.location::geometry),
      'speed_mps', l.speed_mps,
      'is_paused', l.is_paused,
      'distance_m', l.distance_m,
      'started_at', l.started_at,
      'updated_at', l.updated_at
    ) order by l.updated_at desc), '[]'::jsonb)
  into sonuc
  from live_locations l
  join profiles p on p.id = l.user_id
  where l.shared_with_group = g
    and l.updated_at > now() - interval '15 minutes'
    -- Paylaşan kişi gruptan ayrıldıysa gösterme
    and exists (select 1 from group_members m where m.group_id = g and m.user_id = l.user_id);
  return sonuc;
end;
$$;

-- Gruplar listesi / sohbet başlığı için: şu an yolda olan üye sayısı
create or replace function public.grup_canli_sayisi(g uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.grup_uyesi_mi(g) then 0 else (
    select count(*)::int from live_locations l
    where l.shared_with_group = g and l.updated_at > now() - interval '15 minutes'
      and exists (select 1 from group_members m where m.group_id = g and m.user_id = l.user_id)
  ) end;
$$;

-- Gruptan ayrılınca o gruba paylaşım da biter
create or replace function public.gruptan_ayrilinca_konumu_kapat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from live_locations where user_id = old.user_id and shared_with_group = old.group_id;
  return old;
end;
$$;

drop trigger if exists grup_uyeligi_bitince_konum on public.group_members;
create trigger grup_uyeligi_bitince_konum
  after delete on public.group_members
  for each row execute function public.gruptan_ayrilinca_konumu_kapat();

do $$
declare
  f text;
begin
  foreach f in array array['canli_konum_gonder(jsonb)', 'canli_konum_bitir()', 'grup_canli_konumlari(uuid)', 'grup_canli_sayisi(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
revoke execute on function public.gruptan_ayrilinca_konumu_kapat() from public, anon, authenticated;
grant select on public.live_locations to authenticated;
