-- Lykiva — telefon bildirimi makbuzları: ölü jetonların temizliği
--
-- Expo Push Service bir mesajı önce "bilet" ile kabul eder (status ok + bilet kimliği); telefona gerçekten ulaşıp
-- ulaşmadığı ancak sonra, "makbuz"da belli olur (https://exp.host/--/api/v2/push/getReceipts). Uygulama silinmiş ya da
-- yeniden kurulmuş telefonun jetonu için "DeviceNotRegistered" çoğunlukla biletde değil makbuzda gelir. 26. aşamadaki
-- temizlik (push_yanitlarini_isle) yalnızca biletlere bakıyordu; bu yüzden ölü jetonlar silinmiyor, bildirimler eski
-- kurulumlara gidip kayboluyordu (15 Kas 2026'da sunucudaki son iki bildirim böyle: FCM "not registered").
--
-- - push_yanitlarini_isle: biletde hata yoksa bilet kimliğini jetonuyla push_biletleri'ne yazar
-- - push_makbuzlari(): önce bilet yanıtlarını işler; gelen makbuz yanıtlarında "DeviceNotRegistered" dönen jetonları
--   siler; 15 dakikadan eski, henüz sorulmamış biletlerin makbuzlarını (en fazla 1000) tek istekle ister.
--   Expo makbuzları 24 saat tutar; bir günden eski bilet ve istek kayıtları atılır.
-- - pg_cron varsa push_makbuzlari() 15 dakikada bir çalışır (Supabase imajında yüklü, eklenti burada açılır).
--   pg_cron yoksa makbuzlar okunmaz, gerisi eskisi gibi çalışır.
-- - Tablolar ve fonksiyonlar istemciye kapalı.

create table if not exists public.push_biletleri (
  bilet text primary key,
  jeton text not null,
  istendi boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists push_biletleri_bekleyen_idx on public.push_biletleri (created_at) where not istendi;
alter table public.push_biletleri enable row level security;
revoke all on public.push_biletleri from anon, authenticated;

create table if not exists public.push_makbuz_istekleri (
  istek bigint primary key,
  biletler text[] not null,
  created_at timestamptz not null default now()
);
alter table public.push_makbuz_istekleri enable row level security;
revoke all on public.push_makbuz_istekleri from anon, authenticated;

-- 26. aşamadakiyle aynı; ek olarak kabul edilen biletleri jetonlarıyla saklar
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
        insert into push_biletleri (bilet, jeton)
        select t.bilet ->> 'id', r.jetonlar[t.sira]
        from jsonb_array_elements(r.content::jsonb -> 'data') with ordinality as t(bilet, sira)
        where t.bilet ->> 'status' = 'ok' and t.bilet ->> 'id' is not null and r.jetonlar[t.sira] is not null
        on conflict (bilet) do nothing;
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

create or replace function public.push_makbuzlari()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  silinen integer := 0;
  n integer;
  v_biletler text[];
  v_istek bigint;
begin
  silinen := public.push_yanitlarini_isle();

  -- Gelen makbuzlar: { data: { <bilet>: { status, details: { error } } } }
  if to_regclass('net._http_response') is not null then
    for r in execute
      'select i.istek, i.biletler, y.status_code, y.content
         from public.push_makbuz_istekleri i join net._http_response y on y.id = i.istek
        order by i.istek limit 50'
    loop
      if r.status_code = 200 and r.content is not null then
        begin
          delete from push_jetonlari j
          using push_biletleri b, jsonb_each(r.content::jsonb -> 'data') as m(bilet, makbuz)
          where b.bilet = m.bilet
            and b.bilet = any (r.biletler)
            and m.makbuz ->> 'status' = 'error'
            and m.makbuz -> 'details' ->> 'error' = 'DeviceNotRegistered'
            and j.jeton = b.jeton;
          get diagnostics n = row_count;
          silinen := silinen + n;
          delete from push_biletleri where bilet = any (r.biletler);
        exception when others then
          raise warning 'push makbuzu okunamadı: %', sqlerrm;
        end;
      else
        -- Expo'ya ulaşılamadı: biletler bir sonraki turda yeniden sorulur
        update push_biletleri set istendi = false where bilet = any (r.biletler);
      end if;
      delete from push_makbuz_istekleri where istek = r.istek;
    end loop;
  end if;

  delete from push_makbuz_istekleri where created_at < now() - interval '1 day';
  delete from push_biletleri where created_at < now() - interval '1 day';

  -- Yeni makbuz isteği: Expo makbuzun en erken ~15 dakikada hazır olmasını öneriyor
  if to_regproc('net.http_post') is not null then
    select array_agg(bilet) into v_biletler
    from (
      select bilet from push_biletleri
      where not istendi and created_at < now() - interval '15 minutes'
      order by created_at
      limit 1000
    ) x;
    if v_biletler is not null then
      begin
        execute 'select net.http_post(url => $1, body => $2, headers => $3)'
          into v_istek
          using 'https://exp.host/--/api/v2/push/getReceipts', jsonb_build_object('ids', to_jsonb(v_biletler)),
            '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
        if v_istek is not null then
          insert into push_makbuz_istekleri (istek, biletler) values (v_istek, v_biletler) on conflict (istek) do nothing;
          update push_biletleri set istendi = true where bilet = any (v_biletler);
        end if;
      exception when others then
        raise warning 'push makbuzu istenemedi: %', sqlerrm;
      end;
    end if;
  end if;

  return silinen;
end;
$$;

revoke execute on function public.push_yanitlarini_isle() from public, anon, authenticated;
revoke execute on function public.push_makbuzlari() from public, anon, authenticated;

-- 15 dakikada bir (pg_cron yoksa atlanır)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'lykiva-push-makbuzlari';
  perform cron.schedule('lykiva-push-makbuzlari', '*/15 * * * *', 'select public.push_makbuzlari()');
exception when others then
  raise notice 'pg_cron kurulamadı (%); telefon bildirimi makbuzları okunmayacak', sqlerrm;
end;
$$;
