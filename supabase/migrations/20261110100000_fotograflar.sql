-- Lykiva — 24. aşama: profil fotoğrafı ve mola fotoğrafları (Supabase Storage)
--
-- Kovalar:
--   profil  herkese açık (adres bilen görür). Yol: <kullanıcı id>/<uuid>.jpg — yalnızca kendi klasörüne yazar / siler.
--   mola    gizli. Yol: <aktivite id>/<uuid>.jpg — aktiviteyi görebilen okur (imzalı adresle), yalnızca sahibi yükler / siler.
-- activity_stops.photo_urls: kovadaki yollar (ör. "3f…/9a….jpg"); en fazla 6, yalnızca o aktivitenin klasöründen.
-- aktivite_detay: molaların kimliği ve fotoğraf yolları da döner.
--
-- Not: storage şeması Supabase'in depolama servisi tarafından kurulur; bu dosya yalnızca kova ve kural ekler.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profil', 'profil', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('mola', 'mola', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Yolun ilk klasörü uuid ise onu döner (bozuk yolda hata yerine null)
create or replace function public.yol_kimligi(yol text)
returns uuid
language sql
immutable
as $$
  select case when split_part(yol, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(yol, '/', 1)::uuid end;
$$;

-- Dosya adı biçimi: <klasör uuid>/<uuid>.<jpg|png|webp>, başka alt klasör yok
create or replace function public.foto_yolu_gecerli(yol text)
returns boolean
language sql
immutable
as $$
  select yol ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$';
$$;

drop policy if exists "profil_foto_yukleme" on storage.objects;
create policy "profil_foto_yukleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'profil' and public.foto_yolu_gecerli(name) and public.yol_kimligi(name) = auth.uid());
drop policy if exists "profil_foto_silme" on storage.objects;
create policy "profil_foto_silme" on storage.objects for delete to authenticated
  using (bucket_id = 'profil' and public.yol_kimligi(name) = auth.uid());
-- Silme ve listeleme için sahibi kendi dosyalarını görür (herkese açık adres bu kurala bağlı değildir)
drop policy if exists "profil_foto_okuma" on storage.objects;
create policy "profil_foto_okuma" on storage.objects for select to authenticated
  using (bucket_id = 'profil' and public.yol_kimligi(name) = auth.uid());

drop policy if exists "mola_foto_okuma" on storage.objects;
create policy "mola_foto_okuma" on storage.objects for select to authenticated
  using (bucket_id = 'mola' and public.aktiviteyi_gorebilir_mi(public.yol_kimligi(name)));
drop policy if exists "mola_foto_yukleme" on storage.objects;
create policy "mola_foto_yukleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'mola' and public.foto_yolu_gecerli(name) and public.aktivite_sahibi_mi(public.yol_kimligi(name)));
drop policy if exists "mola_foto_silme" on storage.objects;
create policy "mola_foto_silme" on storage.objects for delete to authenticated
  using (bucket_id = 'mola' and public.aktivite_sahibi_mi(public.yol_kimligi(name)));

-- Profil fotoğrafı adresi yalnızca https (kendi kovamız ya da Google/Apple fotoğrafı); başka şema kabul edilmez
alter table public.profiles drop constraint if exists profil_foto_adresi;
alter table public.profiles add constraint profil_foto_adresi check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)) not valid;

-- Mola fotoğrafları: en fazla 6, hepsi bu aktivitenin klasöründe
create or replace function public.mola_fotolari_gecerli(aktivite uuid, yollar text[])
returns boolean
language sql
immutable
as $$
  select coalesce(array_length(yollar, 1), 0) <= 6
    and not exists (select 1 from unnest(yollar) y where not public.foto_yolu_gecerli(y) or public.yol_kimligi(y) <> aktivite);
$$;

alter table public.activity_stops drop constraint if exists mola_fotolari;
alter table public.activity_stops add constraint mola_fotolari check (public.mola_fotolari_gecerli(activity_id, photo_urls)) not valid;
alter table public.activity_stops drop constraint if exists mola_notu_uzunlugu;
alter table public.activity_stops add constraint mola_notu_uzunlugu check (note is null or char_length(note) <= 280) not valid;

-- Molaların kimliği ve fotoğrafları da döner (gerisi 20261108000000 ile aynı)
create or replace function public.aktivite_detay(aktivite uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case when not public.aktiviteyi_gorebilir_mi(aktivite) then null else jsonb_build_object(
    'stops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'started_at', s.started_at, 'ended_at', s.ended_at, 'distance_at_m', s.distance_at_m,
        'lng', st_x(s.location::geometry), 'lat', st_y(s.location::geometry), 'note', s.note, 'photos', to_jsonb(s.photo_urls)
      ) order by s.started_at)
      from activity_stops s where s.activity_id = aktivite
    ), '[]'::jsonb),
    'profile', coalesce((
      select jsonb_agg(jsonb_build_object('t', q.t, 'd', round(q.d::numeric, 1), 'alt', q.alt, 'speed', q.speed) order by q.seq)
      from (
        select
          p.seq,
          extract(epoch from p.recorded_at) * 1000 as t,
          coalesce(sum(st_distance(p.location, p.onceki)) over (order by p.seq), 0) as d,
          p.elevation_m as alt,
          p.speed_mps as speed
        from (
          select *, lag(location) over (order by seq) as onceki
          from activity_points where activity_id = aktivite
        ) p
      ) q
    ), '[]'::jsonb)
  ) end;
$$;

revoke execute on function public.aktivite_detay(uuid) from public, anon;
grant execute on function public.aktivite_detay(uuid) to authenticated;
