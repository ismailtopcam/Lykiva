import { describe, expect, it } from 'vitest';

import { donemAraligi, hedefIlerlemesi, hedefSirala, ilerleme, olcuToplami, plandaMi } from './hedef';
import type { RekorAktivitesi } from './rekor';

const a = (id: string, o: Partial<RekorAktivitesi>): RekorAktivitesi => ({
  id,
  activity: 'bike',
  startedAt: 0,
  distanceM: 0,
  movingS: 0,
  maxSpeedMps: null,
  gainM: null,
  ...o,
});
// Yerel saatle: 12 Kasım 2026 Perşembe 15:00
const simdi = new Date(2026, 10, 12, 15, 0).getTime();
const t = (ay: number, gun: number, saat = 9) => new Date(2026, ay, gun, saat).getTime();

describe('donemAraligi', () => {
  it('hafta pazartesi 00:00 başlar', () => {
    const h = donemAraligi('hafta', simdi);
    expect(new Date(h.bas)).toEqual(new Date(2026, 10, 9));
    expect(new Date(h.son)).toEqual(new Date(2026, 10, 16));
  });
  it('pazar günü hâlâ o haftadır', () => {
    const h = donemAraligi('hafta', new Date(2026, 10, 15, 23, 59).getTime());
    expect(new Date(h.bas)).toEqual(new Date(2026, 10, 9));
  });
  it('ay ve yıl', () => {
    expect(donemAraligi('ay', simdi)).toEqual({ bas: new Date(2026, 10, 1).getTime(), son: new Date(2026, 11, 1).getTime() });
    expect(donemAraligi('yil', simdi)).toEqual({ bas: new Date(2026, 0, 1).getTime(), son: new Date(2027, 0, 1).getTime() });
  });
  it('aralık ayından sonra yeni yıl', () => {
    expect(donemAraligi('ay', new Date(2026, 11, 20).getTime()).son).toBe(new Date(2027, 0, 1).getTime());
  });
});

describe('olcuToplami ve hedefIlerlemesi', () => {
  const liste = [
    a('1', { startedAt: t(10, 8), distanceM: 50_000, movingS: 7200, gainM: 400 }), // geçen hafta pazar
    a('2', { startedAt: t(10, 9, 7), distanceM: 30_000, movingS: 3600, gainM: 200 }), // bu hafta pazartesi
    a('3', { startedAt: t(10, 11), activity: 'run', distanceM: 10_000, movingS: 3000, gainM: null }),
    a('4', { startedAt: t(9, 31), distanceM: 99_000 }), // geçen ay
  ];
  it('yalnızca aralıktaki aktiviteler sayılır', () => {
    const hafta = donemAraligi('hafta', simdi);
    expect(olcuToplami(liste, 'mesafe', hafta)).toBe(40_000);
    expect(olcuToplami(liste, 'sayi', hafta)).toBe(2);
    expect(olcuToplami(liste, 'tirmanis', hafta)).toBe(200);
    expect(olcuToplami(liste, 'sure', donemAraligi('ay', simdi))).toBe(13_800);
  });
  it('tür süzgeci', () => {
    expect(olcuToplami(liste, 'mesafe', donemAraligi('ay', simdi), ['run'])).toBe(10_000);
    expect(olcuToplami(liste, 'mesafe', donemAraligi('ay', simdi), ['bike', 'mtb'])).toBe(80_000);
  });
  it('haftalık 100 km hedefi', () => {
    const i = hedefIlerlemesi(liste, { donem: 'hafta', olcu: 'mesafe', hedef: 100_000, activity: null }, simdi);
    expect(i.deger).toBe(40_000);
    expect(i.oran).toBeCloseTo(0.4);
    expect(i.kalan).toBe(60_000);
    expect(i.tamam).toBe(false);
    // Perşembe 15:00: haftanın ~%48'i geçti
    expect(i.gecen).toBeCloseTo((3 * 24 + 15) / (7 * 24), 2);
    // Perşembe (bugün), Cuma, Cumartesi, Pazar
    expect(i.kalanGun).toBe(4);
  });
  it('türlü hedef yalnızca o türü sayar', () => {
    const i = hedefIlerlemesi(liste, { donem: 'ay', olcu: 'sayi', hedef: 4, activity: 'run' }, simdi);
    expect(i.deger).toBe(1);
  });
});

describe('ilerleme', () => {
  const aralik = { bas: 0, son: 100 };
  it('hedef aşılınca oran 1, kalan 0', () => {
    const i = ilerleme(150, 100, aralik, 50);
    expect(i.oran).toBe(1);
    expect(i.kalan).toBe(0);
    expect(i.tamam).toBe(true);
    expect(plandaMi(i)).toBe('onde');
  });
  it('plana göre', () => {
    expect(plandaMi(ilerleme(30, 100, aralik, 50))).toBe('geride');
    expect(plandaMi(ilerleme(52, 100, aralik, 50))).toBe('planda');
    expect(plandaMi(ilerleme(70, 100, aralik, 50))).toBe('onde');
  });
  it('dönem bittiyse geçen 1, kalan gün 0', () => {
    const i = ilerleme(10, 100, aralik, 500);
    expect(i.gecen).toBe(1);
    expect(i.kalanGun).toBe(0);
  });
});

describe('hedefSirala', () => {
  it('hafta, ay, yıl; ölçü sırası; türsüz önce', () => {
    const s = hedefSirala([
      { donem: 'yil', olcu: 'mesafe', activity: null },
      { donem: 'hafta', olcu: 'sayi', activity: null },
      { donem: 'hafta', olcu: 'mesafe', activity: 'run' },
      { donem: 'hafta', olcu: 'mesafe', activity: null },
    ] as const);
    expect(s.map((x) => `${x.donem}-${x.olcu}-${x.activity ?? ''}`)).toEqual(['hafta-mesafe-', 'hafta-mesafe-run', 'hafta-sayi-', 'yil-mesafe-']);
  });
});
