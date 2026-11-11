import { describe, expect, it } from 'vitest';

import type { RekorAktivitesi } from './rekor';
import { aktivitininRozetleri, rozetDurumlari, ROZETLER, sonKazanilanlar, type RozetDurumu } from './rozet';

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
const t = (ay: number, gun: number, saat = 9) => new Date(2026, ay, gun, saat).getTime();
const bul = (d: RozetDurumu[], id: string) => d.find((x) => x.tanim.id === id)!;

describe('rozet tanımları', () => {
  it('kimlikler tekil', () => {
    expect(new Set(ROZETLER.map((r) => r.id)).size).toBe(ROZETLER.length);
  });
});

describe('rozetDurumlari', () => {
  it('aktivite yoksa hiçbiri kazanılmadı', () => {
    const d = rozetDurumlari([]);
    expect(d.every((x) => !x.kazanildi && x.deger === 0)).toBe(true);
  });

  it('ilk adım: en eski aktivite kazandırır (liste sırası önemsiz)', () => {
    const d = rozetDurumlari([a('yeni', { startedAt: t(10, 5) }), a('eski', { startedAt: t(10, 1) })]);
    expect(bul(d, 'ilk_adim')).toMatchObject({ kazanildi: true, aktiviteId: 'eski', tarih: t(10, 1) });
  });

  it('toplam mesafe: eşiği geçiren aktivite', () => {
    const liste = [
      a('1', { startedAt: t(9, 1), distanceM: 40_000 }),
      a('2', { startedAt: t(9, 8), distanceM: 50_000 }),
      a('3', { startedAt: t(9, 15), distanceM: 20_000 }),
    ];
    const m = bul(rozetDurumlari(liste), 'mesafe_100');
    expect(m.kazanildi).toBe(true);
    expect(m.aktiviteId).toBe('3');
    expect(m.deger).toBe(110_000);
    expect(bul(rozetDurumlari(liste), 'mesafe_500')).toMatchObject({ kazanildi: false, deger: 110_000 });
  });

  it('tek aktivite: yarı maraton yalnızca koşuda; en iyi değer ilerleme olarak döner', () => {
    const liste = [
      a('b', { startedAt: t(9, 1), activity: 'bike', distanceM: 30_000, movingS: 3600 }),
      a('k1', { startedAt: t(9, 2), activity: 'run', distanceM: 15_000, movingS: 5400 }),
      a('k2', { startedAt: t(9, 3), activity: 'trail_run', distanceM: 21_500, movingS: 9000 }),
    ];
    const d = rozetDurumlari(liste);
    expect(bul(d, 'yari_maraton')).toMatchObject({ kazanildi: true, aktiviteId: 'k2' });
    expect(bul(d, 'kosu_10')).toMatchObject({ kazanildi: true, aktiviteId: 'k1' });
    expect(bul(d, 'maraton')).toMatchObject({ kazanildi: false, deger: 21_500 });
    expect(bul(d, 'bisiklet_50')).toMatchObject({ kazanildi: false, deger: 30_000 });
  });

  it('araçta unutulan kayıt tek aktivite rozeti kazandırmaz (koşu, ort. 60 km/sa)', () => {
    const d = rozetDurumlari([a('araba', { activity: 'run', startedAt: t(9, 1), distanceM: 45_000, movingS: 2700 })]);
    expect(bul(d, 'maraton').kazanildi).toBe(false);
    // Toplamlara yine girer (kişisel rekorlardaki mesafe kuralıyla aynı)
    expect(bul(d, 'ilk_adim').kazanildi).toBe(true);
  });

  it('seri: üst üste haftalar; ara verince baştan; aynı hafta iki kez sayılmaz', () => {
    // Kasım 2026: 2 (Pzt), 9, 16, 23 → 4 hafta; araya bir hafta boşluk sonra 7 Aralık
    const liste = [
      a('1', { startedAt: t(10, 2) }),
      a('1b', { startedAt: t(10, 4) }),
      a('2', { startedAt: t(10, 15, 20) }), // pazar: 9–15 haftası
      a('3', { startedAt: t(10, 16) }),
      a('4', { startedAt: t(10, 23) }),
      a('5', { startedAt: t(11, 7) }),
    ];
    const s = bul(rozetDurumlari(liste), 'seri_4');
    expect(s).toMatchObject({ kazanildi: true, aktiviteId: '4', deger: 4 });
    const kisa = bul(rozetDurumlari([a('1', { startedAt: t(10, 2) }), a('2', { startedAt: t(10, 16) })]), 'seri_4');
    expect(kisa).toMatchObject({ kazanildi: false, deger: 1 });
  });

  it('erken kuş: 4:00–6:59', () => {
    expect(bul(rozetDurumlari([a('gece', { startedAt: t(9, 1, 3) }), a('aksam', { startedAt: t(9, 1, 19) })]), 'erken_kus').kazanildi).toBe(false);
    expect(bul(rozetDurumlari([a('sabah', { startedAt: t(9, 1, 6) })]), 'erken_kus')).toMatchObject({ kazanildi: true, aktiviteId: 'sabah' });
  });

  it('çok yönlü: üçüncü farklı tür', () => {
    const d = rozetDurumlari([
      a('1', { startedAt: t(9, 1), activity: 'bike' }),
      a('2', { startedAt: t(9, 2), activity: 'bike' }),
      a('3', { startedAt: t(9, 3), activity: 'run' }),
      a('4', { startedAt: t(9, 4), activity: 'hike' }),
    ]);
    expect(bul(d, 'cok_yonlu')).toMatchObject({ kazanildi: true, aktiviteId: '4', deger: 3 });
  });

  it('meydan okuma rozetleri', () => {
    const d = rozetDurumlari([], [
      { id: 'm2', tarih: t(9, 20) },
      { id: 'm1', tarih: t(9, 10) },
    ]);
    expect(bul(d, 'meydan_1')).toMatchObject({ kazanildi: true, tarih: t(9, 10), aktiviteId: null });
    expect(bul(d, 'meydan_5')).toMatchObject({ kazanildi: false, deger: 2 });
  });

  it('aktivitenin kazandırdıkları ve son kazanılanlar', () => {
    const d = rozetDurumlari([a('1', { startedAt: t(9, 1, 5), distanceM: 120_000, movingS: 18_000 })]);
    expect(aktivitininRozetleri(d, '1').map((x) => x.tanim.id)).toEqual(['ilk_adim', 'mesafe_100', 'bisiklet_50', 'bisiklet_100', 'erken_kus']);
    expect(sonKazanilanlar(d).length).toBe(5);
  });
});
