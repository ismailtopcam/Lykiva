/**
 * GPS izi hesaplamaları — mobil kaydedici ve sunucu aynı kuralları kullansın diye burada.
 * Saf fonksiyonlar; yan etkisi yok, birim testleri track.test.ts içinde.
 */

export type TrackPoint = {
  /** Unix zamanı, milisaniye */
  t: number;
  lat: number;
  lng: number;
  /** Rakım (m) — cihaz vermezse null */
  alt?: number | null;
  /** Yatay doğruluk (m) */
  acc?: number | null;
  /** Cihazın bildirdiği hız (m/s) — yoksa null veya negatif */
  speed?: number | null;
};

export type TrackStop = {
  startT: number;
  endT: number;
  lat: number;
  lng: number;
  /** Duraklamanın başladığı andaki toplam mesafe (m) */
  distanceAtM: number;
};

export type TrackStats = {
  distanceM: number;
  elapsedS: number;
  movingS: number;
  /** Hareket hâlindeki ortalama hız (m/s) */
  avgMovingSpeed: number;
  maxSpeed: number;
  /** Hareket hâlindeyken görülen en düşük (yumuşatılmış) hız (m/s) */
  minMovingSpeed: number;
  gainM: number;
  lossM: number;
  maxAltM: number | null;
  minAltM: number | null;
};

/** Bu doğruluktan kötü noktalar atılır (m) */
export const MAX_ACCURACY_M = 30;
/** Bu hızın üstü GPS sıçraması sayılır (m/s ≈ 216 km/sa) */
export const MAX_PLAUSIBLE_SPEED = 60;
/** Bu hızın altı "duruyor" sayılır (m/s ≈ 1,8 km/sa) */
export const MOVING_SPEED = 0.5;
/** Rakım gürültüsünü bastırmak için eşik (m) — yumuşatmadan sonra uygulanır */
export const ELEVATION_HYSTERESIS_M = 4;
/** Rakım için hareketli ortalama penceresi (nokta) */
export const ELEVATION_SMOOTH_WINDOW = 9;
/** Bu süreden uzun duraklamalar mola sayılır (s) */
export const STOP_MIN_S = 60;
/** Mola sırasında bu yarıçap içinde kalınır (m) */
export const STOP_RADIUS_M = 25;

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** İki nokta arası yüzey mesafesi (m) */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Yeni bir GPS noktası kabul edilsin mi?
 * Kötü doğruluk, zamanda geri gitme ve fiziksel olarak imkânsız sıçramalar elenir.
 */
export function acceptPoint(prev: TrackPoint | undefined, p: TrackPoint): boolean {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
  if (p.acc != null && p.acc > MAX_ACCURACY_M) return false;
  if (!prev) return true;
  const dt = (p.t - prev.t) / 1000;
  if (dt <= 0) return false;
  return haversine(prev, p) / dt <= MAX_PLAUSIBLE_SPEED;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Nokta başına hız (m/s): cihaz hızı varsa o, yoksa bir önceki noktaya göre hesaplanan */
export function pointSpeeds(points: TrackPoint[]): number[] {
  return points.map((p, i) => {
    if (p.speed != null && p.speed >= 0 && p.speed <= MAX_PLAUSIBLE_SPEED) return p.speed;
    if (i === 0) return 0;
    const dt = (p.t - points[i - 1].t) / 1000;
    return dt > 0 ? Math.min(MAX_PLAUSIBLE_SPEED, haversine(points[i - 1], p) / dt) : 0;
  });
}

/** Tek tük sıçramaları bastırmak için 5'li hareketli medyan */
export function smoothSpeeds(speeds: number[], window = 5): number[] {
  const h = Math.floor(window / 2);
  return speeds.map((_, i) => median(speeds.slice(Math.max(0, i - h), i + h + 1)));
}

/** Merkezli hareketli ortalama (kenarlarda pencere daralır) */
export function smoothAltitudes(alts: number[], window = ELEVATION_SMOOTH_WINDOW): number[] {
  const h = Math.floor(window / 2);
  return alts.map((_, i) => {
    const part = alts.slice(Math.max(0, i - h), i + h + 1);
    return part.reduce((a, b) => a + b, 0) / part.length;
  });
}

/**
 * Rakımdan tırmanış/iniş: telefon ve DEM rakımı gürültülü olduğu için önce hareketli ortalama,
 * sonra eşikli (histerezis) toplam.
 */
export function elevationGainLoss(rawAlts: number[], window = ELEVATION_SMOOTH_WINDOW) {
  const alts = smoothAltitudes(rawAlts, window);
  let gainM = 0;
  let lossM = 0;
  let ref: number | null = null;
  let maxAltM: number | null = null;
  let minAltM: number | null = null;
  for (const alt of alts) {
    maxAltM = maxAltM == null ? alt : Math.max(maxAltM, alt);
    minAltM = minAltM == null ? alt : Math.min(minAltM, alt);
    if (ref == null) {
      ref = alt;
      continue;
    }
    if (alt - ref >= ELEVATION_HYSTERESIS_M) {
      gainM += alt - ref;
      ref = alt;
    } else if (ref - alt >= ELEVATION_HYSTERESIS_M) {
      lossM += ref - alt;
      ref = alt;
    }
  }
  return { gainM, lossM, maxAltM, minAltM };
}

export function computeStats(points: TrackPoint[]): TrackStats {
  const empty: TrackStats = {
    distanceM: 0,
    elapsedS: 0,
    movingS: 0,
    avgMovingSpeed: 0,
    maxSpeed: 0,
    minMovingSpeed: 0,
    gainM: 0,
    lossM: 0,
    maxAltM: null,
    minAltM: null,
  };
  if (points.length < 2) return { ...empty, elapsedS: 0 };

  let distanceM = 0;
  let movingS = 0;
  let movingDist = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    const dt = (points[i].t - points[i - 1].t) / 1000;
    distanceM += d;
    if (dt > 0 && d / dt >= MOVING_SPEED) {
      movingS += dt;
      movingDist += d;
    }
  }

  const smooth = smoothSpeeds(pointSpeeds(points));
  const moving = smooth.filter((s) => s >= MOVING_SPEED);

  const { gainM, lossM, maxAltM, minAltM } = elevationGainLoss(points.map((p) => p.alt).filter((a): a is number => a != null));

  return {
    distanceM,
    elapsedS: (points[points.length - 1].t - points[0].t) / 1000,
    movingS,
    avgMovingSpeed: movingS > 0 ? movingDist / movingS : 0,
    maxSpeed: smooth.length ? Math.max(...smooth) : 0,
    minMovingSpeed: moving.length ? Math.min(...moving) : 0,
    gainM,
    lossM,
    maxAltM,
    minAltM,
  };
}

