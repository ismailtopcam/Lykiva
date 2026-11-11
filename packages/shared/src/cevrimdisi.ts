/**
 * Çevrimdışı harita: bir rotanın çevresini telefona indirmek için plan.
 *
 * MapLibre çevrimdışı paketleri yalnızca dikdörtgen alan alır. Uzun ya da çapraz bir rotanın tek
 * dikdörtgeni gereksiz yere kocaman olur; bu yüzden rota kısa parçalara bölünür, her parçanın kutusu
 * (iki yana OFFLINE_BUFFER_M pay ile) ayrı bir paket olur. Kare (tile) sayısı indirmeden önce hesaplanır.
 *
 * OpenFreeMap kuralı (openfreemap.org/tos): bir indirme en fazla 3.000 kare ya da 50 MB, en fazla 4 paralel
 * istek, uygulamayı tanıtan User-Agent. Bizim bütçemiz biraz altında tutulur (stil, raster kabartma kaynağı payı).
 *
 * Saf fonksiyonlar; testleri cevrimdisi.test.ts.
 */
import { haversine } from './track';

/** [batı, güney, doğu, kuzey] */
export type LngLatBox = [number, number, number, number];

/** OpenFreeMap vektör kareleri en fazla 14. düzeyde; daha yakını telefon bu veriden büyüterek çizer */
export const OFFLINE_MIN_ZOOM = 10;
export const OFFLINE_MAX_ZOOM = 14;
/** Rotanın iki yanına indirilecek pay (m) */
export const OFFLINE_BUFFER_M = 1000;
/** Rota bu uzunlukta (m) kutulara bölünür */
export const OFFLINE_CHUNK_M = 3000;
/** Bir rota indirmesi için kare bütçesi (OpenFreeMap sınırı 3.000) */
export const OFFLINE_TILE_BUDGET = 2500;
/** Bir rota indirmesinde karelerin toplam boyutu sınırı (bayt; OpenFreeMap sınırı 50 MB) */
export const OFFLINE_MAX_TILE_BYTES = 50 * 1000 * 1000;

const M_PER_DEG_LAT = 111195;

/** Uzun parçaları en fazla `stepM` aralıklı noktalarla doldurur (düz çizgi kutuları şişirmesin) */
function densify(points: { lat: number; lng: number }[], stepM: number): { lat: number; lng: number }[] {
  const out: { lat: number; lng: number }[] = [];
  points.forEach((p, i) => {
    if (i > 0) {
      const a = points[i - 1];
      const n = Math.floor(haversine(a, p) / stepM);
      for (let k = 1; k <= n; k++) {
        const f = k / (n + 1);
        out.push({ lat: a.lat + (p.lat - a.lat) * f, lng: a.lng + (p.lng - a.lng) * f });
      }
    }
    out.push({ lat: p.lat, lng: p.lng });
  });
  return out;
}

function pad(box: LngLatBox, bufferM: number): LngLatBox {
  const [w, s, e, n] = box;
  const dLat = bufferM / M_PER_DEG_LAT;
  const lat = (s + n) / 2;
  const dLng = bufferM / (M_PER_DEG_LAT * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  return [w - dLng, Math.max(-85, s - dLat), e + dLng, Math.min(85, n + dLat)];
}

/**
 * Rotayı kapsayan kutular: rota en fazla `chunkM` genişlik / yükseklikte parçalara bölünür,
 * her parça iki yana `bufferM` genişletilir. Ardışık parçalar bir nokta paylaşır (boşluk kalmaz).
 */
export function routeOfflineBoxes(points: { lat: number; lng: number }[], bufferM = OFFLINE_BUFFER_M, chunkM = OFFLINE_CHUNK_M): LngLatBox[] {
  const pts = densify(points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)), chunkM / 4);
  if (!pts.length) return [];
  const boxes: LngLatBox[] = [];
  let box: LngLatBox = [pts[0].lng, pts[0].lat, pts[0].lng, pts[0].lat];
  let prev = pts[0];
  const genis = (b: LngLatBox) => {
    const lat = (b[1] + b[3]) / 2;
    const w = (b[2] - b[0]) * M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
    const h = (b[3] - b[1]) * M_PER_DEG_LAT;
    return Math.max(w, h);
  };
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const aday: LngLatBox = [Math.min(box[0], p.lng), Math.min(box[1], p.lat), Math.max(box[2], p.lng), Math.max(box[3], p.lat)];
    if (genis(aday) > chunkM) {
      boxes.push(box);
      // Yeni parça bir önceki noktadan başlar: iki kutu birbirine değer
      box = [Math.min(prev.lng, p.lng), Math.min(prev.lat, p.lat), Math.max(prev.lng, p.lng), Math.max(prev.lat, p.lat)];
    } else {
      box = aday;
    }
    prev = p;
  }
  boxes.push(box);
  return boxes.map((b) => pad(b, bufferM));
}

/** Web Mercator kare indisi */
export function tileXY(lng: number, lat: number, z: number): [number, number] {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return [Math.min(n - 1, Math.max(0, x)), Math.min(n - 1, Math.max(0, y))];
}

/** Kutuların kapladığı benzersiz kare sayısı (her düzeyde; çakışan kutular bir kez sayılır) */
export function tileCount(boxes: LngLatBox[], minZoom = OFFLINE_MIN_ZOOM, maxZoom = OFFLINE_MAX_ZOOM): number {
  let toplam = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const set = new Set<string>();
    for (const [w, s, e, n] of boxes) {
      const [x0, y0] = tileXY(w, n, z);
      const [x1, y1] = tileXY(e, s, z);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set.add(`${x}/${y}`);
    }
    toplam += set.size;
  }
  return toplam;
}

export type OfflinePlan = {
  boxes: LngLatBox[];
  minZoom: number;
  maxZoom: number;
  /** Tahmini kare sayısı (vektör kaynağı) */
  tileCount: number;
  /** Bütçeye sığıyor mu */
  fits: boolean;
};

/** Bir rota için çevrimdışı indirme planı */
export function offlinePlan(points: { lat: number; lng: number }[], bufferM = OFFLINE_BUFFER_M): OfflinePlan {
  const boxes = routeOfflineBoxes(points, bufferM);
  const count = boxes.length ? tileCount(boxes) : 0;
  return { boxes, minZoom: OFFLINE_MIN_ZOOM, maxZoom: OFFLINE_MAX_ZOOM, tileCount: count, fits: boxes.length > 0 && count <= OFFLINE_TILE_BUDGET };
}

/** 4_200_000 → "4,2 MB", 820_000 → "820 KB" */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e6) return `${String(Math.round(bytes / 1e5) / 10).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
