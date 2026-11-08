import { describe, expect, it } from 'vitest';

import { egimYuzde, eksikleriDoldur, izdusur, izHazirla, mesafedeDeger, parcaEgimleri, type IzKoordinati } from './ucBoyut';

const START = { lat: 36.2, lng: 29.6 };
const DEG_PER_M = 1 / 111195;
/** Kuzeye n metre, doğuya e metre, yükseklik z */
const k = (n: number, e: number, z: number | null): IzKoordinati => [START.lng + (e * DEG_PER_M) / Math.cos((START.lat * Math.PI) / 180), START.lat + n * DEG_PER_M, z];

/** 1 km kuzeye, 100 m'de 10 m tırmanış (%10) */
const yokus = Array.from({ length: 11 }, (_, i) => k(i * 100, 0, 100 + i * 10));

describe('eksikleriDoldur', () => {
  it('aradakileri doğrusal, uçları en yakınla doldurur', () => {
    expect(eksikleriDoldur([null, 10, null, 30, null])).toEqual([10, 10, 20, 30, 30]);
    expect(eksikleriDoldur([null, null])).toBeNull();
  });
});

describe('izHazirla', () => {
  it('metre düzlemi, mesafe ve yükseklik aralığı', () => {
    const iz = izHazirla(yokus)!;
    expect(iz.toplamM).toBeCloseTo(1000, -1);
    expect(iz.y[10] - iz.y[0]).toBeCloseTo(1000, -1);
    expect(Math.abs(iz.x[10] - iz.x[0])).toBeLessThan(1);
    expect(iz.minZ).toBe(100);
    expect(iz.maxZ).toBe(200);
    expect(iz.yukseklikVar).toBe(true);
  });
  it('yüksekliksiz izde düz', () => {
    const iz = izHazirla([k(0, 0, null), k(100, 0, null)])!;
    expect(iz.yukseklikVar).toBe(false);
    expect(iz.z).toEqual([0, 0]);
  });
  it('çok noktalı izi seyreltir, ucu korur', () => {
    const uzun = Array.from({ length: 5000 }, (_, i) => k(i, 0, 0));
    const iz = izHazirla(uzun, 600)!;
    expect(iz.x.length).toBeLessThanOrEqual(601);
    expect(iz.toplamM).toBeCloseTo(4999, -1);
  });
});

describe('izdusur', () => {
  const iz = izHazirla(yokus)!;
  it('tepeden bakışta kuzey yukarıda, yükseklik görünmez', () => {
    const p = izdusur(iz, { yon: 0, egim: 90, abarti: 3 }, 300, 300, 0);
    // Başlangıç (güney) altta, bitiş (kuzey) üstte
    expect(p.iz[0][1]).toBeGreaterThan(p.iz[10][1]);
    // Tepeden bakışta iz ile gölgesi üst üste
    expect(p.iz[5][1]).toBeCloseTo(p.zemin[5][1], 5);
  });
  it('yandan bakışta yükseklik dikey eksende', () => {
    const p = izdusur(iz, { yon: 90, egim: 0, abarti: 1 }, 300, 300, 0);
    // Yükseldikçe ekranda yukarı çıkar (y küçülür)
    expect(p.iz[10][1]).toBeLessThan(p.iz[0][1]);
    // Gölge düz bir çizgi
    expect(p.zemin[0][1]).toBeCloseTo(p.zemin[10][1], 5);
  });
  it('sonuç kutunun içinde kalır', () => {
    for (const yon of [0, 37, 145, 290]) {
      const p = izdusur(iz, { yon, egim: 35, abarti: 2 }, 320, 200, 10);
      for (const [x, y] of [...p.iz, ...p.zemin]) {
        expect(x).toBeGreaterThanOrEqual(9.99);
        expect(x).toBeLessThanOrEqual(310.01);
        expect(y).toBeGreaterThanOrEqual(9.99);
        expect(y).toBeLessThanOrEqual(190.01);
      }
    }
  });
});

describe('eğim', () => {
  const iz = izHazirla(yokus)!;
  it('yokuşta ≈ %10', () => {
    expect(egimYuzde(iz, 500)).toBeCloseTo(10, 0);
    expect(parcaEgimleri(iz).every((s) => s === 'cikis')).toBe(true);
  });
  it('mesafede ara değer', () => {
    expect(mesafedeDeger([0, 100, 200], [0, 10, 40], 150)).toBe(25);
    expect(mesafedeDeger([0, 100], [5, 9], -3)).toBe(5);
    expect(mesafedeDeger([0, 100], [5, 9], 300)).toBe(9);
  });
});
