-- Lykiva — 20. aşama: hava durumu
--
-- - activities.weather: kayıt başlarken telefonun aldığı hava bilgisi (MET Norway; biçim packages/shared/src/hava.ts > HavaDurumu)
--   Sahibi yazar (aktiviteyi kaydettikten sonra güncelleme; kural 20261108000000'de), herkes aktiviteyi görebildiği kadar görür
-- - aktivite_ozetleri görünümüne ve akis() kartlarına eklendi
-- - Konum içermez (yalnızca sıcaklık, rüzgâr, nem, yağış, UV, gökyüzü)

alter table public.activities add column if not exists weather jsonb;
alter table public.activities drop constraint if exists hava_bicimi;
alter table public.activities add constraint hava_bicimi check (
  weather is null or (
    jsonb_typeof(weather) = 'object'
    and pg_column_size(weather) < 2048
    and jsonb_typeof(weather -> 'sicaklik') = 'number'
    and jsonb_typeof(weather -> 'ruzgar') = 'number'
    and not (weather ? 'lat') and not (weather ? 'lng')
  )
) not valid;

-- Görünüm: sona weather eklendi (create or replace yalnızca sona sütun eklemeye izin verir)
create or replace view public.aktivite_ozetleri
with (security_invoker = true)
as
select
  a.id, a.owner_id, a.title, a.activity, a.started_at, a.ended_at, a.moving_time_s, a.elapsed_time_s,
  a.distance_m, a.elevation_gain_m, a.elevation_loss_m, a.max_elevation_m,
  a.avg_speed_mps, a.max_speed_mps, a.min_moving_speed_mps, a.visibility, a.hide_endpoints, a.created_at,
  public.gosterilecek_iz(a) as track_geojson,
  pr.display_name as owner_name,
  pr.username as owner_username,
  a.weather
from public.activities a
join public.profiles pr on pr.id = a.owner_id;

grant select on public.aktivite_ozetleri to authenticated;

-- ---------------------------------------------------------------------------
-- Akış kartında hava (20261110040000'deki fonksiyonun yerine geçer)
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
      'tagged_me', exists (select 1 from activity_participants ap where ap.activity_id = a.id and ap.user_id = ben),
      'weather', a.weather
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

revoke execute on function public.akis(text, timestamptz, uuid, float8, float8, integer) from public, anon;
grant execute on function public.akis(text, timestamptz, uuid, float8, float8, integer) to authenticated;
