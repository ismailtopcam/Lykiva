/**
 * Kayıt sırasında konumu yumuşatan hafif Kalman filtresi (sabit konum modeli, enlem / boylam ayrı, ortak varyans).
 *
 * GPS her saniye birkaç metre kıpırdar: iz zikzak çizer, yavaş giderken mesafe şişer. Filtre her yeni ölçümü
 * doğruluğuna (`acc`) göre ağırlıklandırır: kötü ölçüm az, iyi ölçüm çok etkiler. Hareket payı cihaz hızıyla büyür,
 * böylece hızlı giderken iz geride kalmaz (bisiklette ~1–2 m).
 *
 * Yalnızca konum (lat/lng) yumuşatılır; `acc`, `speed`, `alt` olduğu gibi kalır (GPS durumu, anlık hız, rakım
 * kendi hesaplarını yapar). Uzun boşluktan (tünel, duraklatma) sonra filtre baştan başlar.
 */
import { MAX_PLAUSIBLE_SPEED, type TrackPoint } from './track';

export type KonumFiltresi = { lat: number; lng: number; /** m² */ varyans: number; t: number };

/** Bu kadar süre nokta gelmezse filtre sıfırlanır (s) */
export const FILTRE_SIFIRLAMA_S = 10;
/** Hareket payı: en az bu (m/s), cihaz hızıyla büyür */
const EN_AZ_HAREKET = 3;
const HIZ_KATSAYISI = 1.5;
/** Doğruluk bilinmiyorsa varsayılan, ve en iyimser doğruluk (m) — tek ölçüme tam güvenilmesin */
const VARSAYILAN_ACC = 10;
const EN_IYI_ACC = 3;

const M_PER_DEG_LAT = 111195;

export function konumuFiltrele(f: KonumFiltresi | null, p: TrackPoint): { filtre: KonumFiltresi; nokta: TrackPoint } {
  const acc = Math.max(EN_IYI_ACC, p.acc != null && p.acc > 0 ? p.acc : VARSAYILAN_ACC);
  const dt = f ? (p.t - f.t) / 1000 : Infinity;
  if (!f || !(dt > 0) || dt > FILTRE_SIFIRLAMA_S) {
    return { filtre: { lat: p.lat, lng: p.lng, varyans: acc * acc, t: p.t }, nokta: p };
  }
  const hiz = p.speed != null && p.speed >= 0 && p.speed <= MAX_PLAUSIBLE_SPEED ? p.speed : 0;
  const q = Math.max(EN_AZ_HAREKET, hiz * HIZ_KATSAYISI);
  const tahmin = f.varyans + dt * q * q;
  const k = tahmin / (tahmin + acc * acc);
  const lat = f.lat + k * (p.lat - f.lat);
  const lng = f.lng + k * (p.lng - f.lng);
  // Ölçümden uzaklaşma sınırı: filtre ölçümden doğruluğun ötesine sapmasın (uzun düzlükten sonra keskin dönüş)
  const dLatM = (p.lat - lat) * M_PER_DEG_LAT;
  const dLngM = (p.lng - lng) * M_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180);
  const sapma = Math.hypot(dLatM, dLngM);
  let sonLat = lat;
  let sonLng = lng;
  if (sapma > acc) {
    const oran = acc / sapma;
    sonLat = p.lat - (p.lat - lat) * oran;
    sonLng = p.lng - (p.lng - lng) * oran;
  }
  return {
    filtre: { lat: sonLat, lng: sonLng, varyans: (1 - k) * tahmin, t: p.t },
    nokta: { ...p, lat: sonLat, lng: sonLng },
  };
}
