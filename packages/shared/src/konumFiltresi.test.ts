import { describe, expect, it } from 'vitest';

import { konumuFiltrele, type KonumFiltresi } from './konumFiltresi';
import { computeStats, haversine, type TrackPoint } from './track';

const O = { lat: 36.2, lng: 29.6 };
const M_LAT = 1 / 111195;
const M_LNG = 1 / (111195 * Math.cos((O.lat * Math.PI) / 180));

/** Tekrarlanabilir sözde rastgele (−1..1) */
function rastgele(tohum = 1) {
  let s = tohum;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
}

function filtrele(noktalar: TrackPoint[]) {
  let f: KonumFiltresi | null = null;
  return noktalar.map((p) => {
    const r = konumuFiltrele(f, p);
    f = r.filtre;
    return r.nokta;
  });
}

const mesafe = (pts: { lat: number; lng: number }[]) => pts.slice(1).reduce((a, p, i) => a + haversine(pts[i], p), 0);

/** Kuzeye `hiz` m/s, saniyede bir, ±`kipirti` m gürültüyle */
function iz(sn: number, hiz: number, kipirti: number, acc = 5, tohum = 7): TrackPoint[] {
  const r = rastgele(tohum);
  return Array.from({ length: sn + 1 }, (_, s) => ({
    t: s * 1000,
    lat: O.lat + (s * hiz + r() * kipirti) * M_LAT,
    lng: O.lng + r() * kipirti * M_LNG,
    acc,
    speed: hiz,
  }));
}

describe('konum filtresi', () => {
  it('ilk nokta olduğu gibi geçer', () => {
    const p = { t: 0, ...O, acc: 5 };
    expect(konumuFiltrele(null, p).nokta).toEqual(p);
  });

  it('yürüyüşte kıpırtının şişirdiği mesafeyi azaltır', () => {
    const ham = iz(600, 1.4, 3);
    const gercek = 600 * 1.4;
    const hamHata = Math.abs(mesafe(ham) - gercek);
    const filtreHata = Math.abs(mesafe(filtrele(ham)) - gercek);
    expect(filtreHata).toBeLessThan(hamHata * 0.6);
  });

  it('bisiklette mesafeyi bozmaz (±%2) ve geride kalmaz (<3 m)', () => {
    const ham = iz(600, 8, 2);
    const f = filtrele(ham);
    expect(Math.abs(mesafe(f) - 600 * 8) / (600 * 8)).toBeLessThan(0.02);
    const sonGercek = { lat: O.lat + 600 * 8 * M_LAT, lng: O.lng };
    expect(haversine(f[f.length - 1], sonGercek)).toBeLessThan(3);
  });

  it('dik dönüşte ölçümden doğruluğun ötesine sapmaz', () => {
    // 60 sn kuzeye, sonra 30 sn doğuya, 6 m/s
    const pts: TrackPoint[] = [];
    for (let s = 0; s <= 90; s++) {
      const k = Math.min(s, 60) * 6;
      const d = Math.max(0, s - 60) * 6;
      pts.push({ t: s * 1000, lat: O.lat + k * M_LAT, lng: O.lng + d * M_LNG, acc: 5, speed: 6 });
    }
    filtrele(pts).forEach((p, i) => expect(haversine(p, pts[i])).toBeLessThanOrEqual(5.01));
  });

  it('uzun boşluktan sonra baştan başlar', () => {
    const a = konumuFiltrele(null, { t: 0, ...O, acc: 5 });
    const uzak = { t: 60_000, lat: O.lat + 500 * M_LAT, lng: O.lng, acc: 5 };
    expect(konumuFiltrele(a.filtre, uzak).nokta).toEqual(uzak);
  });

  it('kötü ölçüm iyi ölçümden az etkiler', () => {
    const a = konumuFiltrele(null, { t: 0, ...O, acc: 4 }).filtre;
    const iyi = konumuFiltrele(a, { t: 1000, lat: O.lat + 10 * M_LAT, lng: O.lng, acc: 4 }).nokta;
    const kotu = konumuFiltrele(a, { t: 1000, lat: O.lat + 10 * M_LAT, lng: O.lng, acc: 25 }).nokta;
    expect(haversine(O, iyi)).toBeGreaterThan(haversine(O, kotu));
  });
});

describe('durulan yerdeki kıpırtı mesafeye girmez', () => {
  it('cihaz "duruyor" derken kıpırtı sayılmaz', () => {
    // Yerinde dururken GPS konumu yavaşça gezinir (her saniye ±1 m'ye kadar, birikerek)
    const r = rastgele(3);
    let k = 0;
    let d = 0;
    const pts: TrackPoint[] = Array.from({ length: 120 }, (_, s) => {
      k += r();
      d += r();
      return { t: s * 1000, lat: O.lat + k * M_LAT, lng: O.lng + d * M_LNG, acc: 5, speed: 0 };
    });
    expect(computeStats(pts).distanceM).toBe(0);
  });

  it('cihaz hızı yanlışlıkla 0 olsa da hızlı yer değişimi sayılır', () => {
    const pts: TrackPoint[] = Array.from({ length: 11 }, (_, s) => ({ t: s * 1000, lat: O.lat + s * 5 * M_LAT, lng: O.lng, acc: 5, speed: 0 }));
    expect(computeStats(pts).distanceM).toBeCloseTo(50, 0);
  });

  it('cihaz hızı yoksa eskisi gibi sayılır', () => {
    const pts: TrackPoint[] = Array.from({ length: 11 }, (_, s) => ({ t: s * 1000, lat: O.lat + (s % 2) * M_LAT, lng: O.lng, acc: 5 }));
    expect(computeStats(pts).distanceM).toBeCloseTo(10, 0);
  });
});
