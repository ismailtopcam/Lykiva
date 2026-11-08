-- Lykiva — 9. aşama: etkinlikler
--
-- - Etkinlik bir gruba bağlıdır (grup üyeleri görür; istenirse herkese açık) ya da grupsuz ve herkese açıktır
-- - Katılım: going / maybe / declined; kontenjan doluysa "going" isteyen bekleme listesine (waitlist) girer,
--   katılımcı vazgeçince listedeki ilk kişi otomatik katılımcı olur
-- - Grup etkinliği oluşturulunca grubun sohbetine etkinlik kartı düşer; silinince sohbete not düşer
-- - Etkinliğe bağlanan kendi özel rotan grup etkinliğinde gruba paylaşılır (üyeler rotayı görebilsin)
-- - Yazma işlemleri yalnızca fonksiyonlarla (doğrudan ekleme/güncelleme kuralı yok)

alter type rsvp_status add value if not exists 'waitlist';

alter table public.events add constraint etkinlik_adi_uzunlugu check (char_length(trim(title)) between 2 and 80) not valid;
create index if not exists events_group_starts_idx on public.events (group_id, starts_at);
create index if not exists event_attendees_user_idx on public.event_attendees (user_id);

-- ---------------------------------------------------------------------------
-- Görünürlük
-- ---------------------------------------------------------------------------
create or replace function public.etkinligi_gorebilir_mi(e uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from events ev
    where ev.id = e
      and (ev.created_by = auth.uid() or ev.visibility = 'public' or (ev.group_id is not null and public.grup_uyesi_mi(ev.group_id)))
  );
$$;

create or replace function public.etkinligi_yonetebilir_mi(e uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from events ev
    where ev.id = e
      and (ev.created_by = auth.uid() or (ev.group_id is not null and public.grup_yoneticisi_mi(ev.group_id)))
  );
$$;

create policy "etkinlik_okuma" on public.events for select to authenticated
  using (created_by = auth.uid() or visibility = 'public' or (group_id is not null and public.grup_uyesi_mi(group_id)));
create policy "etkinlik_silme" on public.events for delete to authenticated
  using (created_by = auth.uid() or (group_id is not null and public.grup_yoneticisi_mi(group_id)));
create policy "katilimci_okuma" on public.event_attendees for select to authenticated
  using (public.etkinligi_gorebilir_mi(event_id));

