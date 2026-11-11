-- Lykiva — 34. aşama: ısı haritaları (küresel, haftalık, gece, kişisel)
--
-- isi_haritasi(tur, bati, guney, dogu, kuzey, zoom): haritada görünen alan için aktivite izlerini ızgara
--   hücrelerine toplar; her hücre [boylam, enlem, aktivite sayısı]. Uygulama bunu MapLibre ısı katmanıyla çizer.
--   - kuresel: herkese açık bütün aktiviteler
--   - haftalik: son 7 günün herkese açık aktiviteleri
--   - gece: güneş ufkun 6° altındayken (sivil alacakaranlık sonrası) başlayan ya da biten herkese açık aktiviteler
--   - kisisel: kendi bütün aktivitelerin (gizliler dahil)
-- Gizlilik (kişisel dışında): yalnızca herkese açık aktiviteler; "uçları gizle" açıksa baştan ve sondan 200 m kırpılır
--   (gosterilecek_iz ile aynı kural); ısı haritasından çıkmış (profiles.isi_haritasinda = false) ve engellenmiş
--   kullanıcılar sayılmaz. Hücre değeri farklı aktivite sayısıdır (yavaş giden ya da duran kişi daha "sıcak" görünmez).
-- Kişisel dışındakiler 8. yakınlaştırma düzeyinden önce boş döner (bütün ülkeyi tek seferde toplamamak için).
-- Hesap her istekte yapılır; aktivite sayısı artınca önceden hesaplanmış hücre tablosuna geçilmeli (DEV_NOTES).

alter table public.profiles add column if not exists isi_haritasinda boolean not null default true;

-- Güneşin ufuktan yüksekliği (derece), yaklaşık: deklinasyon + saat açısı (zaman denklemi yok, birkaç dakikalık hata)
create or replace function public.gunes_yuksekligi(t timestamptz, lng float8, lat float8)
returns float8
language sql
immutable
set search_path = public
as $$
  with g as (
    select
      radians(23.44) * sin(radians(360.0 / 365 * (284 + extract(doy from t at time zone 'UTC')))) as dek,
      -- yerel güneş saati: UTC saati + boylam / 15
      radians(15 * (mod((extract(epoch from t) / 3600 + lng / 15)::numeric, 24)::float8 - 12)) as saat_acisi,
      radians(lat) as enl
  )
  select degrees(asin(sin(enl) * sin(dek) + cos(enl) * cos(dek) * cos(saat_acisi))) from g;
$$;

create or replace function public.gece_aktivitesi_mi(a public.activities)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select a.track is not null and (
    public.gunes_yuksekligi(a.started_at, st_x(st_startpoint(a.track::geometry)), st_y(st_startpoint(a.track::geometry))) < -6
    or public.gunes_yuksekligi(a.ended_at, st_x(st_endpoint(a.track::geometry)), st_y(st_endpoint(a.track::geometry))) < -6
  );
$$;

create or replace function public.isi_haritasi(tur text, bati float8, guney float8, dogu float8, kuzey float8, zoom integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  ben uuid := auth.uid();
  hucre float8;   -- hücre boyu, derece (ekranda ~6 piksel)
  adim_m float8;  -- izin sıklaştırma aralığı, metre
  kutu geometry;
  sonuc jsonb;
begin
  if ben is null then
    raise exception 'Giriş gerekli' using errcode = 'P0001';
  end if;
  if tur is null or tur not in ('kuresel', 'haftalik', 'gece', 'kisisel') then
    raise exception 'Bilinmeyen ısı haritası türü' using errcode = 'P0001';
  end if;
  if bati is null or guney is null or dogu is null or kuzey is null or zoom is null
     or bati >= dogu or guney >= kuzey or guney < -85 or kuzey > 85 or bati < -180 or dogu > 180 then
    return '[]'::jsonb;
  end if;
  zoom := least(greatest(zoom, 0), 18);
  if tur <> 'kisisel' and zoom < 8 then
    return '[]'::jsonb;
  end if;

  hucre := 360.0 / (256 * power(2, zoom)) * 6;
  adim_m := greatest(hucre * 111320 * cos(radians((guney + kuzey) / 2)) / 2, 3);
  kutu := st_makeenvelope(bati, guney, dogu, kuzey, 4326);

  with secilen as (
    select a.id,
      case
        when tur = 'kisisel' or not a.hide_endpoints then a.track::geometry
        when st_length(a.track) < 1000 then null
        else st_linesubstring(a.track::geometry, 200 / st_length(a.track), 1 - 200 / st_length(a.track))
      end as g
    from activities a
    where a.track is not null
      and a.track && kutu::geography
      and case
        when tur = 'kisisel' then a.owner_id = ben
        else a.visibility = 'public'
          and (tur <> 'haftalik' or a.started_at > now() - interval '7 days')
          and (tur <> 'gece' or public.gece_aktivitesi_mi(a))
          and exists (select 1 from profiles p where p.id = a.owner_id and p.isi_haritasinda)
          and not exists (select 1 from auth.users u where u.id = a.owner_id and u.banned_until > now())
      end
  ),
  kirpilan as (
    select s.id, st_intersection(st_force2d(s.g), kutu) as g
    from secilen s
    where s.g is not null
  ),
  noktalar as (
    select k.id, (st_dumppoints(st_segmentize(k.g::geography, adim_m)::geometry)).geom as n
    from kirpilan k
    where not st_isempty(k.g)
  ),
  hucreler as (
    select floor(st_x(n) / hucre) as hx, floor(st_y(n) / hucre) as hy, count(distinct id) as c
    from noktalar
    group by 1, 2
    order by 3 desc
    limit 5000
  )
  select coalesce(jsonb_agg(jsonb_build_array(
    round(((hx + 0.5) * hucre)::numeric, 6), round(((hy + 0.5) * hucre)::numeric, 6), c
  )), '[]'::jsonb)
  into sonuc
  from hucreler;

  return sonuc;
end;
$$;

-- Küresel / haftalık / gece ısı haritalarında görünmek (varsayılan açık)
create or replace function public.isi_haritasi_ayarla(katil boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or katil is null then
    raise exception 'Geçersiz istek' using errcode = 'P0001';
  end if;
  update profiles set isi_haritasinda = katil where id = auth.uid() and isi_haritasinda is distinct from katil;
end;
$$;

revoke execute on function public.isi_haritasi(text, float8, float8, float8, float8, integer) from public, anon;
grant execute on function public.isi_haritasi(text, float8, float8, float8, float8, integer) to authenticated;
revoke execute on function public.isi_haritasi_ayarla(boolean) from public, anon;
grant execute on function public.isi_haritasi_ayarla(boolean) to authenticated;
revoke execute on function public.gece_aktivitesi_mi(public.activities) from public, anon;
revoke execute on function public.gunes_yuksekligi(timestamptz, float8, float8) from public, anon;
