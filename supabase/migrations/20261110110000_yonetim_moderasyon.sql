-- Lykiva — 25. aşama: yönetimde yorum / mesaj kaldırma ve kullanıcı engelleme
--
-- - yonetim_yorum_sil(yorum), yonetim_mesaj_sil(mesaj): şikayet edilen yorumu ya da grup mesajını kaldırır
-- - yonetim_engelle(kisi, engelli): auth.users.banned_until ile girişi ve oturum yenilemeyi kapatır
--   (Supabase Auth engelli kullanıcıya yeni oturum ve yenileme vermez; açık oturum en geç erişim anahtarının
--   süresi dolunca, varsayılan 1 saat, kapanır). Engellenen kişinin telefon bildirim jetonları silinir.
--   Kendini ve yöneticileri engelleyemezsin (önce yetkiyi al).
-- - yonetim_kullanicilar: satırlarda "engelli" bilgisi

create or replace function public.yonetim_yorum_sil(yorum uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.yonetici_sart();
  delete from activity_comments where id = yorum;
  if not found then
    raise exception 'Yorum bulunamadı';
  end if;
end;
$$;

create or replace function public.yonetim_mesaj_sil(mesaj uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.yonetici_sart();
  delete from messages where id = mesaj;
  if not found then
    raise exception 'Mesaj bulunamadı';
  end if;
end;
$$;

create or replace function public.yonetim_engelle(kisi uuid, engelli boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.yonetici_sart();
  if kisi = auth.uid() then
    raise exception 'Kendini engelleyemezsin';
  end if;
  if engelli and exists (select 1 from public.profiles p where p.id = kisi and p.is_admin) then
    raise exception 'Yöneticiyi engellemeden önce yönetici yetkisini al';
  end if;
  -- "sonsuz" yerine 100 yıl: Supabase Auth'un kendi engelleme süresiyle aynı biçim
  update auth.users set banned_until = case when engelli then now() + interval '100 years' else null end where id = kisi;
  if not found then
    raise exception 'Kullanıcı bulunamadı';
  end if;
  if engelli then
    delete from public.push_jetonlari where user_id = kisi;
  end if;
end;
$$;

create or replace function public.yonetim_kullanicilar(arama text default null, sayfa integer default 0, gecici_dahil boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  q text := nullif(lower(trim(coalesce(arama, ''))), '');
begin
  perform public.yonetici_sart();
  return (
    with liste as (
      select p.*, u.email, u.last_sign_in_at, u.banned_until, coalesce(u.is_anonymous, false) as gecici
      from profiles p join auth.users u on u.id = p.id
      where (gecici_dahil or not coalesce(u.is_anonymous, false))
        and (q is null or strpos(lower(p.display_name), q) > 0 or strpos(p.username, q) > 0 or strpos(lower(coalesce(u.email, '')), q) > 0)
    )
    select jsonb_build_object(
      'toplam', (select count(*) from liste),
      'satirlar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'display_name', l.display_name, 'username', l.username, 'email', l.email, 'city', l.city,
          'created_at', l.created_at, 'last_sign_in_at', l.last_sign_in_at, 'is_admin', l.is_admin, 'gecici', l.gecici, 'engelli', coalesce(l.banned_until > now(), false),
          'aktivite', (select count(*) from activities a where a.owner_id = l.id),
          'takipci', (select count(*) from follows f where f.followee_id = l.id),
          'sikayet', (select count(*) from reports r where r.target_type = 'user' and r.target_id = l.id)
        ) order by l.created_at desc)
        from (select * from liste order by created_at desc offset greatest(sayfa, 0) * 50 limit 50) l
      ), '[]'::jsonb)
    )
  );
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['yonetim_yorum_sil(uuid)', 'yonetim_mesaj_sil(uuid)', 'yonetim_engelle(uuid, boolean)', 'yonetim_kullanicilar(text, integer, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