-- ---------------------------------------------------------------------------
-- Ortak: etkinlik özeti (liste ve kartlar için)
-- ---------------------------------------------------------------------------
create or replace function public.etkinlik_ozeti(ev public.events)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', ev.id,
    'title', ev.title,
    'activity', ev.activity,
    'starts_at', ev.starts_at,
    'group_id', ev.group_id,
    'group_name', (select name from groups g where g.id = ev.group_id),
    'meeting_point_name', ev.meeting_point_name,
    'capacity', ev.capacity,
    'difficulty', ev.difficulty,
    'visibility', ev.visibility,
    'going_count', (select count(*) from event_attendees a where a.event_id = ev.id and a.status::text = 'going'),
    'my_status', (select a.status::text from event_attendees a where a.event_id = ev.id and a.user_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Oluştur
-- ---------------------------------------------------------------------------
create or replace function public.etkinlik_olustur(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  yeni uuid;
  baslik text := trim(coalesce(p ->> 'title', ''));
  grup uuid := nullif(p ->> 'group_id', '')::uuid;
  rota uuid := nullif(p ->> 'route_id', '')::uuid;
  baslangic timestamptz := (p ->> 'starts_at')::timestamptz;
  gorunurluk visibility;
  kontenjan int := nullif(p ->> 'capacity', '')::int;
  lng float8 := nullif(p ->> 'meeting_lng', '')::float8;
  lat float8 := nullif(p ->> 'meeting_lat', '')::float8;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if char_length(baslik) < 2 or char_length(baslik) > 80 then
    raise exception 'Etkinlik adı 2–80 karakter olmalı';
  end if;
  if baslangic is null or baslangic < now() then
    raise exception 'Etkinlik zamanı gelecekte olmalı';
  end if;
  if baslangic > now() + interval '1 year' then
    raise exception 'Etkinlik en fazla bir yıl sonrası için planlanabilir';
  end if;
  if kontenjan is not null and (kontenjan < 2 or kontenjan > 999) then
    raise exception 'Kontenjan 2–999 arası olmalı';
  end if;
  if (lng is null) <> (lat is null) or (lng is not null and (lng not between -180 and 180 or lat not between -90 and 90)) then
    raise exception 'Buluşma noktası geçersiz';
  end if;

  if grup is not null then
    if not public.grup_uyesi_mi(grup) then
      raise exception 'Bu grubun üyesi değilsin';
    end if;
    gorunurluk := case when p ->> 'visibility' = 'public' then 'public'::visibility else 'groups'::visibility end;
  else
    gorunurluk := 'public';
  end if;

  if rota is not null and not exists (
    select 1 from routes r
    where r.id = rota
      and (r.owner_id = auth.uid() or r.visibility = 'public' or public.rota_bana_paylasildi_mi(r.id))
  ) then
    raise exception 'Rota bulunamadı ya da görme iznin yok';
  end if;

  insert into events (group_id, created_by, title, description, activity, starts_at, meeting_point, meeting_point_name, route_id, difficulty, capacity, visibility)
  values (
    grup,
    auth.uid(),
    baslik,
    nullif(left(trim(coalesce(p ->> 'description', '')), 1000), ''),
    coalesce(nullif(p ->> 'activity', ''), 'bike')::activity_type,
    baslangic,
    case when lng is null then null else st_setsrid(st_makepoint(lng, lat), 4326)::geography end,
    nullif(left(trim(coalesce(p ->> 'meeting_point_name', '')), 120), ''),
    rota,
    nullif(p ->> 'difficulty', '')::difficulty,
    kontenjan,
    gorunurluk
  )
  returning id into yeni;

  insert into event_attendees (event_id, user_id, status) values (yeni, auth.uid(), 'going');

  if grup is not null then
    -- Kendi rotanı grup etkinliğine bağladıysan üyeler görebilsin
    if rota is not null and public.rota_sahibi_mi(rota) then
      insert into route_shares (route_id, group_id) values (rota, grup) on conflict do nothing;
    end if;
    insert into messages (group_id, sender_id, attachment_type, attachment_id) values (grup, auth.uid(), 'event', yeni);
  end if;

  return yeni;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ayrıntı
-- ---------------------------------------------------------------------------
create or replace function public.etkinlik_detay(e uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case when not public.etkinligi_gorebilir_mi(ev.id) then null else
    public.etkinlik_ozeti(ev) || jsonb_build_object(
      'description', ev.description,
      'created_by', ev.created_by,
      'creator_name', (select display_name from profiles p where p.id = ev.created_by),
      'meeting_lng', st_x(ev.meeting_point::geometry),
      'meeting_lat', st_y(ev.meeting_point::geometry),
      'maybe_count', (select count(*) from event_attendees a where a.event_id = ev.id and a.status::text = 'maybe'),
      'waitlist_count', (select count(*) from event_attendees a where a.event_id = ev.id and a.status::text = 'waitlist'),
      'can_manage', public.etkinligi_yonetebilir_mi(ev.id),
      'is_member', ev.group_id is null or public.grup_uyesi_mi(ev.group_id),
      'attendees', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'status', a.status::text, 'display_name', p.display_name)
          order by case a.status::text when 'going' then 0 when 'waitlist' then 1 when 'maybe' then 2 else 3 end, a.updated_at)
        from event_attendees a join profiles p on p.id = a.user_id
        where a.event_id = ev.id and a.status::text <> 'declined'
      ), '[]'::jsonb),
      'route', (
        select jsonb_build_object(
          'id', r.id, 'name', r.name, 'distance_m', r.distance_m, 'elevation_gain_m', r.elevation_gain_m, 'is_loop', r.is_loop,
          'coordinates', st_asgeojson(st_simplify(r.path::geometry, greatest(r.distance_m / 200 / 111195, 0.000005)), 6)::jsonb -> 'coordinates'
        )
        from routes r where r.id = ev.route_id
      )
    )
  end
  from events ev
  where ev.id = e;
$$;

