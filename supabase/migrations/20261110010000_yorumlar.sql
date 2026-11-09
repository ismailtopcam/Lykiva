-- Lykiva — 12. aşama: aktivite yorumları
--
-- - Aktiviteyi görebilen herkes yorum yazar (kural 20261108000000'de; burada fonksiyonla)
-- - Yorum 1–1000 karakter; dakikada en fazla 10 yorum (art arda gönderme / istenmeyen ileti)
-- - Yorumu yazan da, aktivitenin sahibi de silebilir
-- - aktivite_sosyal(): beğeni ve yorum sayısı, beğendim mi (aktivite detayı için)
-- - aktivite_yorumlari(): yorumlar yazar adlarıyla, eskiden yeniye (son 200)

-- Uzunluk sınırı; eski satırları denetlemeden (NOT VALID) yeni yazılanlara uygulanır
alter table public.activity_comments drop constraint if exists yorum_uzunlugu;
alter table public.activity_comments
  add constraint yorum_uzunlugu check (char_length(btrim(body)) between 1 and 1000) not valid;

create index if not exists activity_comments_user_created_idx on public.activity_comments (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Okuma
-- ---------------------------------------------------------------------------
create or replace function public.aktivite_sosyal(aktivite uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null or not public.aktiviteyi_gorebilir_mi(aktivite) then null else jsonb_build_object(
    'like_count', (select count(*) from activity_likes l where l.activity_id = aktivite),
    'comment_count', (select count(*) from activity_comments c where c.activity_id = aktivite),
    'liked', exists (select 1 from activity_likes l where l.activity_id = aktivite and l.user_id = auth.uid())
  ) end;
$$;

create or replace function public.aktivite_yorumlari(aktivite uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null or not public.aktiviteyi_gorebilir_mi(aktivite) then null else jsonb_build_object(
    'like_count', (select count(*) from activity_likes l where l.activity_id = aktivite),
    'comment_count', (select count(*) from activity_comments c where c.activity_id = aktivite),
    'liked', exists (select 1 from activity_likes l where l.activity_id = aktivite and l.user_id = auth.uid()),
    -- Aktivitenin sahibi her yorumu silebilir
    'i_own_activity', exists (select 1 from activities a where a.id = aktivite and a.owner_id = auth.uid()),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', y.id,
        'user_id', y.user_id,
        'display_name', p.display_name,
        'username', p.username,
        'body', y.body,
        'created_at', y.created_at,
        'mine', y.user_id = auth.uid()
      ) order by y.created_at, y.id)
      from (
        select * from activity_comments c where c.activity_id = aktivite
        order by c.created_at desc, c.id desc limit 200
      ) y
      join profiles p on p.id = y.user_id
    ), '[]'::jsonb)
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Yazma
-- ---------------------------------------------------------------------------
create or replace function public.yorum_yaz(aktivite uuid, metin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  temiz text := btrim(coalesce(metin, ''));
  yeni activity_comments;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if not public.aktiviteyi_gorebilir_mi(aktivite) then
    raise exception 'Bu aktiviteyi göremiyorsun';
  end if;
  if char_length(temiz) = 0 then
    raise exception 'Yorum boş olamaz';
  end if;
  if char_length(temiz) > 1000 then
    raise exception 'Yorum en fazla 1000 karakter olabilir';
  end if;
  if (select count(*) from activity_comments where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Çok hızlı yorum yazıyorsun, biraz bekle';
  end if;

  insert into activity_comments (activity_id, user_id, body)
  values (aktivite, auth.uid(), temiz)
  returning * into yeni;

  return (
    select jsonb_build_object(
      'id', yeni.id, 'user_id', yeni.user_id, 'display_name', p.display_name, 'username', p.username,
      'body', yeni.body, 'created_at', yeni.created_at, 'mine', true
    )
    from profiles p where p.id = yeni.user_id
  );
end;
$$;

-- Yazan ya da aktivitenin sahibi siler; silinmediyse false döner
create or replace function public.yorum_sil(yorum uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  sayi integer;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  delete from activity_comments c
  where c.id = yorum
    and (c.user_id = auth.uid() or exists (select 1 from activities a where a.id = c.activity_id and a.owner_id = auth.uid()));
  get diagnostics sayi = row_count;
  return sayi > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function public.aktivite_sosyal(uuid) from public, anon;
revoke execute on function public.aktivite_yorumlari(uuid) from public, anon;
revoke execute on function public.yorum_yaz(uuid, text) from public, anon;
revoke execute on function public.yorum_sil(uuid) from public, anon;
grant execute on function public.aktivite_sosyal(uuid) to authenticated;
grant execute on function public.aktivite_yorumlari(uuid) to authenticated;
grant execute on function public.yorum_yaz(uuid, text) to authenticated;
grant execute on function public.yorum_sil(uuid) to authenticated;

-- Yorum yalnızca yukarıdaki fonksiyonlarla yazılır / silinir (uzunluk ve hız sınırı atlanamasın)
revoke insert, update, delete on public.activity_comments from anon, authenticated;
grant select on public.activity_comments to authenticated;
