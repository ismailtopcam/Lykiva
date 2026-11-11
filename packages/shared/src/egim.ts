/**
 * Rota eğimi: yükseklik profili, eğim sınıfları (renklendirme), en dik yerler ve tırmanış bölümleri.
 *
 * Rota rakımı haritadan (DEM) gelir ve gürültülüdür; iki komşu nokta arasındaki eğim yanıltır.
 * Bu yüzden eğim her zaman GRADE_WINDOW_M uzunluğunda bir pencere boyunca hesaplanır: kısa ve çok dik
 * bir rampa (ör. 30 m'lik %20) biraz yumuşamış görünür, ama sahte sıçramalar da kaybolur.
 *
 * Bilinen sınır: BRouter çıktısında köprü / tünel etiketi yok. Köprüde DEM vadinin tabanını,
 * tünelde dağın üstünü verebilir; orada sahte dik eğim görülebilir.
 *
 * Saf fonksiyonlar; testleri egim.test.ts.
 */
import { aktifDil, dileGoreTablo, type Dil } from './dil';
import { formatDecimal } from './format';
import type { RoutePoint } from './route';
import { colors } from './tokens';
import { haversine } from './track';
import { eksikleriDoldur, mesafedeDeger } from './ucBoyut';

/** Eğimin ölçüldüğü pencere (m) */
export const GRADE_WINDOW_M = 100;

export type GradeClass = 'down' | 'flat' | 'gentle' | 'moderate' | 'steep';

export const GRADE_CLASSES: GradeClass[] = ['down', 'flat', 'gentle', 'moderate', 'steep'];

const GRADE_SOZLUK: Record<Dil, Record<GradeClass, string>> = {
  tr: { down: 'İniş', flat: 'Düz', gentle: '%3–6', moderate: '%6–10', steep: '%10+' },
  en: { down: 'Downhill', flat: 'Flat', gentle: '3–6%', moderate: '6–10%', steep: '10%+' },
  de: { down: 'Bergab', flat: 'Flach', gentle: '3–6 %', moderate: '6–10 %', steep: '10 %+' },
  ru: { down: 'Спуск', flat: 'Ровно', gentle: '3–6 %', moderate: '6–10 %', steep: '10 %+' },
};

/** Telefonda o anki dilde */
export const GRADE_LABELS: Record<GradeClass, string> = dileGoreTablo(GRADE_SOZLUK);

/** Açık zeminde (harita, sayfa) ayırt edilebilir renkler */
export const GRADE_COLORS: Record<GradeClass, string> = {
  down: colors.sea,
  flat: '#6E7A73',
  gentle: colors.ochre,
  moderate: colors.terra,
  steep: '#8E1B1B',
};

/** Eğim (%) → sınıf. -3 ile +3 arası düz sayılır. */
export function gradeClass(gradePct: number): GradeClass {
  if (gradePct <= -3) return 'down';
  if (gradePct < 3) return 'flat';
  if (gradePct < 6) return 'gentle';
  if (gradePct < 10) return 'moderate';
  return 'steep';
}

export type RouteProfile = {
  /** Her rota noktasının başlangıçtan uzaklığı (m) */
  d: number[];
  /** Her rota noktasının yüksekliği (m); eksikler komşulardan doğrusal doldurulmuş */
  alt: number[];
  totalM: number;
};

/** Rota noktalarından profil; rakım hiç yoksa (serbest çizim) null */
export function routeProfile(points: RoutePoint[]): RouteProfile | null {
  if (points.length < 2) return null;
  const alt = eksikleriDoldur(points.map((p) => p.alt ?? null));
  if (!alt) return null;
  const d = [0];
  for (let i = 1; i < points.length; i++) d[i] = d[i - 1] + haversine(points[i - 1], points[i]);
  const totalM = d[d.length - 1];
  if (totalM <= 0) return null;
  return { d, alt, totalM };
}

/** Bir mesafedeki yükseklik (m) */
export function altitudeAt(p: RouteProfile, atM: number): number {
  return mesafedeDeger(p.d, p.alt, atM);
}

/**
 * Bir mesafedeki eğim (%): ortası `atM` olan `windowM` uzunluğunda pencerede yükseklik farkı / yol.
 * Uçlarda pencere kısalmaz, içeri kayar (kısa pencere gürültüyü büyütür). Rota pencereden kısaysa tamamı.
 */
export function gradeAt(p: RouteProfile, atM: number, windowM = GRADE_WINDOW_M): number {
  const w = Math.min(windowM, p.totalM);
  let a = atM - w / 2;
  let b = atM + w / 2;
  if (a < 0) {
    b -= a;
    a = 0;
  }
  if (b > p.totalM) {
    a -= b - p.totalM;
    b = p.totalM;
  }
  a = Math.max(0, a);
  if (b - a < 1) return 0;
  return ((altitudeAt(p, b) - altitudeAt(p, a)) / (b - a)) * 100;
}

/** Bir mesafedeki konum (rota noktaları arasında doğrusal) */
export function positionAt(points: RoutePoint[], p: RouteProfile, atM: number): { lat: number; lng: number } {
  return {
    lat: mesafedeDeger(p.d, points.map((x) => x.lat), atM),
    lng: mesafedeDeger(p.d, points.map((x) => x.lng), atM),
  };
}

/** Haritada renklendirme için: rota noktası aralığı [from, to] (ikisi dahil) ve sınıfı */
export type GradeSegment = { from: number; to: number; cls: GradeClass };

