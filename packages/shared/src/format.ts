/**
 * Sayı ve süre biçimlendirme, dile göre (Türkçe / Almanca ondalık virgül, İngilizce nokta).
 * Dil verilmezse telefondaki uygulamanın o anki dili (bkz. dil.ts). Web sunucusu dili açıkça verir.
 */
import { aktifDil, YEREL_AYAR, type Dil } from './dil';

const onbellek = new Map<string, Intl.NumberFormat>();
function bicim(dil: Dil, kesir: number): Intl.NumberFormat {
  const k = `${dil}:${kesir}`;
  let f = onbellek.get(k);
  if (!f) {
    f = new Intl.NumberFormat(YEREL_AYAR[dil], { minimumFractionDigits: kesir, maximumFractionDigits: kesir });
    onbellek.set(k, f);
  }
  return f;
}

/** 27400 → "27,4" (km) */
export function formatKm(meters: number, dil: Dil = aktifDil()): string {
  return bicim(dil, 1).format(meters / 1000);
}

/** 1240 → "1.240" (m) */
export function formatMeters(meters: number, dil: Dil = aktifDil()): string {
  return bicim(dil, 0).format(meters);
}

/** m/s → "16,7" (km/sa) */
export function formatSpeedKmh(metersPerSecond: number, dil: Dil = aktifDil()): string {
  return bicim(dil, 1).format(metersPerSecond * 3.6);
}

/** Ondalıklı sayı: 4.2 → "4,2" */
export function formatDecimal(n: number, kesir = 1, dil: Dil = aktifDil()): string {
  return bicim(dil, kesir).format(n);
}

/** Yüzde: 62 → "%62" (tr), "62%" (en), "62 %" (de, ru) */
export function formatPercent(n: number, dil: Dil = aktifDil()): string {
  const s = bicim(dil, 0).format(n);
  return dil === 'tr' ? `%${s}` : dil === 'en' ? `${s}%` : `${s} %`;
}

/** Hız birimi: "km/sa" (tr), "km/h", "км/ч" (ru) */
export function speedUnit(dil: Dil = aktifDil()): string {
  return dil === 'tr' ? 'km/sa' : dil === 'ru' ? 'км/ч' : 'km/h';
}

/** Mesafe birimi: "km", Rusçada "км" */
export function kmUnit(dil: Dil = aktifDil()): string {
  return dil === 'ru' ? 'км' : 'km';
}

/** Metre birimi: "m", Rusçada "м" */
export function mUnit(dil: Dil = aktifDil()): string {
  return dil === 'ru' ? 'м' : 'm';
}

/** Saniye → "1:38:20" ya da "41:18" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Koşu temposu: m/s → "5:12" (dk/km) */
export function formatPace(metersPerSecond: number): string {
  if (metersPerSecond <= 0) return '–';
  const secPerKm = 1000 / metersPerSecond;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Kalan mesafeyi şu ana kadarki ortalama hıza göre süreye çevirir.
 * Ortalama hız 0 ise null döner.
 */
export function etaSeconds(remainingMeters: number, avgMetersPerSecond: number): number | null {
  if (avgMetersPerSecond <= 0) return null;
  return remainingMeters / avgMetersPerSecond;
}
