/**
 * Hedefler (haftalık / aylık / yıllık) ve meydan okumaların ortak parçaları.
 * Hedefler sunucuda (`hedefler` tablosu, yalnızca sahibi okur; yazma `hedef_kaydet` / `hedef_sil`),
 * ilerleme telefonda: `packages/shared/src/hedef.ts`, veri kişisel rekorlarla aynı (`data/rekor.ts`).
 * Migration: supabase/migrations/20261113000000_hedefler_meydan_okumalar.sql
 */
import { formatKm, formatMeters, kmUnit, mUnit, type ActivityType, type Donem, type Hedef, type Olcu } from '@lykiva/shared';

import { oturumuSagla, supabase } from '@/lib/supabase';
import { $t } from '@/i18n';

/** Sunucuda migration uygulanmamışsa (tablo / fonksiyon yok) anlaşılır bir hata */
export function sunucuHatasi(error: { code?: string; message: string }): Error {
  if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42P01' || error.code === '42883') {
    return new Error($t('basari.sunucu_guncel_degil'));
  }
  return new Error(error.message);
}

export async function hedeflerim(): Promise<Hedef[]> {
  await oturumuSagla();
  const { data, error } = await supabase.from('hedefler').select('id,donem,olcu,hedef,activity');
  if (error) throw sunucuHatasi(error);
  return (data ?? []).map((h) => ({
    id: h.id as string,
    donem: h.donem as Donem,
    olcu: h.olcu as Olcu,
    hedef: Number(h.hedef),
    activity: (h.activity as ActivityType | null) ?? null,
  }));
}

export async function hedefKaydet(donem: Donem, olcu: Olcu, hedef: number, activity: ActivityType | null): Promise<string> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc('hedef_kaydet', { p_donem: donem, p_olcu: olcu, p_hedef: hedef, p_activity: activity });
  if (error) throw sunucuHatasi(error);
  return data as string;
}

export async function hedefSil(id: string): Promise<void> {
  await oturumuSagla();
  const { error } = await supabase.rpc('hedef_sil', { p_id: id });
  if (error) throw sunucuHatasi(error);
}

/** Ölçünün değeri ekranda: { value: "42,5", unit: "km" } */
export function olcuMetni(olcu: Olcu, deger: number): { value: string; unit: string } {
  switch (olcu) {
    case 'mesafe':
      return { value: formatKm(deger), unit: kmUnit() };
    case 'sure': {
      const s = Math.max(0, Math.round(deger));
      const sa = Math.floor(s / 3600);
      const dk = Math.floor((s % 3600) / 60);
      return { value: dk ? `${sa}:${String(dk).padStart(2, '0')}` : String(sa), unit: $t('ortak.birim_sa') };
    }
    case 'sayi': {
      const n = Math.round(deger);
      return { value: String(n), unit: $t('basari.birim_aktivite', { n }) };
    }
    case 'tirmanis':
      return { value: formatMeters(deger), unit: mUnit() };
  }
}

export const olcuYazi = (olcu: Olcu, deger: number) => {
  const m = olcuMetni(olcu, deger);
  return `${m.value} ${m.unit}`;
};

export function olcuAdi(olcu: Olcu): string {
  switch (olcu) {
    case 'mesafe':
      return $t('basari.olcu_mesafe');
    case 'sure':
      return $t('basari.olcu_sure');
    case 'sayi':
      return $t('basari.olcu_sayi');
    case 'tirmanis':
      return $t('basari.olcu_tirmanis');
  }
}

export function donemAdi(donem: Donem): string {
  switch (donem) {
    case 'hafta':
      return $t('hedefler.haftalik');
    case 'ay':
      return $t('hedefler.aylik');
    case 'yil':
      return $t('hedefler.yillik');
  }
}

/** Kullanıcının girdiği sayıyı ölçünün birimine çevirir (km → m, saat → sn) */
export function girdidenDeger(olcu: Olcu, girdi: number): number {
  switch (olcu) {
    case 'mesafe':
      return Math.round(girdi * 1000);
    case 'sure':
      return Math.round(girdi * 3600);
    case 'sayi':
      return Math.round(girdi);
    case 'tirmanis':
      return Math.round(girdi);
  }
}

/** Ters çevirme: birimden kullanıcının gireceği sayıya (m → km, sn → saat) */
export function degerdenGirdi(olcu: Olcu, deger: number): number {
  return olcu === 'mesafe' ? deger / 1000 : olcu === 'sure' ? deger / 3600 : deger;
}

/** Girdi biriminin adı: km, sa, aktivite, m */
export function girdiBirimi(olcu: Olcu): string {
  return olcu === 'mesafe' ? kmUnit() : olcu === 'sure' ? $t('ortak.birim_sa') : olcu === 'sayi' ? $t('basari.birim_aktivite', { n: 2 }) : mUnit();
}

/** Ölçüye göre hazır öneriler (girdi biriminde) */
export const ONERILER: Record<Olcu, Record<Donem, number[]>> = {
  mesafe: { hafta: [20, 50, 100, 200], ay: [100, 200, 500, 1000], yil: [1000, 2500, 5000, 10000] },
  sure: { hafta: [3, 5, 8, 12], ay: [10, 20, 30, 50], yil: [100, 200, 300, 500] },
  sayi: { hafta: [2, 3, 4, 5], ay: [8, 12, 16, 20], yil: [50, 100, 150, 200] },
  tirmanis: { hafta: [500, 1000, 2000, 3000], ay: [2000, 5000, 8849, 10000], yil: [10000, 25000, 50000, 100000] },
};
