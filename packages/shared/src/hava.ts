/**
 * Hava durumu: MET Norway (api.met.no, locationforecast 2.0 compact) yanıtını çözer ve yorumlar.
 * Servis seçimi: anahtarsız, ticari kullanım dahil ücretsiz (CC BY 4.0; uygulamada "Kaynak: MET Norway" yazılır).
 * Ağ isteği burada değil, uygulamada yapılır (apps/mobile/src/lib/hava.ts).
 */
import { aktifDil, doldur, type Dil } from './dil';
import { formatDecimal, formatPercent, speedUnit } from './format';
import { haversine } from './track';

/** Aktiviteyle saklanan hava bilgisi (activities.weather) */
export type HavaDurumu = {
  /** Ölçüm / tahmin zamanı (ISO) */
  t: string;
  /** °C */
  sicaklik: number;
  /** Hissedilen (°C), nem ve rüzgârdan hesaplanır */
  hissedilen: number | null;
  /** Rüzgâr hızı (m/s) */
  ruzgar: number;
  /** Rüzgârın geldiği yön (derece, 0 = kuzeyden) */
  ruzgarYon: number;
  /** Bağıl nem (%) */
  nem: number | null;
  /** Önümüzdeki 1 saatte yağış (mm) */
  yagis: number | null;
  /** UV indeksi (açık gökyüzü) */
  uv: number | null;
  /** MET sembol kodu (ör. "partlycloudy_day") */
  sembol: string | null;
  kaynak: 'met.no';
};

type MetZamanDilimi = {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature?: number;
        wind_speed?: number;
        wind_from_direction?: number;
        relative_humidity?: number;
        ultraviolet_index_clear_sky?: number;
      };
    };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
    next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
  };
};

export type MetYaniti = { properties?: { timeseries?: MetZamanDilimi[] } };

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Hissedilen sıcaklık (Avustralya Meteoroloji Bürosu "apparent temperature" formülü; güneş ışınımı hariç).
 * AT = Ta + 0,33·e − 0,70·v − 4,00, e = nem/100 · 6,105 · exp(17,27·Ta / (237,7 + Ta))
 */
export function hissedilenSicaklik(sicaklik: number, nem: number, ruzgarMps: number): number {
  const e = (nem / 100) * 6.105 * Math.exp((17.27 * sicaklik) / (237.7 + sicaklik));
  return r1(sicaklik + 0.33 * e - 0.7 * ruzgarMps - 4.0);
}

/** MET yanıtından, verilen zamana (yoksa ilk dilime) en yakın dilimi alır */
export function metYanitindanHava(yanit: MetYaniti, hedef: Date = new Date()): HavaDurumu | null {
  const dilimler = yanit.properties?.timeseries ?? [];
  if (!dilimler.length) return null;
  const h = hedef.getTime();
  let en = dilimler[0];
  for (const d of dilimler) if (Math.abs(Date.parse(d.time) - h) < Math.abs(Date.parse(en.time) - h)) en = d;
  const i = en.data.instant.details;
  if (i.air_temperature == null || i.wind_speed == null || i.wind_from_direction == null) return null;
  const sonraki = en.data.next_1_hours ?? en.data.next_6_hours;
  return {
    t: en.time,
    sicaklik: r1(i.air_temperature),
    hissedilen: i.relative_humidity == null ? null : hissedilenSicaklik(i.air_temperature, i.relative_humidity, i.wind_speed),
    ruzgar: r1(i.wind_speed),
    ruzgarYon: Math.round(i.wind_from_direction) % 360,
    nem: i.relative_humidity == null ? null : Math.round(i.relative_humidity),
    yagis: sonraki?.details?.precipitation_amount ?? null,
    uv: i.ultraviolet_index_clear_sky == null ? null : r1(i.ultraviolet_index_clear_sky),
    sembol: sonraki?.summary?.symbol_code ?? null,
    kaynak: 'met.no',
  };
}

/** MET aynı tahminin bu kadar ileriye kadar dilimlerini verir; daha uzak tarih için tahmin gösterilmez */
export const TAHMIN_UFKU_GUN = 9;

