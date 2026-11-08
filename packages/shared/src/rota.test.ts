import { describe, expect, it } from 'vitest';

import { donguMu, rotaIlerlemesi, rotaSeyrelt, rotaUzunlugu, toblerSuresi, yukseklikOzeti, zeminOranlari, zeminSinifi, type RotaNoktasi } from './rota';

const START = { lat: 36.2, lng: 29.6 };
const DEG_PER_M = 1 / 111195;
/** Başlangıçtan kuzeye n metre, doğuya e metre */
const nokta = (n: number, e = 0, ele?: number): RotaNoktasi => ({
  lat: START.lat + n * DEG_PER_M,
  lng: START.lng + (e * DEG_PER_M) / Math.cos((START.lat * Math.PI) / 180),
  ele,
});

/** 0 → 1000 m kuzeye, 100 m aralıkla */
const duz = Array.from({ length: 11 }, (_, i) => nokta(i * 100));

describe('rotaUzunlugu', () => {
  it('düz 1 km', () => {
    expect(rotaUzunlugu(duz)).toBeCloseTo(1000, -1);
  });
});

describe('rotaIlerlemesi', () => {
  it('parça ortasında izdüşüm (köşe noktasına yuvarlamaz)', () => {
    const p = rotaIlerlemesi(duz, nokta(550, 20));
    expect(p.doneM).toBeCloseTo(550, -1);
    expect(p.remainingM).toBeCloseTo(450, -1);
    expect(p.sapmaM).toBeCloseTo(20, 0);
  });

  it('rotadan uzaklık sapma olarak döner', () => {
    expect(rotaIlerlemesi(duz, nokta(300, 120)).sapmaM).toBeCloseTo(120, 0);
  });

  it('gidiş-dönüşte önceki ilerlemeye göre doğru kol seçilir', () => {
    // 500 m kuzeye git, aynı yoldan (5 m doğusundan) geri dön
    const gidis = Array.from({ length: 6 }, (_, i) => nokta(i * 100));
    const donus = Array.from({ length: 6 }, (_, i) => nokta(500 - i * 100, 5));
    const r = [...gidis, ...donus];
    const burasi = nokta(200, 2);
    // Henüz bilgi yok → rotanın başı (gidiş kolu)
    expect(rotaIlerlemesi(r, burasi).doneM).toBeCloseTo(200, -1);
    // Dönüşteyken (önceki ilerleme ≈ 750 m) dönüş kolu: 500 + 5 (dönüş) + 300 = 805 m
    expect(rotaIlerlemesi(r, burasi, 750).doneM).toBeCloseTo(805, 0);
  });

  it('GPS titremesiyle biraz geri gitmek ilerlemeyi ileri koldan geri atlatmaz', () => {
    expect(rotaIlerlemesi(duz, nokta(395), 400).doneM).toBeCloseTo(395, 0);
  });
});

describe('yukseklikOzeti', () => {
  it('küçük dalgalanmaları saymaz, gerçek tırmanışı sayar', () => {
    const o = yukseklikOzeti([100, 101, 100, 101, 110, 120, 119, 120, 100, null]);
    expect(o.gainM).toBe(20);
    expect(o.lossM).toBe(20);
    expect(o.maxM).toBe(120);
    expect(o.minM).toBe(100);
  });
});

describe('toblerSuresi', () => {
  it('düz 1 km ≈ 5 km/sa (≈ 12 dk)', () => {
    // Düzde Tobler: 6·e^(−0,175) ≈ 5,04 km/sa
    expect(toblerSuresi(duz) / 60).toBeCloseTo(11.9, 0);
  });
  it('yokuş yukarı düzden yavaş', () => {
    const yokus = Array.from({ length: 11 }, (_, i) => nokta(i * 100, 0, i * 15));
    expect(toblerSuresi(yokus)).toBeGreaterThan(toblerSuresi(duz) * 1.5);
  });
});

describe('donguMu', () => {
  it('başladığı yere dönen rota döngüdür, düz rota değil', () => {
    const kare = [nokta(0), nokta(500), nokta(500, 500), nokta(0, 500), nokta(10)];
    expect(donguMu(kare)).toBe(true);
    expect(donguMu(duz)).toBe(false);
  });
});

describe('zeminSinifi', () => {
  it('OSM etiketlerinden sınıf', () => {
    expect(zeminSinifi('highway=path surface=asphalt')).toBe('patika');
    expect(zeminSinifi('highway=track tracktype=grade3')).toBe('toprak');
    expect(zeminSinifi('highway=unclassified surface=gravel')).toBe('toprak');
    expect(zeminSinifi('highway=residential')).toBe('asfalt');
    expect(zeminSinifi('reversedirection=yes highway=footway')).toBe('patika');
    expect(zeminSinifi('route_hiking_lwn=yes')).toBeNull();
  });
  it('oranlar', () => {
    expect(zeminOranlari({ asfalt: 0, toprak: 0, patika: 0 })).toBeNull();
    expect(zeminOranlari({ asfalt: 25, toprak: 25, patika: 50 })).toEqual({ asfalt: 0.25, toprak: 0.25, patika: 0.5 });
  });
});

describe('rotaSeyrelt', () => {
  it('uçları korur, sık noktaları atar', () => {
    const sik = Array.from({ length: 101 }, (_, i) => nokta(i * 2));
    const s = rotaSeyrelt(sik, 10);
    expect(s[0]).toBe(sik[0]);
    expect(s[s.length - 1]).toBe(sik[100]);
    expect(s.length).toBeLessThanOrEqual(22);
  });
});
