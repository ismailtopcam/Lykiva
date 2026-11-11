import { describe, expect, it } from 'vitest';

import { formatBytes, OFFLINE_TILE_BUDGET, offlinePlan, routeOfflineBoxes, tileCount, tileXY } from './cevrimdisi';
import { haversine } from './track';

const START = { lat: 36.55, lng: 29.12 }; // Fethiye civarı
const DEG_PER_M = 1 / 111195;

/** Kuzeye giden, `aralik` metrede bir noktası olan `uzunlukM` rota */
function kuzey(uzunlukM: number, aralik = 50) {
  return Array.from({ length: Math.floor(uzunlukM / aralik) + 1 }, (_, i) => ({ lat: START.lat + i * aralik * DEG_PER_M, lng: START.lng }));
}

describe('tileXY', () => {
  it('z0 tek kare, z1 dört çeyrek', () => {
    expect(tileXY(29, 36, 0)).toEqual([0, 0]);
    expect(tileXY(-10, 10, 1)).toEqual([0, 0]);
    expect(tileXY(10, -10, 1)).toEqual([1, 1]);
  });
});

describe('routeOfflineBoxes', () => {
  it('boş rotada kutu yok', () => expect(routeOfflineBoxes([])).toEqual([]));

  it('kısa rota tek kutu, iki yana pay', () => {
    const b = routeOfflineBoxes(kuzey(1000));
    expect(b).toHaveLength(1);
    const [w, s, e, n] = b[0];
    // Kuzey-güney: 1 km rota + 2 × 1 km pay ≈ 3 km
    expect(haversine({ lat: s, lng: w }, { lat: n, lng: w })).toBeGreaterThan(2900);
    expect(haversine({ lat: s, lng: w }, { lat: n, lng: w })).toBeLessThan(3100);
    // Doğu-batı: yalnızca pay ≈ 2 km
    expect(haversine({ lat: s, lng: w }, { lat: s, lng: e })).toBeCloseTo(2000, -2);
  });

  it('uzun rota parçalara bölünür, parçalar birbirine değer', () => {
    const b = routeOfflineBoxes(kuzey(20_000));
    expect(b.length).toBeGreaterThanOrEqual(7);
    for (let i = 1; i < b.length; i++) expect(b[i][1]).toBeLessThanOrEqual(b[i - 1][3]);
  });

  it('iki noktalı uzun düz çizgi de bölünür (serbest çizim)', () => {
    const b = routeOfflineBoxes([START, { lat: START.lat + 0.2, lng: START.lng + 0.2 }]);
    expect(b.length).toBeGreaterThan(5);
  });
});

describe('tileCount', () => {
  it('çakışan kutular bir kez sayılır', () => {
    const k = routeOfflineBoxes(kuzey(1000));
    expect(tileCount([...k, ...k])).toBe(tileCount(k));
  });
  it('düzey arttıkça artar', () => {
    const k = routeOfflineBoxes(kuzey(1000));
    expect(tileCount(k, 14, 14)).toBeGreaterThan(tileCount(k, 10, 10));
  });
});

describe('offlinePlan', () => {
  it('20 km rota bütçeye rahat sığar', () => {
    const p = offlinePlan(kuzey(20_000));
    expect(p.fits).toBe(true);
    expect(p.tileCount).toBeGreaterThan(0);
    expect(p.tileCount).toBeLessThan(OFFLINE_TILE_BUDGET / 5);
  });
  it('çok uzun rota bütçeyi aşar', () => {
    // ~ 3.300 km kuzeye
    const p = offlinePlan(kuzey(3_300_000, 1000));
    expect(p.fits).toBe(false);
  });
  it('boş rota sığmaz', () => expect(offlinePlan([]).fits).toBe(false));
});

describe('formatBytes', () => {
  it('Türkçe', () => {
    expect(formatBytes(4_200_000)).toBe('4,2 MB');
    expect(formatBytes(820_000)).toBe('820 KB');
    expect(formatBytes(10)).toBe('1 KB');
  });
});
