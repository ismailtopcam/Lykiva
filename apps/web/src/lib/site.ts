/**
 * Yasal sayfalardaki iletişim bilgileri. Yönetim paneli > Site ayarları'ndan değişir.
 * Veri: Supabase'deki site_ayarlari() (supabase/migrations/20261111000000_hesap_silme_ayarlar.sql).
 * Sunucuya ulaşılamazsa varsayılanlar kullanılır.
 */
import { connection } from 'next/server';
import { cache } from 'react';

import { supabaseAyari } from '@/lib/sunucu';

export type SiteAyarlari = { iletisim_eposta: string; veri_sorumlusu: string; veri_sorumlusu_adres: string };

export const VARSAYILAN_AYARLAR: SiteAyarlari = { iletisim_eposta: 'bilgi@lykiva.app', veri_sorumlusu: '', veri_sorumlusu_adres: '' };

export const siteAyarlari = cache(async (): Promise<SiteAyarlari> => {
  // Her istekte oku: panelden yapılan değişiklik hemen görünsün (derleme sırasında sabitlenmesin)
  await connection();
  const ayar = supabaseAyari();
  if (!ayar) return VARSAYILAN_AYARLAR;
  try {
    const r = await fetch(`${ayar.url}/rest/v1/rpc/site_ayarlari`, {
      method: 'POST',
      headers: { apikey: ayar.anahtar, Authorization: `Bearer ${ayar.anahtar}`, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return VARSAYILAN_AYARLAR;
    const j = (await r.json()) as Partial<SiteAyarlari> | null;
    return { ...VARSAYILAN_AYARLAR, ...Object.fromEntries(Object.entries(j ?? {}).filter(([, v]) => typeof v === 'string')) };
  } catch {
    return VARSAYILAN_AYARLAR;
  }
});

/** Boş alan metinde "[doldurulacak]" olarak görünür */
export const ya = (deger: string) => deger.trim() || '[doldurulacak]';
