/**
 * Hava durumu: MET Norway (api.met.no, locationforecast 2.0 compact) yanıtını çözer ve yorumlar.
 * Servis seçimi: anahtarsız, ticari kullanım dahil ücretsiz (CC BY 4.0; uygulamada "Kaynak: MET Norway" yazılır).
 * Ağ isteği burada değil, uygulamada yapılır (apps/mobile/src/lib/hava.ts).
 */
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

const YONLER = ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'] as const;
const YON_KISA = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'] as const;

/** Rüzgârın geldiği yönün adı: 270 → "batı" */
export function yonAdi(derece: number): (typeof YONLER)[number] {
  return YONLER[Math.round((((derece % 360) + 360) % 360) / 45) % 8];
}
export function yonKisa(derece: number): (typeof YON_KISA)[number] {
  return YON_KISA[Math.round((((derece % 360) + 360) % 360) / 45) % 8];
}

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

/** MET sembol kodunun Türkçesi: "lightrainshowers_day" → "Hafif sağanak" */
export function sembolMetni(sembol: string | null | undefined): string | null {
  if (!sembol) return null;
  const s = sembol.replace(/_(day|night|polartwilight)$/, '');
  const gok = /thunder/.test(s) ? ' ve gök gürültüsü' : '';
  const temel = s.replace(/andthunder$/, '');
  const tablo: Record<string, string> = {
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
  };
  const ad = tablo[temel];
  return ad ? ad + gok : null;
}

const kmsa = (mps: number) => Math.round(mps * 3.6);

/** "24°C · Parçalı bulutlu" */
export function havaOzeti(h: HavaDurumu): string {
  const s = sembolMetni(h.sembol);
  return `${Math.round(h.sicaklik)}°C${s ? ` · ${s}` : ''}`;
}

/** "14 km/sa batı rüzgârı"; rüzgâr çok hafifse "Rüzgârsız" */
export function ruzgarMetni(h: HavaDurumu): string {
  if (h.ruzgar < 0.5) return 'Rüzgârsız';
  return `${kmsa(h.ruzgar)} km/sa ${yonAdi(h.ruzgarYon)} rüzgârı`;
}

/** Aktivite özeti için satırlar: [etiket, değer] */
export function havaAyrintilari(h: HavaDurumu, iz?: { lat: number; lng: number }[]): [string, string][] {
  const satirlar: [string, string][] = [['Sıcaklık', `${Math.round(h.sicaklik)}°C`]];
  if (h.hissedilen != null && Math.abs(h.hissedilen - h.sicaklik) >= 1) satirlar.push(['Hissedilen', `${Math.round(h.hissedilen)}°C`]);
  const etki = iz && iz.length > 1 && h.ruzgar >= 2 ? izdeRuzgar(iz, h.ruzgarYon).baskin : null;
  satirlar.push(['Rüzgâr', `${ruzgarMetni(h)}${etki ? ` · çoğunlukla ${etki}` : ''}`]);
  if (h.nem != null) satirlar.push(['Nem', `%${h.nem}`]);
  if (h.yagis != null && h.yagis > 0) satirlar.push(['Yağış', `${h.yagis.toLocaleString('tr-TR')} mm/sa`]);
  if (h.uv != null && h.uv >= 3) satirlar.push(['UV', `${Math.round(h.uv)}`]);
  return satirlar;
}

/** Saklanacak hava nesnesi geçerli mi (sunucudan / telefondan gelen veriye karşı) */
export function havaGecerliMi(x: unknown): x is HavaDurumu {
  const h = x as HavaDurumu;
  return !!h && typeof h === 'object' && typeof h.sicaklik === 'number' && typeof h.ruzgar === 'number' && typeof h.ruzgarYon === 'number' && typeof h.t === 'string';
}
