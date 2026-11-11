import { afterEach, describe, expect, it } from 'vitest';

import { ACTIVITY_LABELS, activityLabel } from './activity';
import { acceptLanguage, aktifDiliAyarla, dilSec, doldur } from './dil';
import { formatGrade } from './egim';
import { formatKm, formatPercent, speedUnit } from './format';
import { havaAyrintilari, ruzgarMetni, sembolMetni, type HavaDurumu } from './hava';

afterEach(() => aktifDiliAyarla('tr'));

describe('dilSec', () => {
  it('cihaz yerel ayarından', () => {
    expect(dilSec('de-AT')).toBe('de');
    expect(dilSec('en_US')).toBe('en');
    expect(dilSec('tr')).toBe('tr');
  });
  it('desteklenmeyen dil İngilizceye düşer', () => {
    expect(dilSec('fr-FR')).toBe('en');
    expect(dilSec(null)).toBe('en');
  });
  it('listeden ilk desteklenen', () => expect(dilSec(['fr-FR', 'de-DE', 'en'])).toBe('de'));
});

describe('acceptLanguage', () => {
  it('q sırasıyla', () => {
    expect(acceptLanguage('en;q=0.5, de-DE, tr;q=0.8')).toEqual(['de-DE', 'tr', 'en']);
    expect(acceptLanguage(null)).toEqual([]);
  });
});

describe('doldur', () => {
  it('değişkenler', () => expect(doldur('{n} kişi, {ad}', { n: 3, ad: 'Ayşe' })).toBe('3 kişi, Ayşe'));
  it('çoğul', () => {
    expect(doldur('{n} person|{n} people', { n: 1 })).toBe('1 person');
    expect(doldur('{n} person|{n} people', { n: 4 })).toBe('4 people');
    expect(doldur('{n} kişi', { n: 1 })).toBe('1 kişi');
  });
  it('eksik değişken olduğu gibi kalır', () => expect(doldur('{a} ve {b}', { a: 1 })).toBe('1 ve {b}'));
});

describe('dile göre etiketler ve biçimler', () => {
  it('aktif dil değişince tablo da değişir', () => {
    expect(ACTIVITY_LABELS.hike).toBe('Doğa yürüyüşü');
    aktifDiliAyarla('en');
    expect(ACTIVITY_LABELS.hike).toBe('Hiking');
    aktifDiliAyarla('de');
    expect(ACTIVITY_LABELS.hike).toBe('Wandern');
  });
  it('web için dil açıkça verilir', () => expect(activityLabel('bike', 'en')).toBe('Cycling'));
  it('ondalık ayırıcı', () => {
    expect(formatKm(27400, 'tr')).toBe('27,4');
    expect(formatKm(27400, 'en')).toBe('27.4');
    expect(formatKm(27400, 'de')).toBe('27,4');
  });
  it('yüzde, eğim, hız birimi', () => {
    expect(formatPercent(62, 'tr')).toBe('%62');
    expect(formatPercent(62, 'en')).toBe('62%');
    expect(formatGrade(7.46, 'en')).toBe('7.5%');
    expect(formatGrade(-5, 'de')).toBe('5 %');
    expect(speedUnit('tr')).toBe('km/sa');
    expect(speedUnit('de')).toBe('km/h');
  });
});

describe('Rusça', () => {
  const s = '{n} комментарий|{n} комментария|{n} комментариев';
  it('üç biçimli çoğul', () => {
    expect(doldur(s, { n: 1 })).toBe('1 комментарий');
    expect(doldur(s, { n: 3 })).toBe('3 комментария');
    expect(doldur(s, { n: 5 })).toBe('5 комментариев');
    expect(doldur(s, { n: 11 })).toBe('11 комментариев');
    expect(doldur(s, { n: 21 })).toBe('21 комментарий');
    expect(doldur(s, { n: 22 })).toBe('22 комментария');
    expect(doldur(s, { n: 0 })).toBe('0 комментариев');
  });
  it('cihaz dili ve biçimler', () => {
    expect(dilSec('ru-RU')).toBe('ru');
    expect(formatKm(27400, 'ru')).toBe('27,4');
    expect(formatPercent(62, 'ru')).toBe('62 %');
    expect(speedUnit('ru')).toBe('км/ч');
    expect(activityLabel('hike', 'ru')).toBe('Пеший поход');
  });
  it('hava', () => {
    const h = { t: '2026-11-11T08:00:00Z', sicaklik: 18, ruzgar: 4, ruzgarYon: 270, sembol: 'rain_day' } as HavaDurumu;
    expect(ruzgarMetni(h, 'ru')).toBe('западный ветер, 14 км/ч');
    expect(sembolMetni(h.sembol, 'ru')).toBe('Дождь');
  });
});

describe('hava metinleri', () => {
  const h: HavaDurumu = { t: '2026-11-11T08:00:00Z', sicaklik: 18, ruzgar: 4, ruzgarYon: 270, sembol: 'lightrainshowersandthunder_day', nem: 62 } as HavaDurumu;
  it('sembol', () => {
    expect(sembolMetni(h.sembol, 'tr')).toBe('Hafif sağanak ve gök gürültüsü');
    expect(sembolMetni(h.sembol, 'en')).toBe('Light showers with thunder');
    expect(sembolMetni('bilinmeyen', 'en')).toBeNull();
  });
  it('rüzgâr', () => {
    expect(ruzgarMetni(h, 'tr')).toBe('14 km/sa batı rüzgârı');
    expect(ruzgarMetni(h, 'en')).toBe('14 km/h wind from the west');
    expect(ruzgarMetni(h, 'de')).toBe('14 km/h Wind aus West');
  });
  it('ayrıntılar', () => {
    const en = havaAyrintilari(h, undefined, 'en');
    expect(en[0]).toEqual(['Temperature', '18°C']);
    expect(en.find((s) => s[0] === 'Humidity')?.[1]).toBe('62%');
  });
});
