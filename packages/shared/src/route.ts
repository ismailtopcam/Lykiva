/**
 * Rota hesapları: kayıt sırasında rotadaki ilerleme, kalan mesafe, rotadan sapma;
 * rota için tahmini süre ve zorluk. Saf fonksiyonlar; testleri route.test.ts içinde.
 */
import type { ActivityType } from './activity';
import { elevationGainLoss, haversine } from './track';

export type RoutePoint = { lat: number; lng: number; alt?: number | null };

export type PreparedRoute = {
  points: RoutePoint[];
  /** Her noktaya kadar birikmiş mesafe (m) */
  cum: number[];
  totalM: number;
};

export type RouteProgress = {
  /** Rotada tamamlanan mesafe (m) */
  doneM: number;
  remainingM: number;
  totalM: number;
  /** Rotaya en yakın uzaklık (m) */
  offRouteM: number;
  /** Eşleşen parça (bir sonraki çağrıya verilir) */
  segIndex: number;
  /** 0..1 */
  fraction: number;
};

/** Bu uzaklığın üstü "rotadan çıktın" sayılır (m) */
export const OFF_ROUTE_M = 60;
/** Önceki konumdan ileriye doğru bu kadar mesafe içinde aranır (m) */
const SEARCH_AHEAD_M = 3000;

export function prepareRoute(points: RoutePoint[]): PreparedRoute {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + haversine(points[i - 1], points[i]);
  return { points, cum, totalM: cum[cum.length - 1] ?? 0 };
}

/** Noktanın AB parçasına izdüşümü: parça üzerindeki oran (0..1) ve uzaklık (m) */
function project(a: RoutePoint, b: RoutePoint, p: { lat: number; lng: number }) {
  const kx = Math.cos((p.lat * Math.PI) / 180) * 111320;
  const ky = 110574;
  const ax = (a.lng - p.lng) * kx;
  const ay = (a.lat - p.lat) * ky;
  const bx = (b.lng - p.lng) * kx;
  const by = (b.lat - p.lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0;
  const px = ax + t * dx;
  const py = ay + t * dy;
  return { t, dist: Math.sqrt(px * px + py * py) };
}

type Match = { seg: number; t: number; dist: number };

function search(route: PreparedRoute, p: { lat: number; lng: number }, from: number, to: number): Match | null {
  let best: Match | null = null;
  for (let i = Math.max(0, from); i < Math.min(route.points.length - 1, to); i++) {
    const m = project(route.points[i], route.points[i + 1], p);
    if (!best || m.dist < best.dist) best = { seg: i, t: m.t, dist: m.dist };
  }
  return best;
}

/**
 * Konumun rotadaki ilerlemesi.
 * Önceki sonuç verilirse arama önceki konumun biraz gerisinden ileriye doğru yapılır;
 * böylece başlangıcı ve bitişi aynı yerde olan (döngü) rotalarda ilerleme sona atlamaz.
 */
export function trackOnRoute(route: PreparedRoute, here: { lat: number; lng: number }, prev?: Pick<RouteProgress, 'segIndex'> | null): RouteProgress {
  const n = route.points.length;
  if (n < 2) return { doneM: 0, remainingM: 0, totalM: 0, offRouteM: 0, segIndex: 0, fraction: 0 };

  let match: Match | null;
  if (prev) {
    const start = Math.max(0, prev.segIndex - 3);
    let end = prev.segIndex + 1;
    while (end < n - 1 && route.cum[end] - route.cum[prev.segIndex] < SEARCH_AHEAD_M) end++;
    match = search(route, here, start, end + 1);
    if (!match || match.dist > OFF_ROUTE_M) {
      // Pencerede yoksa (kestirme, uzun sinyal kaybı) tüm rotaya bak
      const global = search(route, here, 0, n);
      if (global && global.dist <= OFF_ROUTE_M) match = global;
    }
  } else {
    const global = search(route, here, 0, n);
    match = global;
    if (global) {
      // İlk eşleşmede, en yakına neredeyse eşit uzaklıktaki en erken parçayı seç (döngü başlangıcı)
      for (let i = 0; i < n - 1; i++) {
        const m = project(route.points[i], route.points[i + 1], here);
        if (m.dist <= global.dist + 15) {
          match = { seg: i, t: m.t, dist: m.dist };
          break;
        }
      }
    }
  }

  const m = match as Match;
  const segLen = route.cum[m.seg + 1] - route.cum[m.seg];
  const doneM = route.cum[m.seg] + m.t * segLen;
  return {
    doneM,
    remainingM: Math.max(0, route.totalM - doneM),
    totalM: route.totalM,
    offRouteM: m.dist,
    segIndex: m.seg,
    fraction: route.totalM > 0 ? doneM / route.totalM : 0,
  };
}

/** Rota istatistikleri: mesafe, tırmanış, iniş, en yüksek/alçak, döngü mü */
export function routeStats(points: RoutePoint[]) {
  const r = prepareRoute(points);
  // Rota noktaları seyrek ve rakım haritadan (DEM) geldiği için daha dar pencere: zirveler düzleşmesin
  const el = elevationGainLoss(points.map((p) => p.alt).filter((a): a is number => a != null), 3);
  const isLoop = points.length > 2 && haversine(points[0], points[points.length - 1]) < 150;
  return { distanceM: r.totalM, ...el, isLoop };
}

/**
 * Tahmini süre (sn) — yaklaşık hesap; arayüzde "tahmini" diye gösterilir.
 * Yürüyüş/doğa yürüyüşü Naismith kuralına yakın: düz hız + tırmanış başına ek süre.
 */
export function estimateDuration(activity: ActivityType, distanceM: number, gainM: number): number {
  const p: Record<ActivityType, { kmh: number; secPerMUp: number }> = {
    walk: { kmh: 4.5, secPerMUp: 6 },
    hike: { kmh: 4, secPerMUp: 6 },
    run: { kmh: 9.5, secPerMUp: 3 },
    trail_run: { kmh: 7, secPerMUp: 3.6 },
    bike: { kmh: 18, secPerMUp: 3.6 },
    mtb: { kmh: 12, secPerMUp: 5 },
  };
  const { kmh, secPerMUp } = p[activity];
  return (distanceM / 1000 / kmh) * 3600 + Math.max(0, gainM) * secPerMUp;
}

export type Difficulty = 'easy' | 'moderate' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Kolay', moderate: 'Orta', hard: 'Zor' };

/** Kaba zorluk: mesafe ve tırmanışı aktivite türüne göre ölçekler */
export function estimateDifficulty(activity: ActivityType, distanceM: number, gainM: number): Difficulty {
  const bike = activity === 'bike' || activity === 'mtb';
  const km = distanceM / 1000 / (bike ? 3 : 1);
  const score = km + gainM / (bike ? 150 : 100);
  if (score < 10) return 'easy';
  if (score < 20) return 'moderate';
  return 'hard';
}
