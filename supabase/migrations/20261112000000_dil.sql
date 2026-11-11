-- Dil desteği: kullanıcının dili ve telefon bildirimlerinin o dilde gönderilmesi.
-- Uygulama dili değişince (ve açılışta) dil_ayarla ile kaydeder; push_icerigi alıcının dilini kullanır.
-- Diller: tr, en, de, ru; Arapça (ar) kabul edilir, metinleri gelene kadar bildirimler İngilizce gider.

alter table public.profiles add column if not exists dil text not null default 'tr';
alter table public.profiles drop constraint if exists profil_dil_gecerli;
alter table public.profiles add constraint profil_dil_gecerli check (dil in ('tr', 'en', 'de', 'ru', 'ar'));

create or replace function public.dil_ayarla(p_dil text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum yok' using errcode = '42501';
  end if;
  if p_dil is null or p_dil not in ('tr', 'en', 'de', 'ru', 'ar') then
    raise exception 'Desteklenmeyen dil' using errcode = 'P0001';
  end if;
  update profiles set dil = p_dil where id = auth.uid() and dil is distinct from p_dil;
end;
$$;

revoke execute on function public.dil_ayarla(text) from public, anon;
grant execute on function public.dil_ayarla(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Bildirim metni, alıcının dilinde (uygulamadaki bildirimler ekranıyla aynı anlam)
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
      case (select dil from profiles where id = b.alici) when 'tr' then 'tr' when 'de' then 'de' when 'ru' then 'ru' else 'en' end as dil,
      (select display_name from profiles where id = b.aktor) as ad_ham,
      (select nullif(title, '') from activities where id = b.activity_id) as aktivite,
      (select left(body, 120) from activity_comments where id = b.comment_id) as yorum,
      (select name from groups where id = b.group_id) as grup,
      (select title from events where id = b.event_id) as etkinlik
  ),
  w as (
    select v.*, coalesce(v.ad_ham, case v.dil when 'tr' then 'Biri' when 'de' then 'Jemand' when 'ru' then 'Кто-то' else 'Someone' end) as ad from v
  )
  select jsonb_build_object(
    'title', case b.tur
      when 'katilim_kabul' then coalesce(w.grup, case w.dil when 'tr' then 'Grup' when 'de' then 'Gruppe' when 'ru' then 'Группа' else 'Group' end)
      when 'etkinlik' then coalesce(w.grup, case w.dil when 'tr' then 'Yeni etkinlik' when 'de' then 'Neues Event' when 'ru' then 'Новое мероприятие' else 'New event' end)
      else w.ad
    end,
    'body', case w.dil
      when 'tr' then case b.tur
        when 'takip' then 'Seni takip etmeye başladı'
        when 'begeni' then coalesce('“' || w.aktivite || '” aktiviteni beğendi', 'Aktiviteni beğendi')
        when 'yorum' then coalesce('Yorum yaptı: “' || w.yorum || '”', 'Aktivitene yorum yaptı')
        when 'katilim_istegi' then coalesce('“' || w.grup || '” grubuna katılmak istiyor', 'Grubuna katılmak istiyor')
        when 'katilim_kabul' then 'Gruba katılma isteğin kabul edildi'
        when 'etkinlik' then w.ad || ' etkinlik oluşturdu: “' || coalesce(w.etkinlik, '') || '”'
        when 'birlikte' then coalesce('Seni “' || w.aktivite || '” aktivitesine ekledi', 'Seni bir aktivitesine ekledi')
        else 'Yeni bildirim'
      end
      when 'de' then case b.tur
        when 'takip' then 'Folgt dir jetzt'
        when 'begeni' then coalesce('Gefällt deine Aktivität „' || w.aktivite || '“', 'Gefällt deine Aktivität')
        when 'yorum' then coalesce('Hat kommentiert: „' || w.yorum || '“', 'Hat deine Aktivität kommentiert')
        when 'katilim_istegi' then coalesce('Möchte der Gruppe „' || w.grup || '“ beitreten', 'Möchte deiner Gruppe beitreten')
        when 'katilim_kabul' then 'Deine Beitrittsanfrage wurde angenommen'
        when 'etkinlik' then w.ad || ' hat ein Event erstellt: „' || coalesce(w.etkinlik, '') || '“'
        when 'birlikte' then coalesce('Hat dich zur Aktivität „' || w.aktivite || '“ hinzugefügt', 'Hat dich zu einer Aktivität hinzugefügt')
        else 'Neue Benachrichtigung'
      end
      when 'ru' then case b.tur
        when 'takip' then 'Подписался(-ась) на тебя'
        when 'begeni' then coalesce('Нравится твоя активность «' || w.aktivite || '»', 'Нравится твоя активность')
        when 'yorum' then coalesce('Комментарий: «' || w.yorum || '»', 'Прокомментировал(а) твою активность')
        when 'katilim_istegi' then coalesce('Хочет вступить в группу «' || w.grup || '»', 'Хочет вступить в твою группу')
        when 'katilim_kabul' then 'Твой запрос на вступление принят'
        when 'etkinlik' then w.ad || ' создал(а) мероприятие: «' || coalesce(w.etkinlik, '') || '»'
        when 'birlikte' then coalesce('Добавил(а) тебя в активность «' || w.aktivite || '»', 'Добавил(а) тебя в активность')
        else 'Новое уведомление'
      end
      else case b.tur
        when 'takip' then 'Started following you'
        when 'begeni' then coalesce('Liked your activity “' || w.aktivite || '”', 'Liked your activity')
        when 'yorum' then coalesce('Commented: “' || w.yorum || '”', 'Commented on your activity')
        when 'katilim_istegi' then coalesce('Wants to join “' || w.grup || '”', 'Wants to join your group')
        when 'katilim_kabul' then 'Your request to join was accepted'
        when 'etkinlik' then w.ad || ' created an event: “' || coalesce(w.etkinlik, '') || '”'
        when 'birlikte' then coalesce('Added you to the activity “' || w.aktivite || '”', 'Added you to an activity')
        else 'New notification'
      end
    end,
    'data', jsonb_strip_nulls(jsonb_build_object(
      'bildirim_id', b.id, 'tur', b.tur, 'aktor', b.aktor, 'activity_id', b.activity_id,
      'group_id', b.group_id, 'event_id', b.event_id
    ))
  )
  from w;
$$;

revoke execute on function public.push_icerigi(public.bildirimler) from public, anon, authenticated;
