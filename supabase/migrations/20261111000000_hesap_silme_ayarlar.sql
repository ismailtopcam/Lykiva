-- Lykiva — 27. aşama: uygulama içinden hesap silme, site ayarları (yasal sayfalardaki iletişim bilgileri)
--
-- hesabimi_sil(): App Store (5.1.1(v)) ve Google Play'in istediği hesap silme.
--   - Kurduğun gruplar en kıdemli yöneticiye, yoksa en eski üyeye devredilir; başka üyesi olmayan grup silinir
--     (groups.created_by zincirleme silinmediği için önce devredilmeli)
--   - Oluşturduğun etkinlikler silinir (events.created_by da zincirleme silinmez)
--   - Sonra auth.users satırı silinir; profil, aktiviteler, rotalar, yorumlar, beğeniler, takipler, mesajlar,
--     bildirimler, push jetonları, şikayetlerin zincirleme gider
--   - Depodaki fotoğrafları uygulama bu fonksiyondan önce siler (Storage API; tablo satırını silmek dosyayı silmez)
--
-- site_ayarlari: web'deki gizlilik / koşullar / hesap silme sayfalarında görünen iletişim e-postası ve veri sorumlusu.
--   Herkes okur (site_ayarlari()), yalnızca yönetici değiştirir (yonetim_site_ayarlari_guncelle).

-- ---------------------------------------------------------------------------
-- Hesap silme
-- ---------------------------------------------------------------------------
create or replace function public.hesabimi_sil()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  ben uuid := auth.uid();
  g record;
  halef uuid;
begin
  if ben is null then
    raise exception 'Giriş gerekli';
  end if;

  for g in
    select gr.id from public.groups gr
    where gr.created_by = ben
       or exists (select 1 from public.group_members m where m.group_id = gr.id and m.user_id = ben and m.role = 'owner')
  loop
    select m.user_id into halef
    from public.group_members m
    where m.group_id = g.id and m.user_id <> ben
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at
    limit 1;
    if halef is null then
      delete from public.groups where id = g.id;
    else
      update public.group_members set role = 'owner' where group_id = g.id and user_id = halef;
      update public.groups set created_by = halef where id = g.id and created_by = ben;
    end if;
  end loop;

  delete from public.events where created_by = ben;
  delete from auth.users where id = ben;
end;
$$;

revoke execute on function public.hesabimi_sil() from public, anon;
grant execute on function public.hesabimi_sil() to authenticated;

-- ---------------------------------------------------------------------------
-- Site ayarları
-- ---------------------------------------------------------------------------
create table if not exists public.site_ayarlari (
  anahtar text primary key check (anahtar in ('iletisim_eposta', 'veri_sorumlusu', 'veri_sorumlusu_adres')),
  deger text not null default '' check (char_length(deger) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.site_ayarlari enable row level security;
revoke all on public.site_ayarlari from anon, authenticated;

insert into public.site_ayarlari (anahtar, deger) values
  ('iletisim_eposta', 'bilgi@lykiva.app'),
  ('veri_sorumlusu', ''),
  ('veri_sorumlusu_adres', '')
on conflict (anahtar) do nothing;

create or replace function public.site_ayarlari()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(anahtar, deger), '{}'::jsonb) from site_ayarlari;
$$;

create or replace function public.yonetim_site_ayarlari_guncelle(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  v text;
begin
  perform public.yonetici_sart();
  for k, v in select key, btrim(value) from jsonb_each_text(coalesce(p, '{}'::jsonb)) loop
    if k not in ('iletisim_eposta', 'veri_sorumlusu', 'veri_sorumlusu_adres') then
      raise exception 'Bilinmeyen ayar: %', k;
    end if;
    if k = 'iletisim_eposta' and v !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
      raise exception 'İletişim e-postası geçersiz';
    end if;
    if char_length(v) > 300 then
      raise exception 'Ayar en fazla 300 karakter olabilir';
    end if;
    insert into site_ayarlari (anahtar, deger, updated_at) values (k, v, now())
    on conflict (anahtar) do update set deger = excluded.deger, updated_at = now();
  end loop;
  return public.site_ayarlari();
end;
$$;

revoke execute on function public.site_ayarlari() from public;
grant execute on function public.site_ayarlari() to anon, authenticated;
revoke execute on function public.yonetim_site_ayarlari_guncelle(jsonb) from public, anon;
grant execute on function public.yonetim_site_ayarlari_guncelle(jsonb) to authenticated;