const YONLER: Record<Dil, readonly string[]> = {
  tr: ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'],
  en: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
  de: ['Nord', 'Nordost', 'Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest'],
  // Rusçada sıfat biçimi: "западный ветер"
  ru: ['северный', 'северо-восточный', 'восточный', 'юго-восточный', 'южный', 'юго-западный', 'западный', 'северо-западный'],
};
const YON_KISA: Record<Dil, readonly string[]> = {
  tr: ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  de: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
  ru: ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'],
};
const yonIndisi = (derece: number) => Math.round((((derece % 360) + 360) % 360) / 45) % 8;

/** Rüzgârın geldiği yönün adı: 270 → "batı" */
export function yonAdi(derece: number, dil: Dil = aktifDil()): string {
  return YONLER[dil][yonIndisi(derece)];
}
export function yonKisa(derece: number, dil: Dil = aktifDil()): string {
  return YON_KISA[dil][yonIndisi(derece)];
}

/** Hava metinleri */
const HAVA_SOZLUK: Record<Dil, Record<string, string>> = {
  tr: {
    gok: ' ve gök gürültüsü',
    ruzgarsiz: 'Rüzgârsız',
    ruzgar: '{hiz} {birim} {yon} rüzgârı',
    sicaklik: 'Sıcaklık',
    hissedilen: 'Hissedilen',
    ruzgarEtiket: 'Rüzgâr',
    nem: 'Nem',
    yagis: 'Yağış',
    mmsa: 'mm/sa',
    karşıdan: 'çoğunlukla karşıdan',
    arkadan: 'çoğunlukla arkadan',
    yandan: 'çoğunlukla yandan',
  },
  en: {
    gok: ' with thunder',
    ruzgarsiz: 'Calm',
    ruzgar: '{hiz} {birim} wind from the {yon}',
    sicaklik: 'Temperature',
    hissedilen: 'Feels like',
    ruzgarEtiket: 'Wind',
    nem: 'Humidity',
    yagis: 'Precipitation',
    mmsa: 'mm/h',
    karşıdan: 'mostly headwind',
    arkadan: 'mostly tailwind',
    yandan: 'mostly crosswind',
  },
  de: {
    gok: ' mit Gewitter',
    ruzgarsiz: 'Windstill',
    ruzgar: '{hiz} {birim} Wind aus {yon}',
    sicaklik: 'Temperatur',
    hissedilen: 'Gefühlt',
    ruzgarEtiket: 'Wind',
    nem: 'Luftfeuchtigkeit',
    yagis: 'Niederschlag',
    mmsa: 'mm/h',
    karşıdan: 'meist Gegenwind',
    arkadan: 'meist Rückenwind',
    yandan: 'meist Seitenwind',
  },
  ru: {
    gok: ' с грозой',
    ruzgarsiz: 'Безветренно',
    ruzgar: '{yon} ветер, {hiz} {birim}',
    sicaklik: 'Температура',
    hissedilen: 'Ощущается как',
    ruzgarEtiket: 'Ветер',
    nem: 'Влажность',
    yagis: 'Осадки',
    mmsa: 'мм/ч',
    karşıdan: 'в основном встречный',
    arkadan: 'в основном попутный',
    yandan: 'в основном боковой',
  },
};

