import { describe, expect, it } from 'vitest';

import { gunlukBasligi, gunlukFarki, gunlukOzeti, gunluguOku, gunlukTamami } from './kayitGunlugu';
import type { TrackPoint } from './track';

// Dosyada yuvarlanan değerlerle aynı (1e-7 derece) olsun diye tamsayıdan
const n = (s: number): TrackPoint => ({ t: s * 1000, lat: (362000000 + s * 100) / 1e7, lng: 29.6, alt: 10 + s, acc: 4.5, speed: 5 });
const dizi = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => n(a + i));

/** Kaydediciyi taklit eder: her adımda farkı dosyaya ekler, sonunda dosyayı okur */
function oynat(adimlar: TrackPoint[][][]) {
  let dosya = gunlukBasligi('k1');
  let ozet = gunlukOzeti([]);
  for (const segments of adimlar) {
    const fark = gunlukFarki(ozet, segments);
    dosya = fark == null ? gunlukTamami('k1', segments) : dosya + fark;
    ozet = gunlukOzeti(segments);
  }
  return dosya;
}

describe('kayıt günlüğü', () => {
  it('eklenen noktaları sırayla geri verir', () => {
    const d = oynat([[dizi(0, 2)], [dizi(0, 5)], [dizi(0, 5)], [dizi(0, 9)]]);
    expect(gunluguOku(d, 'k1')).toEqual([dizi(0, 9)]);
  });

  it('yalnızca yeni noktaları yazar', () => {
    const fark = gunlukFarki(gunlukOzeti([dizi(0, 99)]), [dizi(0, 101)])!;
    expect(fark.split('\n').filter(Boolean)).toHaveLength(1);
    expect(JSON.parse(fark).n).toHaveLength(2);
  });

  it('değişiklik yoksa boş', () => expect(gunlukFarki(gunlukOzeti([dizi(0, 5), []]), [dizi(0, 5), []])).toBe(''));

  it('otomatik duraklatmanın kırptığı sonu dosyada da kırpar', () => {
    // 0–9 yazıldı, ardından 6'dan sonrası kırpıldı ve 20–22 eklendi
    const d = oynat([[dizi(0, 9)], [[...dizi(0, 6), ...dizi(20, 22)]]]);
    expect(gunluguOku(d, 'k1')).toEqual([[...dizi(0, 6), ...dizi(20, 22)]]);
  });

  it('yalnızca kırpma (yeni nokta yok)', () => {
    const d = oynat([[dizi(0, 9)], [dizi(0, 4)]]);
    expect(gunluguOku(d, 'k1')).toEqual([dizi(0, 4)]);
  });

  it('duraklatma sonrası yeni (boş) parça da saklanır', () => {
    const d = oynat([[dizi(0, 3)], [dizi(0, 3), []], [dizi(0, 3), dizi(50, 52)]]);
    expect(gunluguOku(d, 'k1')).toEqual([dizi(0, 3), dizi(50, 52)]);
    expect(gunluguOku(oynat([[dizi(0, 3)], [dizi(0, 3), []]]), 'k1')).toEqual([dizi(0, 3), []]);
  });

  it('parça sayısı azalırsa dosya baştan yazılmalı', () => expect(gunlukFarki(gunlukOzeti([dizi(0, 1), dizi(5, 6)]), [dizi(0, 1)])).toBeNull());

  it('yarım yazılmış son satırı atlar', () => {
    const d = oynat([[dizi(0, 3)], [dizi(0, 6)]]);
    expect(gunluguOku(d.slice(0, -10), 'k1')).toEqual([dizi(0, 3)]);
  });

  it('aynı satır iki kez yazılsa da bozulmaz', () => {
    const fark = gunlukFarki(gunlukOzeti([dizi(0, 3)]), [dizi(0, 6)])!;
    const d = gunlukTamami('k1', [dizi(0, 3)]) + fark + fark;
    expect(gunluguOku(d, 'k1')).toEqual([dizi(0, 6)]);
  });

  it('başka kaydın dosyasını okumaz', () => {
    expect(gunluguOku(gunlukTamami('k1', [dizi(0, 3)]), 'k2')).toBeNull();
    expect(gunluguOku('', 'k1')).toBeNull();
  });

  it('eksik alanlar null olarak döner, değerler yuvarlanır', () => {
    const d = gunlukTamami('k1', [[{ t: 1, lat: 36.123456789, lng: 29.987654321 }]]);
    expect(gunluguOku(d, 'k1')).toEqual([[{ t: 1, lat: 36.1234568, lng: 29.9876543, alt: null, acc: null, speed: null }]]);
  });

  it('uzun kayıt (10 saat, saniyede bir) hızlı okunur', () => {
    let dosya = gunlukBasligi('k1');
    const seg: TrackPoint[] = [];
    let ozet = gunlukOzeti([]);
    for (let s = 0; s < 36000; s += 2) {
      seg.push(n(s), n(s + 1));
      dosya += gunlukFarki(ozet, [seg]);
      ozet = gunlukOzeti([seg]);
    }
    const t0 = Date.now();
    const geri = gunluguOku(dosya, 'k1')!;
    expect(geri[0]).toHaveLength(36000);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
