-- Lykiva — 4. aşama: Google / Apple girişi
--
-- Normal yol: geçici (anonim) hesaba Google ya da Apple kimliği bağlanır, kullanıcı kimliği değişmez.
-- Özel durum: o Google / Apple hesabı zaten başka bir Lykiva hesabına bağlıysa (ör. başka telefonda
-- giriş yapılmış) bağlama reddedilir. O zaman uygulama:
--   1. geçici hesaptayken `devir_kodu_al()` ile tek kullanımlık bir kod alır,
--   2. asıl hesaba giriş yapar,
--   3. `hesabi_devral(kod)` ile geçici hesaptaki kayıtları asıl hesaba taşır.
-- Kod yalnızca geçici hesabın oturumunu elinde tutan cihazda bilinir; 15 dakika geçerlidir.

create table if not exists public.hesap_devirleri (
  kod uuid primary key default gen_random_uuid(),
  kaynak uuid not null references auth.users (id) on delete cascade,
  olusturuldu timestamptz not null default now()
);

-- İstemciden doğrudan erişim yok; yalnızca aşağıdaki fonksiyonlar kullanır
alter table public.hesap_devirleri enable row level security;

create or replace function public.devir_kodu_al()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yeni uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is not true then
    raise exception 'Yalnızca geçici hesaplar devredilebilir';
  end if;

  -- Eski kodları temizle
  delete from hesap_devirleri where olusturuldu < now() - interval '1 day';

  insert into hesap_devirleri (kaynak) values (auth.uid()) returning kod into yeni;
  return yeni;
end;
$$;

-- Geçici hesaptaki aktiviteleri ve rotaları giriş yapılan hesaba taşır; taşınan aktivite sayısını döner
create or replace function public.hesabi_devral(p_kod uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  eski uuid;
  sayi integer;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Önce Google ya da Apple ile giriş yapılmalı';
  end if;

  delete from hesap_devirleri
  where kod = p_kod and olusturuldu > now() - interval '15 minutes'
  returning kaynak into eski;

  if eski is null then
    raise exception 'Devir kodu geçersiz ya da süresi dolmuş';
  end if;
  if eski = auth.uid() then
    return 0;
  end if;
  -- Yalnızca geçici hesaplardan taşınır
  if not exists (select 1 from auth.users where id = eski and is_anonymous) then
    raise exception 'Kaynak hesap geçici değil';
  end if;

  update routes set owner_id = auth.uid() where owner_id = eski;
  update activities set owner_id = auth.uid() where owner_id = eski;
  get diagnostics sayi = row_count;

  -- Beğeniler ve yorumlar (çakışanlar atlanır)
  insert into activity_likes (activity_id, user_id, created_at)
    select activity_id, auth.uid(), created_at from activity_likes where user_id = eski
    on conflict do nothing;
  delete from activity_likes where user_id = eski;
  update activity_comments set user_id = auth.uid() where user_id = eski;

  return sayi;
end;
$$;

revoke execute on function public.devir_kodu_al() from public, anon;
revoke execute on function public.hesabi_devral(uuid) from public, anon;
grant execute on function public.devir_kodu_al() to authenticated;
grant execute on function public.hesabi_devral(uuid) to authenticated;
