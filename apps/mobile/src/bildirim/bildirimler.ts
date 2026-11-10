/**
 * Uygulama içi bildirimler. Sunucu: supabase/migrations/20261110030000_bildirimler.sql
 * (bildirimleri tetikleyiciler yazar; uygulama okur ve okundu işaretler).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { oturumuSagla, supabase, supabaseHazir } from '@/lib/supabase';

export type BildirimTuru = 'takip' | 'begeni' | 'yorum' | 'katilim_istegi' | 'katilim_kabul' | 'etkinlik' | 'birlikte';

export type Bildirim = {
  id: string;
  tur: BildirimTuru;
  okundu: boolean;
  created_at: string;
  aktor: string | null;
  aktor_adi: string | null;
  takip_ediyorum: boolean | null;
  activity_id: string | null;
  aktivite_adi: string | null;
  yorum: string | null;
  group_id: string | null;
  grup_adi: string | null;
  event_id: string | null;
  etkinlik_adi: string | null;
  etkinlik_zamani: string | null;
};

async function rpc<T>(ad: string, args?: Record<string, unknown>): Promise<T> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc(ad, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const SAYFA = 30;

/** Bildirime dokununca açılacak sayfa (bildirimler ekranı ve telefona gelen bildirim için ortak) */
export function bildirimHedefi(b: { tur?: string | null; aktor?: string | null; activity_id?: string | null; group_id?: string | null; event_id?: string | null }): Href | null {
  if (b.tur === 'takip' && b.aktor) return { pathname: '/kisi/[id]', params: { id: b.aktor } };
  if ((b.tur === 'begeni' || b.tur === 'birlikte') && b.activity_id) return { pathname: '/aktivite/[id]', params: { id: b.activity_id } };
  if (b.tur === 'yorum' && b.activity_id) return { pathname: '/aktivite/[id]/yorumlar', params: { id: b.activity_id } };
  if ((b.tur === 'katilim_istegi' || b.tur === 'katilim_kabul') && b.group_id) return { pathname: '/grup/[id]', params: { id: b.group_id } };
  if (b.tur === 'etkinlik' && b.event_id) return { pathname: '/etkinlik/[id]', params: { id: b.event_id } };
  return null;
}
export const bildirimlerim = (once?: string | null) => rpc<Bildirim[]>('bildirimlerim', { once: once ?? null, adet: SAYFA });
export const bildirimSayisi = () => rpc<number>('bildirim_sayisi');
export const okunduSay = (son?: string | null) => rpc<void>('bildirimleri_okundu_say', { son: son ?? null });

/* ------------------------------------------------------------------ */
/* Okunmamış sayısı (zil rozeti)                                       */
/* ------------------------------------------------------------------ */

let sonSayi = 0;
const dinleyiciler = new Set<(n: number) => void>();

/** Rozeti her yerde güncelle (ör. bildirimler ekranı okundu sayınca 0) */
export function sayiyiBildir(n: number) {
  sonSayi = n;
  dinleyiciler.forEach((f) => f(n));
}

async function sayiyiYenile() {
  try {
    sayiyiBildir(await bildirimSayisi());
  } catch {
    // Çevrimdışı: eski sayı kalır
  }
}

// Tek canlı kanal: yeni bildirim gelince sayı yenilenir
let kanal: RealtimeChannel | null = null;
let kanalSahibi: string | null = null;

async function kanaliAc() {
  const uid = await oturumuSagla();
  if (kanal && kanalSahibi === uid) return;
  if (kanal) void supabase.removeChannel(kanal);
  kanalSahibi = uid;
  kanal = supabase
    .channel(`bildirimler:${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bildirimler', filter: `alici=eq.${uid}` }, () => void sayiyiYenile())
    .subscribe();
}

/** Zil rozeti için okunmamış bildirim sayısı: açılışta, ekrana dönünce, uygulama öne gelince ve yeni bildirim gelince güncellenir */
export function useBildirimSayisi() {
  const [n, setN] = useState(sonSayi);

  useEffect(() => {
    dinleyiciler.add(setN);
    if (!supabaseHazir) return () => void dinleyiciler.delete(setN);
    void kanaliAc().catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void sayiyiYenile();
    });
    return () => {
      dinleyiciler.delete(setN);
      sub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (supabaseHazir) void sayiyiYenile();
    }, []),
  );

  return n;
}