/** MET sembol kodlarının adları */
const SEMBOLLER: Record<Dil, Record<string, string>> = {
  tr: {
    clearsky: 'Açık',
    fair: 'Az bulutlu',
    partlycloudy: 'Parçalı bulutlu',
    cloudy: 'Bulutlu',
    fog: 'Sisli',
    lightrain: 'Hafif yağmurlu',
    rain: 'Yağmurlu',
    heavyrain: 'Kuvvetli yağmurlu',
    lightrainshowers: 'Hafif sağanak',
    rainshowers: 'Sağanak',
    heavyrainshowers: 'Kuvvetli sağanak',
    lightsleet: 'Hafif karla karışık yağmur',
    sleet: 'Karla karışık yağmur',
    heavysleet: 'Kuvvetli karla karışık yağmur',
    lightsleetshowers: 'Hafif karla karışık sağanak',
    sleetshowers: 'Karla karışık sağanak',
    heavysleetshowers: 'Kuvvetli karla karışık sağanak',
    lightsnow: 'Hafif karlı',
    snow: 'Karlı',
    heavysnow: 'Yoğun karlı',
    lightsnowshowers: 'Hafif kar sağanağı',
    snowshowers: 'Kar sağanağı',
    heavysnowshowers: 'Yoğun kar sağanağı',
  },
  en: {
    clearsky: 'Clear',
    fair: 'Fair',
    partlycloudy: 'Partly cloudy',
    cloudy: 'Cloudy',
    fog: 'Fog',
    lightrain: 'Light rain',
    rain: 'Rain',
    heavyrain: 'Heavy rain',
    lightrainshowers: 'Light showers',
    rainshowers: 'Showers',
    heavyrainshowers: 'Heavy showers',
    lightsleet: 'Light sleet',
    sleet: 'Sleet',
    heavysleet: 'Heavy sleet',
    lightsleetshowers: 'Light sleet showers',
    sleetshowers: 'Sleet showers',
    heavysleetshowers: 'Heavy sleet showers',
    lightsnow: 'Light snow',
    snow: 'Snow',
    heavysnow: 'Heavy snow',
    lightsnowshowers: 'Light snow showers',
    snowshowers: 'Snow showers',
    heavysnowshowers: 'Heavy snow showers',
  },
  de: {
    clearsky: 'Klar',
    fair: 'Heiter',
    partlycloudy: 'Teilweise bewölkt',
    cloudy: 'Bewölkt',
    fog: 'Nebel',
    lightrain: 'Leichter Regen',
    rain: 'Regen',
    heavyrain: 'Starker Regen',
    lightrainshowers: 'Leichte Schauer',
    rainshowers: 'Schauer',
    heavyrainshowers: 'Starke Schauer',
    lightsleet: 'Leichter Schneeregen',
    sleet: 'Schneeregen',
    heavysleet: 'Starker Schneeregen',
    lightsleetshowers: 'Leichte Schneeregenschauer',
    sleetshowers: 'Schneeregenschauer',
    heavysleetshowers: 'Starke Schneeregenschauer',
    lightsnow: 'Leichter Schneefall',
    snow: 'Schneefall',
    heavysnow: 'Starker Schneefall',
    lightsnowshowers: 'Leichte Schneeschauer',
    snowshowers: 'Schneeschauer',
    heavysnowshowers: 'Starke Schneeschauer',
  },
  ru: {
    clearsky: 'Ясно',
    fair: 'Малооблачно',
    partlycloudy: 'Переменная облачность',
    cloudy: 'Облачно',
    fog: 'Туман',
    lightrain: 'Небольшой дождь',
    rain: 'Дождь',
    heavyrain: 'Сильный дождь',
    lightrainshowers: 'Небольшой ливень',
    rainshowers: 'Ливень',
    heavyrainshowers: 'Сильный ливень',
    lightsleet: 'Небольшой мокрый снег',
    sleet: 'Мокрый снег',
    heavysleet: 'Сильный мокрый снег',
    lightsleetshowers: 'Небольшой ливневый мокрый снег',
    sleetshowers: 'Ливневый мокрый снег',
    heavysleetshowers: 'Сильный ливневый мокрый снег',
    lightsnow: 'Небольшой снег',
    snow: 'Снег',
    heavysnow: 'Сильный снег',
    lightsnowshowers: 'Небольшой снегопад',
    snowshowers: 'Снегопад',
    heavysnowshowers: 'Сильный снегопад',
  },
};
const hs = (dil: Dil, k: string) => HAVA_SOZLUK[dil][k] ?? HAVA_SOZLUK.tr[k] ?? k;

/** İki nokta arasındaki gidiş yönü (derece, 0 = kuzey) */
export function gidisYonu(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return ((Math.atan2(y, x) / r) % 360 + 360) % 360;
}

export type RuzgarEtkisi = 'karşıdan' | 'arkadan' | 'yandan';

/** Gidiş yönüne göre rüzgâr: rüzgâr gittiğin yönden geliyorsa karşıdan */
export function ruzgarEtkisi(gidis: number, ruzgarGeldigi: number): RuzgarEtkisi {
  const fark = Math.abs((((ruzgarGeldigi - gidis) % 360) + 540) % 360 - 180);
  // fark: 0 = rüzgâr tam önden, 180 = tam arkadan
  if (fark <= 45) return 'karşıdan';
  if (fark >= 135) return 'arkadan';
  return 'yandan';
}