/** Her rota parçasının eğim sınıfı (parça ortasında, pencereyle); aynı sınıftaki ardışık parçalar birleşir */
export function gradeSegments(p: RouteProfile, windowM = GRADE_WINDOW_M): GradeSegment[] {
  const out: GradeSegment[] = [];
  for (let i = 1; i < p.d.length; i++) {
    const cls = gradeClass(gradeAt(p, (p.d[i - 1] + p.d[i]) / 2, windowM));
    const last = out[out.length - 1];
    if (last && last.cls === cls) last.to = i;
    else out.push({ from: i - 1, to: i, cls });
  }
  return out;
}

export type ProfileSamples = {
  /** Eşit aralıklı mesafeler (m) */
  d: number[];
  /** O mesafelerdeki yükseklik (m) */
  alt: number[];
  /** Ardışık iki örnek arasındaki aralığın sınıfı (uzunluk d.length - 1) */
  cls: GradeClass[];
};

/** Grafik için eşit aralıklı `count` örnek (x ekseni mesafeyle doğru orantılı olsun diye) */
export function profileSamples(p: RouteProfile, count = 120, windowM = GRADE_WINDOW_M): ProfileSamples {
  const n = Math.max(2, Math.round(count));
  const d = Array.from({ length: n }, (_, i) => (i / (n - 1)) * p.totalM);
  const alt = d.map((m) => altitudeAt(p, m));
  const cls = d.slice(1).map((m, i) => gradeClass(gradeAt(p, (d[i] + m) / 2, windowM)));
  return { d, alt, cls };
}

export type Climb = {
  startM: number;
  endM: number;
  lengthM: number;
  gainM: number;
  /** Ortalama eğim (%) */
  avgGrade: number;
  /** En dik yer (%), GRADE_WINDOW_M penceresiyle */
  maxGrade: number;
};

export type GradeSummary = {
  /** En dik çıkış (%), pozitif; çıkış yoksa 0 */
  maxClimbGrade: number;
  /** En dik iniş (%), pozitif yazılır; iniş yoksa 0 */
  maxDescentGrade: number;
  /** Sınıf başına mesafe (m) */
  byClass: Record<GradeClass, number>;
  climbs: Climb[];
};

/** Tırmanış sayılması için en az kazanç (m), uzunluk (m) ve ortalama eğim (%) */
export const CLIMB_MIN_GAIN_M = 20;
export const CLIMB_MIN_LENGTH_M = 200;
export const CLIMB_MIN_AVG_GRADE = 3;
/** Tepeden bu kadar inilince tırmanış bitmiş sayılır (m); daha küçük düzlükler/inişler tırmanışı bölmez */
export const CLIMB_END_DROP_M = 10;

/**
 * Eğim özeti ve tırmanış bölümleri. Profil `stepM` aralıkla örneklenir.
 * Tırmanış: en alçak noktadan başlar, tepeden CLIMB_END_DROP_M inilince ya da rota bitince tepede biter.
 */
export function gradeSummary(p: RouteProfile, stepM = 20, windowM = GRADE_WINDOW_M): GradeSummary {
  // Çok uzun rotalarda örnek sayısını sınırla
  const step = Math.max(stepM, p.totalM / 5000);
  const n = Math.max(2, Math.ceil(p.totalM / step) + 1);
  const d = Array.from({ length: n }, (_, i) => Math.min(p.totalM, i * step));
  const z = d.map((m) => altitudeAt(p, m));

  const byClass: Record<GradeClass, number> = { down: 0, flat: 0, gentle: 0, moderate: 0, steep: 0 };
  let maxUp = 0;
  let maxDown = 0;
  const g: number[] = [];
  for (let i = 1; i < n; i++) {
    const gi = gradeAt(p, (d[i - 1] + d[i]) / 2, windowM);
    g.push(gi);
    byClass[gradeClass(gi)] += d[i] - d[i - 1];
    maxUp = Math.max(maxUp, gi);
    maxDown = Math.min(maxDown, gi);
  }

  const climbs: Climb[] = [];
  const ekle = (lo: number, hi: number) => {
    const gainM = z[hi] - z[lo];
    const lengthM = d[hi] - d[lo];
    if (gainM < CLIMB_MIN_GAIN_M || lengthM < CLIMB_MIN_LENGTH_M) return;
    const avgGrade = (gainM / lengthM) * 100;
    if (avgGrade < CLIMB_MIN_AVG_GRADE) return;
    let maxGrade = 0;
    for (let i = lo; i < hi; i++) maxGrade = Math.max(maxGrade, g[i]);
    climbs.push({ startM: d[lo], endM: d[hi], lengthM, gainM, avgGrade, maxGrade });
  };
  let lo = 0;
  let hi = 0;
  for (let i = 1; i < n; i++) {
    if (z[i] > z[hi]) hi = i;
    if (z[hi] - z[i] >= CLIMB_END_DROP_M) {
      ekle(lo, hi);
      lo = i;
      hi = i;
    } else if (z[i] <= z[lo]) {
      // Yeterince çıkmadan yeni dip: tırmanış buradan başlar
      lo = i;
      hi = i;
    }
  }
  ekle(lo, hi);

  return { maxClimbGrade: maxUp, maxDescentGrade: -maxDown, byClass, climbs };
}

/** "%7,5" — eğimi bir ondalıkla, Türkçe */
export function formatGrade(gradePct: number, dil: Dil = aktifDil()): string {
  const v = Math.round(Math.abs(gradePct) * 10) / 10;
  const s = formatDecimal(v, Number.isInteger(v) ? 0 : 1, dil);
  return dil === 'tr' ? `%${s}` : dil === 'en' ? `${s}%` : `${s} %`;
}
