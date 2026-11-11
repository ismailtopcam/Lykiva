/**
 * Grup sohbeti: son mesajlar + Supabase Realtime ile canlı yeni mesaj / silme.
 * Kurallar gereği yalnızca grup üyeleri okur ve yazar.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { oturumuSagla, supabase } from '@/lib/supabase';
import { okunduIsaretle } from './gruplar';
import { $t } from '@/i18n';

export type Mesaj = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string | null;
  attachment_type: 'route' | 'activity' | 'location' | 'event' | 'poll' | null;
  attachment_id: string | null;
  created_at: string;
  /** Gönderenin adı (profil önbelleğinden) */
  ad?: string;
  /** Gönderiliyor (henüz sunucuya ulaşmadı) */
  bekliyor?: boolean;
};

const SAYFA = 100;
const adlar = new Map<string, string>();

async function adlariGetir(kimlikler: string[]) {
  const eksik = [...new Set(kimlikler)].filter((k) => !adlar.has(k));
  if (!eksik.length) return;
  const { data } = await supabase.from('profiles').select('id,display_name').in('id', eksik);
  for (const p of data ?? []) adlar.set(p.id, p.display_name);
}

export function useSohbet(grupId: string) {
  const [mesajlar, setMesajlar] = useState<Mesaj[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [ben, setBen] = useState<string | null>(null);
  const [dahaVar, setDahaVar] = useState(false);
  const kanal = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let acik = true;
    (async () => {
      try {
        const uid = await oturumuSagla();
        if (!acik) return;
        setBen(uid);
        const { data, error } = await supabase
          .from('messages')
          .select('id,group_id,sender_id,body,attachment_type,attachment_id,created_at')
          .eq('group_id', grupId)
          .order('created_at', { ascending: false })
          .limit(SAYFA);
        if (error) throw new Error(error.message);
        const liste = ((data ?? []) as Mesaj[]).reverse();
        await adlariGetir(liste.map((m) => m.sender_id));
        if (!acik) return;
        setDahaVar(liste.length === SAYFA);
        setMesajlar(liste.map((m) => ({ ...m, ad: adlar.get(m.sender_id) })));
        void okunduIsaretle(grupId).catch(() => undefined);
      } catch (e) {
        if (acik) setHata(e instanceof Error ? e.message : $t('grup_sohbet.mesajlar_yuklenemedi'));
      }
    })();

    // Canlı: bu grubun yeni ve silinen mesajları
    const c = supabase
      .channel(`grup-sohbet:${grupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${grupId}` }, async (p) => {
        const m = p.new as Mesaj;
        await adlariGetir([m.sender_id]);
        setMesajlar((liste) => {
          const l = liste ?? [];
          if (l.some((x) => x.id === m.id)) return l.map((x) => (x.id === m.id ? { ...m, ad: adlar.get(m.sender_id) } : x));
          return [...l, { ...m, ad: adlar.get(m.sender_id) }];
        });
        if (AppState.currentState === 'active') void okunduIsaretle(grupId).catch(() => undefined);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setMesajlar((liste) => liste?.filter((x) => x.id !== id) ?? liste);
      })
      .subscribe();
    kanal.current = c;

    return () => {
      acik = false;
      void supabase.removeChannel(c);
      kanal.current = null;
    };
  }, [grupId]);

  /** Daha eski mesajları yükler */
  const eskileriYukle = useCallback(async () => {
    const ilk = mesajlar?.[0];
    if (!ilk) return;
    const { data, error } = await supabase
      .from('messages')
      .select('id,group_id,sender_id,body,attachment_type,attachment_id,created_at')
      .eq('group_id', grupId)
      .lt('created_at', ilk.created_at)
      .order('created_at', { ascending: false })
      .limit(SAYFA);
    if (error) return;
    const eski = ((data ?? []) as Mesaj[]).reverse();
    await adlariGetir(eski.map((m) => m.sender_id));
    setDahaVar(eski.length === SAYFA);
    setMesajlar((l) => [...eski.map((m) => ({ ...m, ad: adlar.get(m.sender_id) })), ...(l ?? [])]);
  }, [mesajlar, grupId]);

  /** Metin gönderir; hemen listede görünür, sunucu onaylayınca kesinleşir */
  const gonder = useCallback(
    async (metin: string) => {
      const body = metin.trim();
      if (!body || !ben) return;
      const id = randomUUID();
      const gecici: Mesaj = { id, group_id: grupId, sender_id: ben, body, attachment_type: null, attachment_id: null, created_at: new Date().toISOString(), bekliyor: true };
      setMesajlar((l) => [...(l ?? []), gecici]);
      const { data, error } = await supabase
        .from('messages')
        .insert({ group_id: grupId, sender_id: ben, body })
        .select('id,group_id,sender_id,body,attachment_type,attachment_id,created_at')
        .single();
      if (error || !data) {
        setMesajlar((l) => l?.filter((x) => x.id !== id) ?? l);
        throw new Error(error?.message ?? $t('ortak.gonderilemedi'));
      }
      const m = data as Mesaj;
      setMesajlar((l) => {
        const temiz = (l ?? []).filter((x) => x.id !== id);
        return temiz.some((x) => x.id === m.id) ? temiz : [...temiz, { ...m, ad: adlar.get(m.sender_id) }].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    },
    [ben, grupId],
  );

  const sil = useCallback(async (id: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setMesajlar((l) => l?.filter((x) => x.id !== id) ?? l);
  }, []);

  return { mesajlar, hata, ben, dahaVar, eskileriYukle, gonder, sil };
}
