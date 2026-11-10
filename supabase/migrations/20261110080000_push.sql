-- Lykiva — 21. aşama: telefona anlık bildirim (push)
--
-- - Telefon, Expo push jetonunu push_jetonu_kaydet() ile bildirir (izin verildiyse); çıkışta / kapatınca push_jetonu_sil()
-- - Yeni bir uygulama içi bildirim (bildirimler tablosu) yazılınca alıcının telefonlarına Expo Push Service ile gönderilir
--   (https://exp.host/--/api/v2/push/send). İstek Supabase'in pg_net eklentisiyle, işlemi bekletmeden yapılır.
-- - pg_net yoksa ya da istek başarısız olursa uygulama içi bildirim yine yazılır (push sessizce atlanır)
-- - Jetonlar istemciye kapalı tabloda; bir jeton tek hesaba bağlı (cihaz hesap değiştirirse yeni hesaba geçer)
-- - Bildirim metni push_icerigi() ile Türkçe üretilir; konum içermez

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net kurulamadı (%); push gönderilmeyecek, uygulama içi bildirimler etkilenmez', sqlerrm;
end;
$$;

create table if not exists public.push_jetonlari (
  jeton text primary key check (jeton ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_jetonlari_user_idx on public.push_jetonlari (user_id);
alter table public.push_jetonlari enable row level security;
revoke all on public.push_jetonlari from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Jeton kaydı
-- ---------------------------------------------------------------------------
create or replace function public.push_jetonu_kaydet(p_jeton text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if p_jeton !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$' then
    raise exception 'Geçersiz bildirim jetonu';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'Geçersiz platform';
  end if;
  insert into push_jetonlari (jeton, user_id, platform, updated_at)
  values (p_jeton, auth.uid(), p_platform, now())
  on conflict on constraint push_jetonlari_pkey do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  -- Hesap başına en fazla 10 cihaz (en eskiler silinir)
  delete from push_jetonlari where push_jetonlari.user_id = auth.uid() and push_jetonlari.jeton in (
    select j.jeton from push_jetonlari j where j.user_id = auth.uid() order by j.updated_at desc offset 10
  );
end;
$$;

create or replace function public.push_jetonu_sil(p_jeton text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_jetonlari where push_jetonlari.jeton = p_jeton and push_jetonlari.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Bildirim metni (uygulamadaki bildirimler ekranıyla aynı dil)
-- ---------------------------------------------------------------------------
create or replace function public.push_icerigi(b public.bildirimler)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select
      coalesce((select display_name from profiles where id = b.aktor), 'Biri') as ad,
      (select nullif(title, '') from activities where id = b.activity_id) as aktivite,
      (select left(body, 120) from activity_comments where id = b.comment_id) as yorum,
      (select name from groups where id = b.group_id) as grup,
      (select title from events where id = b.event_id) as etkinlik
  )
  select jsonb_build_object(
    'title', case b.tur
      when 'katilim_kabul' then coalesce(v.grup, 'Grup')
      when 'etkinlik' then coalesce(v.grup, 'Yeni etkinlik')
      else v.ad
    end,
    'body', case b.tur
      when 'takip' then 'Seni takip etmeye başladı'
      when 'begeni' then coalesce('“' || v.aktivite || '” aktiviteni beğendi', 'Aktiviteni beğendi')
      when 'yorum' then coalesce('Yorum yaptı: “' || v.yorum || '”', 'Aktivitene yorum yaptı')
      when 'katilim_istegi' then coalesce('“' || v.grup || '” grubuna katılmak istiyor', 'Grubuna katılmak istiyor')
      when 'katilim_kabul' then 'Gruba katılma isteğin kabul edildi'
      when 'etkinlik' then v.ad || ' etkinlik oluşturdu: “' || coalesce(v.etkinlik, '') || '”'
      when 'birlikte' then coalesce('Seni “' || v.aktivite || '” aktivitesine ekledi', 'Seni bir aktivitesine ekledi')
      else 'Yeni bildirim'
    end,
    'data', jsonb_strip_nulls(jsonb_build_object(
      'bildirim_id', b.id, 'tur', b.tur, 'aktor', b.aktor, 'activity_id', b.activity_id,
      'group_id', b.group_id, 'event_id', b.event_id
    ))
  )
  from v;
$$;

-- ---------------------------------------------------------------------------
-- Gönderim: bildirim yazılınca (işlemi bekletmez, hata bildirimi engellemez)
-- ---------------------------------------------------------------------------
create or replace function public.push_gonder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  icerik jsonb;
  mesajlar jsonb;
  rozet integer;
begin
  if to_regproc('net.http_post') is null then
    return new;
  end if;
  begin
    icerik := public.push_icerigi(new);
    rozet := (select count(*) from bildirimler where alici = new.alici and not okundu);
    select jsonb_agg(jsonb_build_object(
      'to', j.jeton, 'title', icerik ->> 'title', 'body', icerik ->> 'body', 'data', icerik -> 'data',
      'sound', 'default', 'badge', rozet, 'channelId', 'varsayilan'
    ))
    into mesajlar
    from (select jeton from push_jetonlari where user_id = new.alici order by updated_at desc limit 10) j;
    if mesajlar is not null then
      execute 'select net.http_post(url => $1, body => $2, headers => $3)'
        using 'https://exp.host/--/api/v2/push/send', mesajlar, '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
    end if;
  exception when others then
    raise warning 'push gönderilemedi: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists push_gonder on public.bildirimler;
create trigger push_gonder after insert on public.bildirimler
  for each row execute function public.push_gonder();

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function public.push_jetonu_kaydet(text, text) from public, anon;
revoke execute on function public.push_jetonu_sil(text) from public, anon;
grant execute on function public.push_jetonu_kaydet(text, text) to authenticated;
grant execute on function public.push_jetonu_sil(text) to authenticated;
revoke execute on function public.push_icerigi(public.bildirimler) from public, anon, authenticated;
revoke execute on function public.push_gonder() from public, anon, authenticated;
