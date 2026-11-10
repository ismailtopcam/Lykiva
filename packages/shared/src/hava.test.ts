import { describe, expect, it } from 'vitest';

import { gidisYonu, havaAyrintilari, havaOzeti, hissedilenSicaklik, izdeRuzgar, metYanitindanHava, ruzgarEtkisi, ruzgarMetni, sembolMetni, yonAdi, type MetYaniti } from './hava';

/** api.met.no locationforecast/2.0/compact yanıtının kısaltılmış biçimi */
const ornekYanit: MetYaniti = {
  properties: {
    timeseries: [
      {
        time: '2026-11-11T06:00:00Z',
        data: {
          instant: { details: { air_temperature: 14.2, wind_speed: 3.9, wind_from_direction: 271.3, relative_humidity: 62.1, ultraviolet_index_clear_sky: 0.4 } },
          next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 0 } },
        },
      },
      {
        time: '2026-11-11T07:00:00Z',
        data: {
          instant: { details: { air_temperature: 16.0, wind_speed: 5.1, wind_from_direction: 250, relative_humidity: 55 } },
          next_1_hours: { summary: { symbol_code: 'lightrainshowersandthunder_day' }, details: { precipitation_amount: 0.6 } },
        },
      },
    ],
  },
};

describe('hissedilen sıcaklık', () => {
  it('rüzgâr serinletir, nem ısıtır', () => {
    expect(hissedilenSicaklik(20, 50, 0)).toBeGreaterThan(hissedilenSicaklik(20, 50, 8));
    expect(hissedilenSicaklik(30, 80, 1)).toBeGreaterThan(hissedilenSicaklik(30, 30, 1));
  });
  it('bilinen değer: 25°C, %60, 2 m/s ≈ 25,6°C', () => {
    // e = 0,6 · 6,105 · exp(17,27·25/262,7) ≈ 19,02 → 25 + 6,28 − 1,4 − 4 ≈ 25,9
    expect(hissedilenSicaklik(25, 60, 2)).toBeCloseTo(25.9, 0);
  });
});

describe('MET yanıtı', () => {
  it('istenen zamana en yakın dilimi alır ve alanları çevirir', () => {
    const h = metYanitindanHava(ornekYanit, new Date('2026-11-11T06:10:00Z'))!;
    expect(h).toMatchObject({ t: '2026-11-11T06:00:00Z', sicaklik: 14.2, ruzgar: 3.9, ruzgarYon: 271, nem: 62, yagis: 0, uv: 0.4, sembol: 'partlycloudy_day', kaynak: 'met.no' });
    expect(h.hissedilen).not.toBeNull();
    expect(metYanitindanHava(ornekYanit, new Date('2026-11-11T06:50:00Z'))!.t).toBe('2026-11-11T07:00:00Z');
  });
  it('boş ya da eksik yanıt: null', () => {
    expect(metYanitindanHava({})).toBeNull();
    expect(metYanitindanHava({ properties: { timeseries: [{ time: '2026-11-11T06:00:00Z', data: { instant: { details: { air_temperature: 10 } } } }] } })).toBeNull();
  });
});

describe('yön ve rüzgâr', () => {
  it('yön adları', () => {
    expect(yonAdi(0)).toBe('kuzey');
    expect(yonAdi(271)).toBe('batı');
    expect(yonAdi(359)).toBe('kuzey');
    expect(yonAdi(-45)).toBe('kuzeybatı');
    expect(yonAdi(135)).toBe('güneydoğu');
  });
  it('gidiş yönü: kuzeye ≈ 0, doğuya ≈ 90', () => {
    expect(gidisYonu({ lat: 36, lng: 29 }, { lat: 36.01, lng: 29 })).toBeCloseTo(0, 0);
    expect(gidisYonu({ lat: 36, lng: 29 }, { lat: 36, lng: 29.01 })).toBeCloseTo(90, 0);
  });
  it('rüzgâr etkisi: kuzeye giderken kuzeyden esen rüzgâr karşıdan', () => {
    expect(ruzgarEtkisi(0, 0)).toBe('karşıdan');
    expect(ruzgarEtkisi(0, 180)).toBe('arkadan');
    expect(ruzgarEtkisi(0, 90)).toBe('yandan');
    expect(ruzgarEtkisi(350, 20)).toBe('karşıdan');
    expect(ruzgarEtkisi(90, 260)).toBe('arkadan');
  });
  it('iz boyunca: doğuya giden izde batı rüzgârı çoğunlukla arkadan', () => {
    const iz = Array.from({ length: 11 }, (_, i) => ({ lat: 36.2, lng: 29.6 + i * 0.001 }));
    const r = izdeRuzgar(iz, 270);
    expect(r.baskin).toBe('arkadan');
    expect(r.arkadan).toBeCloseTo(1, 5);
    // Gidiş-dönüş: yarısı karşıdan yarısı arkadan → baskın yok
    const gidisDonus = [...iz, ...iz.slice().reverse()];
    const r2 = izdeRuzgar(gidisDonus, 270);
    expect(r2.baskin).toBeNull();
  });
});

describe('metinler', () => {
  it('sembol Türkçesi', () => {
    expect(sembolMetni('partlycloudy_day')).toBe('Parçalı bulutlu');
    expect(sembolMetni('clearsky_night')).toBe('Açık');
    expect(sembolMetni('lightrainshowersandthunder_day')).toBe('Hafif sağanak ve gök gürültüsü');
    expect(sembolMetni('heavysnow')).toBe('Yoğun karlı');
    expect(sembolMetni('bilinmeyen')).toBeNull();
    expect(sembolMetni(null)).toBeNull();
  });
  it('özet, rüzgâr ve ayrıntılar', () => {
    const h = metYanitindanHava(ornekYanit, new Date('2026-11-11T07:00:00Z'))!;
    expect(havaOzeti(h)).toBe('16°C · Hafif sağanak ve gök gürültüsü');
    expect(ruzgarMetni(h)).toBe('18 km/sa batı rüzgârı');
    expect(ruzgarMetni({ ...h, ruzgar: 0.2 })).toBe('Rüzgârsız');
    const iz = Array.from({ length: 11 }, (_, i) => ({ lat: 36.2, lng: 29.6 - i * 0.001 })); // batıya
    const satirlar = Object.fromEntries(havaAyrintilari(h, iz));
    expect(satirlar['Rüzgâr']).toBe('18 km/sa batı rüzgârı · çoğunlukla karşıdan');
    expect(satirlar['Yağış']).toBe('0,6 mm/sa');
    expect(satirlar['Nem']).toBe('%55');
  });
});
