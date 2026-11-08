/**
 * Türkçe sayı ve süre biçimlendirme (ondalık ayırıcı virgül).
 */

const decimal1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

/** 27400 → "27,4" (km) */
export function formatKm(meters: number): string {
  return decimal1.format(meters / 1000);
}

/** 1240 → "1.240" (m) */
export function formatMeters(meters: number): string {
  return integer.format(meters);
}

/** m/s → "16,7" (km/sa) */
export function formatSpeedKmh(metersPerSecond: number): string {
  return decimal1.format(metersPerSecond * 3.6);
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
