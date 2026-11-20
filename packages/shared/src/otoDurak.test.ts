import { describe, expect, it } from 'vitest';

import { OTO_DURAK, otoDurak, type OtoDurakAyari, type OtoDurakDurumu, type OtoDurakOlayi } from './otoDurak';

const O = { lat: 36.2, lng: 29.6 };
const M_LAT = 1 / 111195;
/** `s`. saniyede, başlangıçtan `kuzeyM` metre kuzeyde; `speed` cihaz hızı (null: yok) */
const at = (s: number, kuzeyM: number, speed: number | null = null, acc: number | null = 5) => ({ t: s * 1000, lat: O.lat + kuzeyM * M_LAT, lng: O.lng, speed, acc });
type Nokta = ReturnType<typeof at>;

const BISIKLET = OTO_DURAK.bike;

/** Noktaları sırayla verir; olayları döner */
function oynat(noktalar: Nokta[], bas: OtoDurakDurumu | null = null, ayar: OtoDurakAyari = BISIKLET) {
  let d = bas;
  const olaylar: NonNullable<OtoDurakOlayi>[] = [];
  for (const nokta of noktalar) {
    const r = otoDurak(d, { t: nokta.t, nokta }, ayar);
    d = r.durum;
    if (r.olay) olaylar.push(r.olay);
  }
  return { durum: d!, olaylar };
}

/** `s0`dan `s1`e saniyede bir, `hiz` m/s ile kuzeye giden noktalar (cihaz hızı da `hiz`, `hizsiz` ise yok) */
function git(s0: number, s1: number, m0: number, hiz: number, hizsiz = false) {
  return Array.from({ length: s1 - s0 + 1 }, (_, i) => at(s0 + i, m0 + i * hiz, hizsiz ? null : hiz));
}

/** `s0`dan itibaren `n` saniye yerinde (±kipirti m GPS kıpırtısı, cihaz hızı `hiz`) */
function dur(s0: number, n: number, m: number, kipirti = 3, hiz: number | null = 0.2) {
  return Array.from({ length: n }, (_, i) => at(s0 + i, m + (i % 2 ? kipirti : -kipirti), hiz));
}

