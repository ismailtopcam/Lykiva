import { describe, expect, it } from 'vitest';

import { OTO_DURAK, otoDurak, type OtoDurakDurumu, type OtoDurakOlayi } from './otoDurak';

const O = { lat: 36.2, lng: 29.6 };
const M_LAT = 1 / 111195;
/** Başlangıçtan `kuzeyM` metre kuzeyde, `s` saniyede bir nokta */
const at = (s: number, kuzeyM: number, acc: number | null = 5) => ({ t: s * 1000, lat: O.lat + kuzeyM * M_LAT, lng: O.lng, acc });

const BISIKLET = OTO_DURAK.bike;

/** Noktaları sırayla verir; olayları saniyeleriyle döner */
function oynat(noktalar: ReturnType<typeof at>[], bas: OtoDurakDurumu | null = null, ayar = BISIKLET) {
  let d = bas;
  const olaylar: NonNullable<OtoDurakOlayi>[] = [];
  for (const nokta of noktalar) {
    const r = otoDurak(d, { t: nokta.t, nokta }, ayar);
    d = r.durum;
    if (r.olay) olaylar.push(r.olay);
  }
  return { durum: d!, olaylar };
}

/** `s0`dan `s1`e saniyede bir, `hiz` m/s ile kuzeye giden noktalar */
function git(s0: number, s1: number, m0: number, hiz: number) {
  return Array.from({ length: s1 - s0 + 1 }, (_, i) => at(s0 + i, m0 + i * hiz));
}

describe('otoDurak', () => {
  it('hareket ederken duraklatmaz', () => {
    expect(oynat(git(0, 120, 0, 5)).olaylar).toHaveLength(0);
  });

  it('yavaş tırmanırken (1,2 m/s) duraklatmaz', () => {
    expect(oynat(git(0, 120, 0, 1.2)).olaylar).toHaveLength(0);
  });

  it('durunca duraklatır; duraklama durulan yere varılınca başlar', () => {
    // 30 sn gidiş (150 m), sonra yerinde 30 sn (GPS kıpırtısı ±3 m)
    const durus = Array.from({ length: 30 }, (_, i) => at(31 + i, 150 + (i % 2 ? 3 : -3)));
    const { olaylar, durum } = oynat([...git(0, 30, 0, 5), ...durus]);
    expect(olaylar).toHaveLength(1);
    expect(olaylar[0]).toMatchObject({ tur: 'duraklat' });
    const bas = (olaylar[0] as { baslangic: number }).baslangic / 1000;
    expect(bas).toBeGreaterThanOrEqual(29);
    expect(bas).toBeLessThanOrEqual(32);
    expect(durum.durdu).toBe(true);
  });

  it('yeniden hareket edince sürdürür (mola, sinyal kaybı değil)', () => {
    const durus = Array.from({ length: 60 }, (_, i) => at(31 + i, 150 + (i % 3) - 1));
    const { olaylar } = oynat([...git(0, 30, 0, 5), ...durus, ...git(91, 110, 150, 5)]);
    expect(olaylar.map((o) => o.tur)).toEqual(['duraklat', 'devam']);
    expect(olaylar[1]).toMatchObject({ sinyalKaybi: false });
  });

  it('duraklatılmışken doğruluğu kötü konumun sıçraması sürdürmez', () => {
    const { durum } = oynat([...git(0, 30, 0, 5), ...Array.from({ length: 15 }, (_, i) => at(31 + i, 150))]);
    expect(durum.durdu).toBe(true);
    // 18 m sıçrama ama doğruluk 25 m
    const r = otoDurak(durum, { t: 50_000, nokta: at(50, 168, 25) }, BISIKLET);
    expect(r.olay).toBeNull();
    expect(r.durum.durdu).toBe(true);
  });

  it('konum gelmese de süre dolunca zamanlayıcı duraklatır', () => {
    const { durum } = oynat(git(0, 30, 0, 5));
    expect(otoDurak(durum, { t: 35_000 }, BISIKLET).olay).toBeNull();
    const r = otoDurak(durum, { t: 41_000 }, BISIKLET);
    expect(r.olay).toEqual({ tur: 'duraklat', baslangic: 30_000 });
    expect(r.durum.durdu).toBe(true);
  });

  it('tünelde sinyal kesilince duraklama geri alınır', () => {
    const { durum } = oynat(git(0, 30, 0, 10));
    const d = otoDurak(durum, { t: 45_000 }, BISIKLET).durum;
    expect(d.durdu).toBe(true);
    // 60 sn sonra 600 m ötede çıkıldı
    const r = otoDurak(d, { t: 90_000, nokta: at(90, 900) }, BISIKLET);
    expect(r.olay).toEqual({ tur: 'devam', bitis: 90_000, sinyalKaybi: true });
  });

  it('arka planda hiç konum gelmeyen molayı sonradan işler', () => {
    const { durum } = oynat(git(0, 30, 0, 5));
    // 5 dk sessizlik, sonra 12 m ötede
    const r = otoDurak(durum, { t: 330_000, nokta: at(330, 162) }, BISIKLET);
    expect(r.olay).toEqual({ tur: 'mola', baslangic: 30_000, bitis: 330_000 });
    expect(r.durum.durdu).toBe(false);
  });

  it('arka planda uzun boşluktan sonra durulan yerde gelen konum duraklatır', () => {
    const { durum } = oynat(git(0, 30, 0, 5));
    const r = otoDurak(durum, { t: 330_000, nokta: at(330, 154) }, BISIKLET);
    expect(r.olay).toEqual({ tur: 'duraklat', baslangic: 30_000 });
  });

  it('doğa yürüyüşünde daha uzun bekler', () => {
    const durus = Array.from({ length: 15 }, (_, i) => at(31 + i, 45));
    expect(oynat([...git(0, 30, 0, 1.5), ...durus], null, OTO_DURAK.hike).olaylar).toHaveLength(0);
    expect(oynat([...git(0, 30, 0, 1.5), ...durus], null, OTO_DURAK.bike).olaylar).toHaveLength(1);
  });
});