-- ---------------------------------------------------------------------------
-- Katılım
-- ---------------------------------------------------------------------------
-- Döner: kaydedilen durum ('going' | 'waitlist' | 'maybe' | 'declined')
create or replace function public.katilim_bildir(e uuid, durum text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ev events;
  onceki text;
  sonuc text := durum;
  dolu int;
  siradaki uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if durum not in ('going', 'maybe', 'declined') then
    raise exception 'Geçersiz katılım durumu';
  end if;
  -- Aynı anda gelen katılımlar kontenjanı aşmasın
  select * into ev from events where id = e for update;
  if ev.id is null or not public.etkinligi_gorebilir_mi(e) then
    raise exception 'Etkinlik bulunamadı';
  end if;
  if ev.group_id is not null and ev.visibility <> 'public' and not public.grup_uyesi_mi(ev.group_id) then
    raise exception 'Bu etkinlik grup üyelerine açık';
  end if;
  if ev.starts_at < now() - interval '12 hours' then
    raise exception 'Etkinlik sona erdi';
  end if;

  select status::text into onceki from event_attendees where event_id = e and user_id = auth.uid();

  if durum = 'going' and coalesce(onceki, '') <> 'going' and ev.capacity is not null then
    select count(*) into dolu from event_attendees where event_id = e and status::text = 'going';
    if dolu >= ev.capacity then
      sonuc := 'waitlist';
    end if;
  end if;
  if durum = 'going' and onceki = 'waitlist' and sonuc = 'waitlist' then
    return 'waitlist'; -- sırasını kaybetmesin
  end if;

  insert into event_attendees (event_id, user_id, status, updated_at)
  values (e, auth.uid(), sonuc::rsvp_status, now())
  on conflict (event_id, user_id) do update set status = excluded.status, updated_at = now();

  -- Bir yer boşaldıysa bekleme listesindeki ilk kişi katılımcı olur
  if onceki = 'going' and sonuc <> 'going' then
    select user_id into siradaki from event_attendees
    where event_id = e and status::text = 'waitlist'
    order by updated_at
    limit 1;
    if siradaki is not null then
      update event_attendees set status = 'going'::rsvp_status, updated_at = now() where event_id = e and user_id = siradaki;
    end if;
  end if;

  return sonuc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Listeler
-- ---------------------------------------------------------------------------
-- Grubun etkinlikleri: yaklaşanlar (yakın olan önce), sonra son 30 günün geçmişleri
create or replace function public.grup_etkinlikleri(g uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.grup_uyesi_mi(g) then '[]'::jsonb else coalesce((
    select jsonb_agg(public.etkinlik_ozeti(ev) order by (ev.starts_at < now() - interval '3 hours'), case when ev.starts_at >= now() - interval '3 hours' then ev.starts_at end, ev.starts_at desc)
    from events ev
    where ev.group_id = g and ev.starts_at > now() - interval '30 days'
  ), '[]'::jsonb) end;
$$;

-- Bana yakın gelecekteki etkinlikler: gruplarımın etkinlikleri + katıldıklarım + oluşturduklarım
create or replace function public.yaklasan_etkinlikler()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.etkinlik_ozeti(ev) order by ev.starts_at), '[]'::jsonb)
  from (
    select ev.* from events ev
    where ev.starts_at > now() - interval '3 hours'
      and (
        ev.created_by = auth.uid()
        or (ev.group_id is not null and public.grup_uyesi_mi(ev.group_id))
        or exists (select 1 from event_attendees a where a.event_id = ev.id and a.user_id = auth.uid() and a.status::text <> 'declined')
      )
    order by ev.starts_at
    limit 20
  ) ev;
$$;

-- ---------------------------------------------------------------------------
-- Sil (iptal)
-- ---------------------------------------------------------------------------
create or replace function public.etkinlik_sil(e uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev events;
begin
  select * into ev from events where id = e;
  if ev.id is null then
    return;
  end if;
  if not public.etkinligi_yonetebilir_mi(e) then
    raise exception 'Etkinliği yalnızca oluşturan ya da grup yöneticisi iptal edebilir';
  end if;
  delete from events where id = e;
  -- Sohbetteki etkinlik kartı boşa düşmesin; yerine not bırak
  delete from messages where attachment_type = 'event' and attachment_id = e;
  if ev.group_id is not null and ev.starts_at > now() then
    insert into messages (group_id, sender_id, body)
    values (ev.group_id, auth.uid(), format('"%s" etkinliği iptal edildi.', ev.title));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'etkinligi_gorebilir_mi(uuid)', 'etkinligi_yonetebilir_mi(uuid)', 'etkinlik_olustur(jsonb)', 'etkinlik_detay(uuid)',
    'katilim_bildir(uuid, text)', 'grup_etkinlikleri(uuid)', 'yaklasan_etkinlikler()', 'etkinlik_sil(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
revoke execute on function public.etkinlik_ozeti(public.events) from public, anon, authenticated;

grant select, delete on public.events to authenticated;
grant select on public.event_attendees to authenticated;