/** İz boyunca rüzgârın ne kadarı karşıdan / arkadan / yandandı (mesafeye göre oran) */
export function izdeRuzgar(iz: { lat: number; lng: number }[], ruzgarGeldigi: number): { karşıdan: number; arkadan: number; yandan: number; baskin: RuzgarEtkisi | null } {
  const toplam = { karşıdan: 0, arkadan: 0, yandan: 0 };
  let m = 0;
  for (let i = 1; i < iz.length; i++) {
    const d = haversine(iz[i - 1], iz[i]);
    if (d < 1) continue;
    toplam[ruzgarEtkisi(gidisYonu(iz[i - 1], iz[i]), ruzgarGeldigi)] += d;
    m += d;
  }
  if (!m) return { karşıdan: 0, arkadan: 0, yandan: 0, baskin: null };
  const oran = { karşıdan: toplam.karşıdan / m, arkadan: toplam.arkadan / m, yandan: toplam.yandan / m };
  const baskin = (Object.entries(oran) as [RuzgarEtkisi, number][]).sort((a, b) => b[1] - a[1])[0];
  // "Çoğunlukla" demek için belirgin çoğunluk (%55+); yarı yarıya ise söylenmez
  return { ...oran, baskin: baskin[1] >= 0.55 ? baskin[0] : null };
}

/** MET sembol kodunun adı: "lightrainshowers_day" → "Hafif sağanak" */
export function sembolMetni(sembol: string | null | undefined, dil: Dil = aktifDil()): string | null {
  if (!sembol) return null;
  const s = sembol.replace(/_(day|night|polartwilight)$/, '');
  const gok = /thunder/.test(s) ? hs(dil, 'gok') : '';
  const temel = s.replace(/andthunder$/, '');
  const ad = SEMBOLLER[dil][temel] ?? SEMBOLLER.tr[temel];
  return ad ? ad + gok : null;
}

const kmsa = (mps: number) => Math.round(mps * 3.6);

/** "24°C · Parçalı bulutlu" */
export function havaOzeti(h: HavaDurumu, dil: Dil = aktifDil()): string {
  const s = sembolMetni(h.sembol, dil);
  return `${Math.round(h.sicaklik)}°C${s ? ` · ${s}` : ''}`;
}

/** "14 km/sa batı rüzgârı"; rüzgâr çok hafifse "Rüzgârsız" */
export function ruzgarMetni(h: HavaDurumu, dil: Dil = aktifDil()): string {
  if (h.ruzgar < 0.5) return hs(dil, 'ruzgarsiz');
  return doldur(hs(dil, 'ruzgar'), { hiz: kmsa(h.ruzgar), birim: speedUnit(dil), yon: yonAdi(h.ruzgarYon, dil) });
}

/** Rüzgârın yola göre etkisi: "çoğunlukla karşıdan" */
export function ruzgarEtkisiMetni(etki: RuzgarEtkisi, dil: Dil = aktifDil()): string {
  return hs(dil, etki);
}

/** Aktivite özeti için satırlar: [etiket, değer] */
export function havaAyrintilari(h: HavaDurumu, iz?: { lat: number; lng: number }[], dil: Dil = aktifDil()): [string, string][] {
  const satirlar: [string, string][] = [[hs(dil, 'sicaklik'), `${Math.round(h.sicaklik)}°C`]];
  if (h.hissedilen != null && Math.abs(h.hissedilen - h.sicaklik) >= 1) satirlar.push([hs(dil, 'hissedilen'), `${Math.round(h.hissedilen)}°C`]);
  const etki = iz && iz.length > 1 && h.ruzgar >= 2 ? izdeRuzgar(iz, h.ruzgarYon).baskin : null;
  satirlar.push([hs(dil, 'ruzgarEtiket'), `${ruzgarMetni(h, dil)}${etki ? ` · ${ruzgarEtkisiMetni(etki, dil)}` : ''}`]);
  if (h.nem != null) satirlar.push([hs(dil, 'nem'), formatPercent(h.nem, dil)]);
  if (h.yagis != null && h.yagis > 0) satirlar.push([hs(dil, 'yagis'), `${formatDecimal(h.yagis, 1, dil)} ${hs(dil, 'mmsa')}`]);
  if (h.uv != null && h.uv >= 3) satirlar.push(['UV', `${Math.round(h.uv)}`]);
  return satirlar;
}

/** Saklanacak hava nesnesi geçerli mi (sunucudan / telefondan gelen veriye karşı) */
export function havaGecerliMi(x: unknown): x is HavaDurumu {
  const h = x as HavaDurumu;
  return !!h && typeof h === 'object' && typeof h.sicaklik === 'number' && typeof h.ruzgar === 'number' && typeof h.ruzgarYon === 'number' && typeof h.t === 'string';
}
