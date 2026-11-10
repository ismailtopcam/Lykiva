-- Lykiva — 26. aşama: paylaşım sayfasında hava durumu, geçersiz telefon bildirim jetonlarının temizliği
--
-- - paylasilan_aktivite: kayıt başındaki hava da döner (activities.weather; konum içermez, biçimi hava_bicimi denetler)
-- - Expo Push Service her mesaj için bir "bilet" döner; uygulama silinmiş ya da bildirim izni kapatılmış telefonun
--   jetonu için "DeviceNotRegistered" hatası gelir (biletler mesajlarla aynı sırada). pg_net yanıtları
--   net._http_response tablosuna yazar (birkaç saat saklar). push_gonder her istekte hangi jetonlara gittiğini
--   push_istekleri tablosuna yazar; bir sonraki bildirimde push_yanitlarini_isle() gelen yanıtlara bakar ve
--   kayıtlı olmayan jetonları siler. Bir günden eski istek kayıtları atılır.

create table if not exists public.push_istekleri (
  istek bigint primary key,
  jetonlar text[] not null,
  created_at timestamptz not null default now()
);
alter table public.push_istekleri enable row level security;
revoke all on public.push_istekleri from anon, authenticated;

create or replace function public.push_yanitlarini_isle()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  silinen integer := 0;
  n integer;
begin
  if to_regclass('net._http_response') is null then
    return 0;
  end if;
  for r in execute
    'select i.istek, i.jetonlar, y.status_code, y.content
       from public.push_istekleri i join net._http_response y on y.id = i.istek
      order by i.istek limit 200'
  loop
    if r.status_code = 200 and r.content is not null then
      begin
        delete from push_jetonlari j
        using jsonb_array_elements(r.content::jsonb -> 'data') with ordinality as t(bilet, sira)
        where t.bilet ->> 'status' = 'error'
          and t.bilet -> 'details' ->> 'error' = 'DeviceNotRegistered'
          and j.jeton = r.jetonlar[t.sira];
        get diagnostics n = row_count;
        silinen := silinen + n;
      exception when others then
        raise warning 'push yanıtı okunamadı: %', sqlerrm;
      end;
    end if;
    delete from push_istekleri where istek = r.istek;
  end loop;
  delete from push_istekleri where created_at < now() - interval '1 day';
  return silinen;
end;
$$;

-- Önceki sürümle aynı; ek olarak isteğin jetonlarını kaydeder ve önce eski yanıtları işler
create or replace function public.push_gonder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  icerik jsonb;
  mesajlar jsonb;
  v_jetonlar text[];
  rozet integer;
  v_istek bigint;
begin
  if to_regproc('net.http_post') is null then
    return new;
  end if;
  begin
    perform public.push_yanitlarini_isle();
  exception when others then
    raise warning 'push yanıtları işlenemedi: %', sqlerrm;
  end;
  begin
    icerik := public.push_icerigi(new);
    rozet := (select count(*) from bildirimler where alici = new.alici and not okundu);
    select
      jsonb_agg(jsonb_build_object(
        'to', j.jeton, 'title', icerik ->> 'title', 'body', icerik ->> 'body', 'data', icerik -> 'data',
        'sound', 'default', 'badge', rozet, 'channelId', 'varsayilan'
      ) order by j.updated_at desc, j.jeton),
      array_agg(j.jeton order by j.updated_at desc, j.jeton)
    into mesajlar, v_jetonlar
    from (select jeton, updated_at from push_jetonlari where user_id = new.alici order by updated_at desc limit 10) j;
    if mesajlar is not null then
      execute 'select net.http_post(url => $1, body => $2, headers => $3)'
        into v_istek
        using 'https://exp.host/--/api/v2/push/send', mesajlar, '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
      if v_istek is not null then
        insert into push_istekleri (istek, jetonlar) values (v_istek, v_jetonlar) on conflict (istek) do nothing;
      end if;
    end if;
  exception when others then
    raise warning 'push gönderilemedi: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.push_yanitlarini_isle() from public, anon, authenticated;
revoke execute on function public.push_gonder() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Paylaşım sayfası: hava da döner (gerisi 20261110020000 ile aynı)
-- ---------------------------------------------------------------------------
create or replace function public.paylasilan_aktivite(anahtar text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with a as (
    select ac.*
    from aktivite_baglantilari b
    join activities ac on ac.id = b.activity_id
    where b.anahtar = paylasilan_aktivite.anahtar
  ),
  iz as (
    -- Kimin çağırdığına bakmadan kırp (sahibi kendi oturumuyla çağırsa bile sayfa herkese açık)
    select case
      when a.track is null then null
      when not a.hide_endpoints then a.track::geometry
      when st_length(a.track) < 1000 then null
      else st_linesubstring(a.track::geometry, 200 / st_length(a.track), 1 - 200 / st_length(a.track))
    end as g
    from a
  ),
  noktalar as (
    select
      p.seq,
      p.elevation_m,
      coalesce(sum(st_distance(p.location, p.onceki)) over (order by p.seq), 0) as d
    from (
      select pt.*, lag(pt.location) over (order by pt.seq) as onceki
      from activity_points pt, a
      where pt.activity_id = a.id
    ) p
  ),
  profil as (
    -- Yükseklik profili: en fazla ~120 nokta [mesafe m, yükseklik m]; konum içermez
    select coalesce(jsonb_agg(jsonb_build_array(round(d::numeric), round(elevation_m::numeric, 1)) order by seq), '[]'::jsonb) as j
    from (
      select seq, d, elevation_m, row_number() over (order by seq) as sira, count(*) over () as toplam
      from noktalar
      where elevation_m is not null
    ) x
    where (sira - 1) % greatest(1, ceil(toplam / 120.0)::int) = 0 or sira = toplam
  )
  select jsonb_build_object(
    'title', a.title,
    'activity', a.activity,
    'started_at', a.started_at,
    'moving_time_s', a.moving_time_s,
    'elapsed_time_s', a.elapsed_time_s,
    'distance_m', a.distance_m,
    'elevation_gain_m', a.elevation_gain_m,
    'elevation_loss_m', a.elevation_loss_m,
    'max_elevation_m', a.max_elevation_m,
    'avg_speed_mps', a.avg_speed_mps,
    'max_speed_mps', a.max_speed_mps,
    'owner_name', pr.display_name,
    'endpoints_hidden', a.hide_endpoints,
    'weather', a.weather,
    'track', (select st_asgeojson(st_simplify(st_force2d(iz.g), 0.00005), 5)::jsonb -> 'coordinates' from iz where iz.g is not null),
    'elevation', (select j from profil),
    'stop_count', (select count(*) from activity_stops s where s.activity_id = a.id),
    'like_count', (select count(*) from activity_likes l where l.activity_id = a.id),
    'comment_count', (select count(*) from activity_comments c where c.activity_id = a.id)
  )
  from a
  join profiles pr on pr.id = a.owner_id;
$$;

revoke execute on function public.paylasilan_aktivite(text) from public;
grant execute on function public.paylasilan_aktivite(text) to anon, authenticated;