/**
 * Molaları bulur: en az STOP_MIN_S boyunca STOP_RADIUS_M yarıçapında kalınan aralıklar.
 * Telefon uykudayken oluşan uzun boşluklar (az yer değişimiyle) da mola sayılır.
 */
export function detectStops(points: TrackPoint[], minS = STOP_MIN_S, radiusM = STOP_RADIUS_M): TrackStop[] {
  const stops: TrackStop[] = [];
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + haversine(points[i - 1], points[i]);

  let i = 0;
  while (i < points.length - 1) {
    const anchor = points[i];
    let j = i + 1;
    while (j < points.length && haversine(anchor, points[j]) <= radiusM) j++;
    const last = points[j - 1];
    const durS = (last.t - anchor.t) / 1000;
    if (j - 1 > i && durS >= minS) {
      stops.push({ startT: anchor.t, endT: last.t, lat: anchor.lat, lng: anchor.lng, distanceAtM: cum[i] });
      i = j - 1;
    } else {
      i++;
    }
  }
  return stops;
}

/** Kayıt sırasında harita için izi seyrekleştirir (en az minM aralıkla nokta) */
export function thin(points: TrackPoint[], minM = 8): TrackPoint[] {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (haversine(out[out.length - 1], points[i]) >= minM) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Bir rotada en yakın noktaya göre ilerleme: tamamlanan ve kalan mesafe (m) */
export function routeProgress(route: { lat: number; lng: number }[], here: { lat: number; lng: number }) {
  if (route.length < 2) return { doneM: 0, remainingM: 0, totalM: 0 };
  const cum: number[] = [0];
  for (let i = 1; i < route.length; i++) cum[i] = cum[i - 1] + haversine(route[i - 1], route[i]);
  let best = 0;
  let bestD = Infinity;
  route.forEach((p, i) => {
    const d = haversine(p, here);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const totalM = cum[cum.length - 1];
  return { doneM: cum[best], remainingM: totalM - cum[best], totalM };
}

/**
 * Duraklatmalarla bölünmüş kayıt için istatistik: her parça ayrı hesaplanır,
 * böylece duraklatılmışken (ör. araçla) gidilen yol mesafeye eklenmez.
 * Toplam süre ilk noktadan son noktaya kadardır (duraklatmalar dahil).
 */
export function computeSegmentedStats(segments: TrackPoint[][]): TrackStats {
  const parts = segments.filter((s) => s.length > 0);
  const all = parts.flat();
  const per = parts.filter((s) => s.length > 1).map(computeStats);
  const sum = (f: (s: TrackStats) => number) => per.reduce((a, s) => a + f(s), 0);
  const movingS = sum((s) => s.movingS);
  const movingDist = sum((s) => s.avgMovingSpeed * s.movingS);
  const alts = per.flatMap((s) => [s.maxAltM, s.minAltM]).filter((a): a is number => a != null);
  const mins = per.map((s) => s.minMovingSpeed).filter((v) => v > 0);
  return {
    distanceM: sum((s) => s.distanceM),
    elapsedS: all.length > 1 ? (all[all.length - 1].t - all[0].t) / 1000 : 0,
    movingS,
    avgMovingSpeed: movingS > 0 ? movingDist / movingS : 0,
    maxSpeed: per.length ? Math.max(...per.map((s) => s.maxSpeed)) : 0,
    minMovingSpeed: mins.length ? Math.min(...mins) : 0,
    gainM: sum((s) => s.gainM),
    lossM: sum((s) => s.lossM),
    maxAltM: alts.length ? Math.max(...alts) : null,
    minAltM: alts.length ? Math.min(...alts) : null,
  };
}

/** Anlık hız: son birkaç saniyedeki noktalardan (cihaz hızı varsa onun medyanı) */
export function currentSpeed(points: TrackPoint[], windowS = 5): number {
  if (!points.length) return 0;
  const last = points[points.length - 1];
  const recent = points.filter((p) => last.t - p.t <= windowS * 1000);
  if (recent.length < 2) {
    return last.speed != null && last.speed >= 0 ? last.speed : 0;
  }
  return median(pointSpeeds(recent).slice(1));
}
