/**
 * Hedefler ve meydan okumalar için ortak hesaplar: dönem aralığı, ölçü toplamı, ilerleme.
 *
 * - Ölçüler: mesafe (m), süre (hareket süresi, sn), sayı (aktivite), tırmanış (m) — veritabanıyla aynı birimler.
 * - Dönemler telefonun yerel saatine göre: hafta pazartesi 00:00'da, ay ayın 1'inde, yıl 1 Ocak'ta başlar.
 * - Hesap kişisel rekorlarla aynı veriden (`RekorAktivitesi`): sunucudaki kendi aktivitelerin + telefonda bekleyenler.
 */
import type { ActivityType } from './activity';
import type { RekorAktivitesi } from './rekor';

export const OLCULER = ['mesafe', 'sure', 'sayi', 'tirmanis'] as const;
export type Olcu = (typeof OLCULER)[number];

export const DONEMLER = ['hafta', 'ay', 'yil'] as const;
export type Donem = (typeof DONEMLER)[number];

export type Aralik = { bas: number; son: number };

export type Hedef = {
  id: string;
  donem: Donem;
  olcu: Olcu;
  /** Ölçünün biriminde (m, sn, adet) */
  hedef: number;
  /** null = bütün türler */
  activity: ActivityType | null;
};

/** O anın içinde bulunduğu dönem [bas, son) — yerel saate göre */
export function donemAraligi(donem: Donem, simdi: number): Aralik {
  const d = new Date(simdi);
  if (donem === 'yil') return { bas: new Date(d.getFullYear(), 0, 1).getTime(), son: new Date(d.getFullYear() + 1, 0, 1).getTime() };
  if (donem === 'ay') return { bas: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), son: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() };
  // Pazartesi = 0
  const gun = (d.getDay() + 6) % 7;
  const bas = new Date(d.getFullYear(), d.getMonth(), d.getDate() - gun);
  return { bas: bas.getTime(), son: new Date(bas.getFullYear(), bas.getMonth(), bas.getDate() + 7).getTime() };
}

/** Bir aktivitenin o ölçüdeki katkısı */
export function olcuKatkisi(a: RekorAktivitesi, olcu: Olcu): number {
  switch (olcu) {
    case 'mesafe':
      return a.distanceM || 0;
    case 'sure':
      return a.movingS || 0;
    case 'sayi':
      return 1;
    case 'tirmanis':
      return a.gainM || 0;
  }
}

/** Aralıktaki (başlangıcı [bas, son) içinde olan) ve türlere uyan aktivitelerin toplamı; türler boşsa hepsi */
export function olcuToplami(liste: RekorAktivitesi[], olcu: Olcu, aralik: Aralik, turler: readonly ActivityType[] = []): number {
  let t = 0;
  for (const a of liste) {
    if (a.startedAt < aralik.bas || a.startedAt >= aralik.son) continue;
    if (turler.length && !turler.includes(a.activity)) continue;
    t += olcuKatkisi(a, olcu);
  }
  return t;
}

export type Ilerleme = {
  deger: number;
  hedef: number;
  /** 0–1 (hedef aşılınca 1) */
  oran: number;
  tamam: boolean;
  /** Dönemin geçen kısmı 0–1: "planda mısın?" çizgisi */
  gecen: number;
  /** Kalan hedef (tamamsa 0) */
  kalan: number;
  /** Kalan gün, bugün dahil (pazar öğleden sonra 1); bittiyse 0 */
  kalanGun: number;
  aralik: Aralik;
};

export function ilerleme(deger: number, hedef: number, aralik: Aralik, simdi: number): Ilerleme {
  const sure = aralik.son - aralik.bas;
  const gecen = sure > 0 ? Math.min(1, Math.max(0, (simdi - aralik.bas) / sure)) : 1;
  const oran = hedef > 0 ? Math.min(1, deger / hedef) : 0;
  return {
    deger,
    hedef,
    oran,
    tamam: hedef > 0 && deger >= hedef,
    gecen,
    kalan: Math.max(0, hedef - deger),
    kalanGun: Math.max(0, Math.ceil((aralik.son - simdi) / 86_400_000)),
    aralik,
  };
}

/** Hedefin bu dönemdeki ilerlemesi */
export function hedefIlerlemesi(liste: RekorAktivitesi[], h: Pick<Hedef, 'donem' | 'olcu' | 'hedef' | 'activity'>, simdi: number): Ilerleme {
  const aralik = donemAraligi(h.donem, simdi);
  return ilerleme(olcuToplami(liste, h.olcu, aralik, h.activity ? [h.activity] : []), h.hedef, aralik, simdi);
}

/** Planın önünde mi gerisinde mi (dönemin geçen kısmına göre; %5 pay) */
export function plandaMi(i: Ilerleme): 'onde' | 'planda' | 'geride' {
  if (i.tamam) return 'onde';
  const fark = i.oran - i.gecen;
  return fark > 0.05 ? 'onde' : fark < -0.05 ? 'geride' : 'planda';
}

/** Hedefler ekranında sıra: hafta, ay, yıl; aynı dönemde mesafe, süre, sayı, tırmanış; türsüz önce */
export function hedefSirala<T extends Pick<Hedef, 'donem' | 'olcu' | 'activity'>>(liste: T[]): T[] {
  return [...liste].sort(
    (a, b) =>
      DONEMLER.indexOf(a.donem) - DONEMLER.indexOf(b.donem) ||
      OLCULER.indexOf(a.olcu) - OLCULER.indexOf(b.olcu) ||
      (a.activity ?? '').localeCompare(b.activity ?? ''),
  );
}
