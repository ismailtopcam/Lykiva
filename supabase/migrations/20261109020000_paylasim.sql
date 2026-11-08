-- Lykiva — 6. aşama: paylaşım
-- GPX dışa aktarımı için ham noktalar. Çağıranın yetkisiyle çalışır: nokta okuma kuralı gereği
-- yalnızca aktivitenin sahibi sonuç alır, başkası boş liste görür.
create or replace function public.aktivite_noktalari(aktivite uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    't', (extract(epoch from p.recorded_at) * 1000)::bigint,
    'lat', round(st_y(p.location::geometry)::numeric, 6),
    'lng', round(st_x(p.location::geometry)::numeric, 6),
    'alt', p.elevation_m
  ) order by p.seq), '[]'::jsonb)
  from activity_points p
  where p.activity_id = aktivite;
$$;

grant execute on function public.aktivite_noktalari(uuid) to authenticated;
revoke execute on function public.aktivite_noktalari(uuid) from public, anon;
