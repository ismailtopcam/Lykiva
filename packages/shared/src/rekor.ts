/**
 * Kişisel rekorlar ve toplamlar: kullanıcının kendi aktivitelerinden, aktivite türüne göre.
 *
 * - En uzun mesafe, en uzun süre (hareket), en yüksek hız, en çok tırmanış.
 * - Eşitlikte ilk ulaşan (daha eski aktivite) rekoru tutar.
 * - En yüksek hızda türe göre bir üst sınır var: üstündeki değer GPS sıçraması ya da kaydı kapatmayı unutup
 *   araca binmek sayılır, rekora girmez (aktivitenin kendi sayfasında yine görünür).
 */
import type { ActivityType } from './activity';

export const REKOR_TURLERI = ['mesafe', 'sure', 'hiz', 'tirmanis'] as const;
export type RekorTuru = (typeof REKOR_TURLERI)[number];

export type RekorAktivitesi = {
  id: string;
  activity: ActivityType;
  /** Başlangıç (ms) */
  startedAt: number;
  distanceM: number;
  movingS: number;
  maxSpeedMps: number | null;
  gainM: number | null;
  title?: string | null;
};

export type Rekor = { tur: RekorTuru; deger: number; aktivite: RekorAktivitesi };

/** Rekora girebilecek en yüksek hız (m/s); üstü güvenilmez sayılır */
export const REKOR_HIZ_SINIRI: Record<ActivityType, number> = {
  bike: 120 / 3.6,
  mtb: 100 / 3.6,
  run: 40 / 3.6,
  trail_run: 40 / 3.6,
  walk: 25 / 3.6,
  hike: 25 / 3.6,
};

/** Aktivitenin o rekor türündeki değeri; rekora giremiyorsa null */
export function rekorDegeri(a: RekorAktivitesi, tur: RekorTuru): number | null {
  let v: number | null;
  switch (tur) {
    case 'mesafe':
      v = a.distanceM;
      break;
    case 'sure':
      v = a.movingS;
      break;
    case 'hiz':
      v = a.maxSpeedMps != null && a.maxSpeedMps <= REKOR_HIZ_SINIRI[a.activity] ? a.maxSpeedMps : null;
      break;
    case 'tirmanis':
      v = a.gainM;
      break;
  }
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

/** Rekorlar; tür verilirse yalnızca o türün aktivitelerinden. Değeri olmayan rekor türü sonuçta yok. */
export function kisiselRekorlar(liste: RekorAktivitesi[], tur?: ActivityType): Partial<Record<RekorTuru, Rekor>> {
  const sonuc: Partial<Record<RekorTuru, Rekor>> = {};
  for (const a of liste) {
    if (tur && a.activity !== tur) continue;
    for (const r of REKOR_TURLERI) {
      const v = rekorDegeri(a, r);
      if (v == null) continue;
      const eski = sonuc[r];
      if (!eski || v > eski.deger || (v === eski.deger && a.startedAt < eski.aktivite.startedAt)) {
        sonuc[r] = { tur: r, deger: v, aktivite: a };
      }
    }
  }
  return sonuc;
}

/**
 * Bu aktivitenin kendi türünde tuttuğu rekorlar ("Kişisel rekor: en uzun mesafe").
 * O türde tek aktivite varsa boş döner: ilk kayıt her şeyde rekor olur, anlamı yok.
 */
export function aktivitininRekorlari(liste: RekorAktivitesi[], id: string): RekorTuru[] {
  const a = liste.find((x) => x.id === id);
  if (!a) return [];
  if (liste.filter((x) => x.activity === a.activity).length < 2) return [];
  const rekorlar = kisiselRekorlar(liste, a.activity);
  return REKOR_TURLERI.filter((r) => rekorlar[r]?.aktivite.id === id);
}

export type Toplamlar = { sayi: number; mesafeM: number; sureS: number; tirmanisM: number };

/** Toplamlar; `basMs` verilirse o andan sonra başlayanlar */
export function toplamlar(liste: RekorAktivitesi[], tur?: ActivityType, basMs?: number): Toplamlar {
  const t: Toplamlar = { sayi: 0, mesafeM: 0, sureS: 0, tirmanisM: 0 };
  for (const a of liste) {
    if (tur && a.activity !== tur) continue;
    if (basMs != null && a.startedAt < basMs) continue;
    t.sayi += 1;
    t.mesafeM += a.distanceM || 0;
    t.sureS += a.movingS || 0;
    t.tirmanisM += a.gainM || 0;
  }
  return t;
}

/** Listede bulunan aktivite türleri, en çok yapılandan aza */
export function yapilanTurler(liste: RekorAktivitesi[]): ActivityType[] {
  const sayi = new Map<ActivityType, number>();
  for (const a of liste) sayi.set(a.activity, (sayi.get(a.activity) ?? 0) + 1);
  return [...sayi.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t);
}
