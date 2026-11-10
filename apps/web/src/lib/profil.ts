/**
 * Herkese açık web profili (/u/<kullanıcı adı>).
 * Veri: Supabase'deki herkese_acik_profil(kullanici) (supabase/migrations/20261110090000_profil.sql):
 * ad, şehir, hakkında, sayılar ve yalnızca "herkese açık" aktivitelerin özeti (iz yok). Geçici hesapların profili yok.
 */
import type { ActivityType } from '@lykiva/shared';
import { cache } from 'react';

import { supabaseAyari } from '@/lib/sunucu';

export type ProfilAktivitesi = {
  title: string | null;
  activity: ActivityType;
  started_at: string;
  distance_m: number;
  moving_time_s: number;
  elevation_gain_m: number | null;
};

export type HerkeseAcikProfil = {
  display_name: string;
  username: string;
  city: string | null;
  bio: string | null;
  created_at: string;
  takipci: number;
  takip: number;
  aktivite_sayisi: number;
  toplam_km: number;
  aktiviteler: ProfilAktivitesi[];
};

export type ProfilSonucu = { durum: 'var'; p: HerkeseAcikProfil } | { durum: 'yok' } | { durum: 'ayarsiz' } | { durum: 'hata' };

export const KULLANICI_ADI = /^[a-z0-9_.]{3,30}$/;

export const herkeseAcikProfil = cache(async (kullanici: string): Promise<ProfilSonucu> => {
  const ad = decodeURIComponent(kullanici).toLowerCase();
  if (!KULLANICI_ADI.test(ad)) return { durum: 'yok' };
  const ayar = supabaseAyari();
  if (!ayar) return { durum: 'ayarsiz' };
  try {
    const r = await fetch(`${ayar.url}/rest/v1/rpc/herkese_acik_profil`, {
      method: 'POST',
      headers: { apikey: ayar.anahtar, Authorization: `Bearer ${ayar.anahtar}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kullanici: ad }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { durum: 'hata' };
    const p = (await r.json()) as HerkeseAcikProfil | null;
    return p ? { durum: 'var', p } : { durum: 'yok' };
  } catch {
    return { durum: 'hata' };
  }
});

export function uyelikMetni(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export function kisaTarih(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}
