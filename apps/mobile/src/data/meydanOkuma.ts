/**
 * Meydan okumalar: herkese açık olanları yönetici açar (web /admin/meydan-okumalar), grubunkini grup üyesi.
 * Değer ve sıralama sunucuda hesaplanır (katılımcının aralıktaki bütün aktiviteleri; sıralamada yalnızca toplam).
 * Migration: supabase/migrations/20261113000000_hedefler_meydan_okumalar.sql
 */
import type { ActivityType, Olcu, TamamlananMeydanOkuma } from '@lykiva/shared';

import { sunucuHatasi } from '@/data/hedef';
import { oturumuSagla, supabase, supabaseHazir } from '@/lib/supabase';

export type MeydanOkuma = {
  id: string;
  baslik: string;
  aciklama: string | null;
  olcu: Olcu;
  hedef: number;
  turler: ActivityType[];
  baslangic: string;
  bitis: string;
  group_id: string | null;
  grup_adi: string | null;
  katilimci_sayisi: number;
  katildim: boolean;
  degerim: number | null;
  yonetebilir: boolean;
};

export type SiralamaSatiri = {
  /** Katılımını gizleyen kişide (gizli: true) kimlik alanları boş gelir */
  user_id: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  deger: number;
  sira: number;
  ben: boolean;
  gizli?: boolean;
};

export type MeydanOkumaDetayi = MeydanOkuma & { siralama: SiralamaSatiri[]; benim: SiralamaSatiri | null };

export type YeniMeydanOkuma = {
  baslik: string;
  aciklama?: string;
  olcu: Olcu;
  hedef: number;
  turler: ActivityType[];
  baslangic: string;
  bitis: string;
  group_id: string;
};

async function rpc<T>(ad: string, args?: Record<string, unknown>): Promise<T> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc(ad, args);
  if (error) throw sunucuHatasi(error);
  return data as T;
}

export const meydanOkumalar = (grup?: string) => rpc<MeydanOkuma[]>('meydan_okumalar_listesi', { g: grup ?? null });
export const meydanOkumaDetayi = (id: string) => rpc<MeydanOkumaDetayi | null>('meydan_okuma_detay', { p_id: id });
export const meydanOkumaOlustur = (p: YeniMeydanOkuma) => rpc<string>('meydan_okuma_olustur', { p });
export const meydanOkumayaKatil = (id: string) => rpc<void>('meydan_okumaya_katil', { p_id: id });
export const meydanOkumadanAyril = (id: string) => rpc<void>('meydan_okumadan_ayril', { p_id: id });
export const meydanOkumaSil = (id: string) => rpc<void>('meydan_okuma_sil', { p_id: id });

export type Durum = 'yaklasan' | 'suruyor' | 'bitti';
export function durumu(m: Pick<MeydanOkuma, 'baslangic' | 'bitis'>, simdi: number): Durum {
  if (Date.parse(m.baslangic) > simdi) return 'yaklasan';
  return Date.parse(m.bitis) > simdi ? 'suruyor' : 'bitti';
}

export const tamamlandiMi = (m: Pick<MeydanOkuma, 'katildim' | 'degerim' | 'hedef'>) => m.katildim && (m.degerim ?? 0) >= m.hedef;

/** Rozetler için: tamamladığım meydan okumalar. Sunucu yoksa ya da migration uygulanmamışsa boş. */
export async function tamamladigimMeydanOkumalar(): Promise<TamamlananMeydanOkuma[]> {
  if (!supabaseHazir) return [];
  try {
    const l = await meydanOkumalar();
    const simdi = Date.now();
    return l.filter(tamamlandiMi).map((m) => ({ id: m.id, tarih: Math.min(Date.parse(m.bitis), simdi) }));
  } catch {
    return [];
  }
}
