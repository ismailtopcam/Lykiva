/**
 * Canlı konum bağlantısı (https://lykiva.app/c/<anahtar>): kayıt süren kişinin konumu, izi, hareketsizlik.
 * Sunucu: supabase/migrations/20261119000000_canli_baglanti.sql > canli_baglanti(anahtar). Uygulama: kayit/canliPaylasim.ts.
 * Anon anahtar yalnızca web sunucusunda; tarayıcı veriyi /c/<anahtar>/veri'den alır.
 */
import type { ActivityType } from '@lykiva/shared';

import { supabaseAyari } from './sunucu';

export type CanliVeri =
  | { durum: 'bitti'; ad: string | null }
  | { durum: 'bekliyor'; ad: string | null; bitis: string }
  | {
      durum: 'canli';
      ad: string | null;
      activity: ActivityType | null;
      lng: number;
      lat: number;
      speed_mps: number | null;
      is_paused: boolean;
      distance_m: number | null;
      started_at: string | null;
      updated_at: string;
      son_hareket: string | null;
      /** [lng, lat, unix sn] */
      iz: [number, number, number][];
      bitis: string;
    };

export type CanliSonuc = { durum: 'var'; v: CanliVeri } | { durum: 'yok' } | { durum: 'hata' };

export const CANLI_ANAHTAR = /^[0-9a-f]{32}$/;

/** Sayfanın kaç saniyede bir yeniden sorduğu (telefon 15 sn'de bir gönderir) */
export const YOKLAMA_SN = 15;
/** Molada değilken bu kadar dakika hareket yoksa uyarı */
export const HAREKETSIZ_DK = 10;
/** Konum bu kadar dakikadır gelmiyorsa uyarı (sinyal / pil / internet) */
export const SESSIZ_DK = 5;

export async function canliVeriGetir(anahtar: string): Promise<CanliSonuc> {
  if (!CANLI_ANAHTAR.test(anahtar)) return { durum: 'yok' };
  const ayar = supabaseAyari();
  if (!ayar) return { durum: 'hata' };
  try {
    const r = await fetch(`${ayar.url}/rest/v1/rpc/canli_baglanti`, {
      method: 'POST',
      headers: { apikey: ayar.anahtar, Authorization: `Bearer ${ayar.anahtar}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ anahtar }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { durum: 'hata' };
    const v = (await r.json()) as CanliVeri | null;
    return v ? { durum: 'var', v } : { durum: 'yok' };
  } catch {
    return { durum: 'hata' };
  }
}