describe('otoDurak', () => {
  it('hareket ederken duraklatmaz', () => {
    expect(oynat(git(0, 120, 0, 5)).olaylar).toHaveLength(0);
  });

  it('bisiklette yavaş tırmanırken (1,2 m/s) duraklatmaz', () => {
    expect(oynat(git(0, 120, 0, 1.2)).olaylar).toHaveLength(0);
  });

  it('cihaz hızı duruyor deyince ~5 sn’de duraklatır, kıpırtı yarıçapı aşsa da', () => {
    // 30 sn gidiş (150 m), sonra yerinde; GPS kıpırtısı ±7 m (14 m sıçrama)
    const { olaylar, durum } = oynat([...git(0, 30, 0, 5), ...dur(31, 10, 150, 7)]);
    expect(olaylar).toEqual([{ tur: 'duraklat', baslangic: 31_000 }]);
    expect(durum.durdu).toBe(true);
  });

  it('hareket edince ilk hızlı konumun anından sürdürür', () => {
    const { olaylar } = oynat([...git(0, 30, 0, 5), ...dur(31, 30, 150), ...git(61, 70, 152, 4)]);
    expect(olaylar.map((o) => o.tur)).toEqual(['duraklat', 'devam']);
    expect(olaylar[1]).toEqual({ tur: 'devam', bitis: 61_000, sinyalKaybi: false });
  });

  it('kırmızı ışıkta kısa bekleme mola sayılır, sinyal kaybı sayılmaz', () => {
    const { olaylar } = oynat([...git(0, 30, 0, 6), ...dur(31, 7, 180), ...git(38, 45, 181, 6)]);
    expect(olaylar.map((o) => o.tur)).toEqual(['duraklat', 'devam']);
    expect(olaylar[1]).toMatchObject({ sinyalKaybi: false });
  });

  it('duraklatılmışken tek bir hız sıçraması sürdürmez', () => {
    const { durum } = oynat([...git(0, 30, 0, 5), ...dur(31, 10, 150)]);
    const r = otoDurak(durum, { t: 41_000, nokta: at(41, 151, 3) }, BISIKLET);
    expect(r.olay).toBeNull();
    const r2 = otoDurak(r.durum, { t: 42_000, nokta: at(42, 150, 0.1) }, BISIKLET);
    expect(r2.olay).toBeNull();
    expect(r2.durum.durdu).toBe(true);
  });

  it('duraklatılmışken doğruluğu kötü konumun sıçraması sürdürmez', () => {
    const { durum } = oynat([...git(0, 30, 0, 5), ...dur(31, 10, 150)]);
    // 18 m sıçrama ama doğruluk 25 m, cihaz hızı düşük
    const r = otoDurak(durum, { t: 45_000, nokta: at(45, 168, 0.3, 25) }, BISIKLET);
    expect(r.olay).toBeNull();
  });

  it('cihaz hızı yoksa konuma bakar (bisiklet: 8 m içinde 8 sn)', () => {
    const durus = Array.from({ length: 12 }, (_, i) => at(31 + i, 150 + (i % 2 ? 2 : -2)));
    const { olaylar } = oynat([...git(0, 30, 0, 5, true), ...durus]);
    expect(olaylar).toHaveLength(1);
    expect(olaylar[0].tur).toBe('duraklat');
  });

  it('konum gelmese de zamanlayıcı son konumda duraklatır', () => {
    const { durum } = oynat(git(0, 30, 0, 5));
    expect(otoDurak(durum, { t: 33_000 }, BISIKLET).olay).toBeNull();
    const r = otoDurak(durum, { t: 35_000 }, BISIKLET);
    expect(r.olay).toEqual({ tur: 'duraklat', baslangic: 30_000 });
    expect(r.durum.durdu).toBe(true);
  });

  it('tünelde sinyal kesilince duraklama geri alınır', () => {
    const { durum } = oynat(git(0, 30, 0, 10));
    const d = otoDurak(durum, { t: 40_000 }, BISIKLET).durum;
    expect(d.durdu).toBe(true);
    // 60 sn sonra 600 m ötede çıkıldı
    const r = otoDurak(d, { t: 90_000, nokta: at(90, 900, 10) }, BISIKLET);
    expect(r.olay).toEqual({ tur: 'devam', bitis: 90_000, sinyalKaybi: true });
  });

  it('arka planda hiç konum gelmeyen molayı sonradan işler', () => {
    const { durum } = oynat(git(0, 30, 0, 5));
    // 5 dk sessizlik, sonra 3 m ötede ve hareket hâlinde
    const r = otoDurak(durum, { t: 330_000, nokta: at(330, 153, 4) }, BISIKLET);
    expect(r.olay).toEqual({ tur: 'mola', baslangic: 30_000, bitis: 330_000 });
    expect(r.durum.durdu).toBe(false);
  });

  it('arka planda uzun boşluktan sonra hâlâ duruyorsa duraklatır', () => {
    const { durum } = oynat(git(0, 30, 0, 5));
    const r = otoDurak(durum, { t: 330_000, nokta: at(330, 151, 0) }, BISIKLET);
    expect(r.olay).toEqual({ tur: 'duraklat', baslangic: 30_000 });
  });

  it('doğa yürüyüşünde yavaş çıkışta (0,6 m/s) duraklatmaz, daha uzun bekler', () => {
    expect(oynat(git(0, 120, 0, 0.6), null, OTO_DURAK.hike).olaylar).toHaveLength(0);
    const kisa = [...git(0, 30, 0, 1.2), ...dur(31, 7, 36)];
    expect(oynat(kisa, null, OTO_DURAK.hike).olaylar).toHaveLength(0);
    expect(oynat(kisa, null, BISIKLET).olaylar).toHaveLength(1);
  });

  it('eski sürümden kalan durumla çalışır', () => {
    const eski = { capa: { t: 30_000, lat: O.lat, lng: O.lng }, son: { t: 30_000, lat: O.lat, lng: O.lng }, durdu: false };
    expect(otoDurak(eski, { t: 36_000 }, BISIKLET).olay).toEqual({ tur: 'duraklat', baslangic: 30_000 });
  });
});
