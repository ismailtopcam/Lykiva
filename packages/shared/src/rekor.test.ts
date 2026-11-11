import { describe, expect, it } from 'vitest';

import { aktivitininRekorlari, kisiselRekorlar, toplamlar, yapilanTurler, type RekorAktivitesi } from './rekor';

const gun = 86_400_000;
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

const liste = [
  a('1', { startedAt: 1 * gun, distanceM: 40_000, movingS: 7200, maxSpeedMps: 12, gainM: 300 }),
  a('2', { startedAt: 2 * gun, distanceM: 62_000, movingS: 6900, maxSpeedMps: 15, gainM: 900 }),
  a('3', { startedAt: 3 * gun, distanceM: 20_000, movingS: 9000, maxSpeedMps: 50, gainM: 100 }), // 180 km/sa: GPS hatası
  a('4', { startedAt: 4 * gun, activity: 'run', distanceM: 10_000, movingS: 3000, maxSpeedMps: 5, gainM: 50 }),
];

describe('kisiselRekorlar', () => {
  it('türe göre en büyük değerleri bulur', () => {
    const r = kisiselRekorlar(liste, 'bike');
    expect(r.mesafe?.aktivite.id).toBe('2');
    expect(r.sure?.aktivite.id).toBe('3');
    expect(r.tirmanis?.deger).toBe(900);
  });

  it('türün hız sınırının üstündeki hızı rekor saymaz', () => {
    expect(kisiselRekorlar(liste, 'bike').hiz?.aktivite.id).toBe('2');
    // Koşuda 15 m/s (54 km/sa) sınırın üstünde
    const r = kisiselRekorlar([a('k', { activity: 'run', maxSpeedMps: 15, distanceM: 1000 })], 'run');
    expect(r.hiz).toBeUndefined();
    expect(r.mesafe?.deger).toBe(1000);
  });

  it('tür verilmezse hepsine bakar', () => {
    expect(kisiselRekorlar(liste).mesafe?.aktivite.id).toBe('2');
    expect(kisiselRekorlar(liste, 'walk')).toEqual({});
  });

  it('eşitlikte eski aktivite rekoru tutar', () => {
    const r = kisiselRekorlar([a('yeni', { startedAt: 5, distanceM: 1000 }), a('eski', { startedAt: 1, distanceM: 1000 })]);
    expect(r.mesafe?.aktivite.id).toBe('eski');
  });

  it('sıfır ve boş değerler rekora girmez', () => {
    const r = kisiselRekorlar([a('x', { distanceM: 0, gainM: null, maxSpeedMps: Number.NaN })]);
    expect(r).toEqual({});
  });
});

describe('aktivitininRekorlari', () => {
  it('aktivitenin kendi türünde tuttuğu rekorları verir', () => {
    expect(aktivitininRekorlari(liste, '2')).toEqual(['mesafe', 'hiz', 'tirmanis']);
    expect(aktivitininRekorlari(liste, '3')).toEqual(['sure']);
    expect(aktivitininRekorlari(liste, '1')).toEqual([]);
  });

  it('o türde tek aktivite varsa rekor demez', () => {
    expect(aktivitininRekorlari(liste, '4')).toEqual([]);
    expect(aktivitininRekorlari(liste, 'yok')).toEqual([]);
  });
});

describe('toplamlar', () => {
  it('türe ve başlangıca göre toplar', () => {
    expect(toplamlar(liste)).toEqual({ sayi: 4, mesafeM: 132_000, sureS: 26_100, tirmanisM: 1350 });
    expect(toplamlar(liste, 'bike', 2 * gun)).toEqual({ sayi: 2, mesafeM: 82_000, sureS: 15_900, tirmanisM: 1000 });
  });
});

describe('yapilanTurler', () => {
  it('çoktan aza sıralar', () => {
    expect(yapilanTurler(liste)).toEqual(['bike', 'run']);
  });
});
