-- Lykiva — 16. aşama: Keşfet sekmesi gerçek veriden
--
-- - kesfet_rotalar(arama, lng, lat): herkese açık rotalar (kendi rotaların hariç); konum verilirse
--   yakından uzağa, yoksa en yeniden; küçük önizleme izi ve sana uzaklık
-- - kesfet_etkinlikler(arama, lng, lat): önümüzdeki 30 gündeki etkinlikler; herkese açık olanlar ve
--   üyesi olduğun grupların etkinlikleri; konum verilirse buluşma noktası yakın olandan, yoksa tarihe göre
-- - Topluluklar (kesfet_gruplar) ve kişi arama (kisi_ara) önceki aşamalardan

create index if not exists routes_public_created_idx on public.routes (created_at desc) where visibility = 'public';
create index if not exists events_starts_idx on public.events (starts_at);
create index if not exists events_meeting_gix on public.events using gist (meeting_point);

create or replace function public.kesfet_rotalar(arama text default null, lng float8 default null, lat float8 default null)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with n as (
    select case
      when lng between -180 and 180 and lat between -90 and 90 then st_setsrid(st_makepoint(lng, lat), 4326)::geography
    end as nokta,
    nullif(lower(trim(coalesce(arama, ''))), '') as metin
  )
  select coalesce(jsonb_agg(x.j order by x.sira), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'activity', r.activity,
        'distance_m', r.distance_m,
        'elevation_gain_m', r.elevation_gain_m,
        'difficulty', r.difficulty,
        'is_loop', r.is_loop,
        'owner_id', r.owner_id,
        'owner_name', p.display_name,
        'created_at', r.created_at,
        'uzaklik_m', case when n.nokta is not null then round(st_distance(r.path, n.nokta)::numeric) end,
        'preview', st_asgeojson(st_simplify(st_force2d(r.path::geometry), 0.0005), 5)::jsonb -> 'coordinates'
      ) as j,
      row_number() over (order by case when n.nokta is not null then st_distance(r.path, n.nokta) end nulls last, r.created_at desc) as sira
    from routes r
    join profiles p on p.id = r.owner_id
    cross join n
    where auth.uid() is not null
      and r.visibility = 'public'
      and r.owner_id <> auth.uid()
      and (n.metin is null or strpos(lower(r.name), n.metin) > 0)
    order by sira
    limit 30
  ) x;
$$;

create or replace function public.kesfet_etkinlikler(arama text default null, lng float8 default null, lat float8 default null)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with n as (
    select case
      when lng between -180 and 180 and lat between -90 and 90 then st_setsrid(st_makepoint(lng, lat), 4326)::geography
    end as nokta,
    nullif(lower(trim(coalesce(arama, ''))), '') as metin
  )
  select coalesce(jsonb_agg(x.j order by x.sira), '[]'::jsonb)
  from (
    select
      public.etkinlik_ozeti(ev) || jsonb_build_object(
        'uzaklik_m', case when n.nokta is not null and ev.meeting_point is not null then round(st_distance(ev.meeting_point, n.nokta)::numeric) end
      ) as j,
      row_number() over (
        order by case when n.nokta is not null and ev.meeting_point is not null then st_distance(ev.meeting_point, n.nokta) end nulls last, ev.starts_at
      ) as sira
    from events ev
    cross join n
    where auth.uid() is not null
      and ev.starts_at > now() - interval '3 hours'
      and ev.starts_at < now() + interval '30 days'
      and (ev.visibility = 'public' or ev.created_by = auth.uid() or (ev.group_id is not null and public.grup_uyesi_mi(ev.group_id)))
      and (n.metin is null or strpos(lower(ev.title), n.metin) > 0 or strpos(lower(coalesce(ev.meeting_point_name, '')), n.metin) > 0)
    order by sira
    limit 30
  ) x;
$$;

revoke execute on function public.kesfet_rotalar(text, float8, float8) from public, anon;
revoke execute on function public.kesfet_etkinlikler(text, float8, float8) from public, anon;
grant execute on function public.kesfet_rotalar(text, float8, float8) to authenticated;
grant execute on function public.kesfet_etkinlikler(text, float8, float8) to authenticated;
