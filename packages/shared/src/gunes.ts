/**
 * Güneşin konumu: haritanın gündüz açık, akşam koyu çizilmesi için (gün doğumu / batımı).
 * Basitleştirilmiş astronomik hesap (NOAA / Astronomical Almanac yaklaşımı); hata bir iki dakika.
 */

const RAD = Math.PI / 180;

/** Güneşin ufuktan yüksekliği (derece); eksi: ufkun altında */
export function gunesYuksekligi(tarih: Date, lng: number, lat: number): number {
  const d = tarih.getTime() / 86_400_000 + 2440587.5 - 2451545.0; // J2000'den bu yana gün
  const g = (357.529 + 0.98560028 * d) * RAD; // ortalama anomali
  const q = 280.459 + 0.98564736 * d; // ortalama boylam
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD; // ekliptik boylam
  const e = (23.439 - 0.00000036 * d) * RAD; // eksen eğikliği
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dek = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = 280.46061837 + 360.98564736629 * d; // Greenwich yıldız zamanı (derece)
  const saatAcisi = (gmst + lng) * RAD - ra;
  const enl = lat * RAD;
  return Math.asin(Math.sin(enl) * Math.sin(dek) + Math.cos(enl) * Math.cos(dek) * Math.cos(saatAcisi)) / RAD;
}

/** Güneşin üst kenarı ufku geçtiğinde (gün doğumu / batımı; kırılma dahil) */
export const GUN_BATIMI_YUKSEKLIGI = -0.833;

/** Güneş batmış mı (gün batımından gün doğumuna kadar) */
export function gunesBatmisMi(tarih: Date, lng: number, lat: number): boolean {
  return gunesYuksekligi(tarih, lng, lat) < GUN_BATIMI_YUKSEKLIGI;
}

/** Konum bilinmiyorsa: yerel saatle 07:00–19:00 gündüz */
export function saateGoreGeceMi(tarih: Date): boolean {
  const s = tarih.getHours();
  return s < 7 || s >= 19;
}
