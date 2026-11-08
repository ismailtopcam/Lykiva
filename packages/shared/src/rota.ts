/**
 * Planlanmış rota hesapları: uzunluk, yükseklik, tahmini yürüyüş süresi, zemin ve
 * kayıt sırasında rotada ilerleme (tamamlanan / kalan mesafe, rotadan sapma).
 * Saf fonksiyonlar; testleri rota.test.ts içinde.
 */
import { haversine } from './track';

export type RotaNoktasi = { lat: number; lng: number; ele?: number | null };

/** Rotadan bu kadar uzaklaşınca "rotanın dışındasın" uyarısı verilir (m) */
export const ROTADAN_SAPMA_M = 50;
/** Rota yükseklik verisi (DEM) için gürültü eşiği (m) */
export const ROTA_YUKSEKLIK_ESIGI_M = 3;

/** Her noktaya kadar olan toplam mesafe (m); ilk eleman 0 */
export function kumulatifMesafe(r: RotaNoktasi[]): number[] {
  const cum = [0];
  for (let i = 1; i < r.length; i++) cum[i] = cum[i - 1] + haversine(r[i - 1], r[i]);
  return cum;
}

export function rotaUzunlugu(r: RotaNoktasi[]): number {
  const c = kumulatifMesafe(r);
  return c[c.length - 1] ?? 0;
}

/** Toplam tırmanış ve iniş (m). Eşikten küçük dalgalanmalar sayılmaz; bilinmeyen yükseklikler atlanır. */
export function yukseklikOzeti(eles: (number | null | undefined)[], esik = ROTA_YUKSEKLIK_ESIGI_M) {
  let gainM = 0;
  let lossM = 0;
  let ref: number | null = null;
  let maxM: number | null = null;
  let minM: number | null = null;
  for (const e of eles) {
    if (e == null || !Number.isFinite(e)) continue;
    maxM = maxM == null ? e : Math.max(maxM, e);
    minM = minM == null ? e : Math.min(minM, e);
    if (ref == null) {
      ref = e;
      continue;
    }
    const d = e - ref;
    if (d >= esik) {
      gainM += d;
      ref = e;
    } else if (d <= -esik) {
      lossM -= d;
      ref = e;
    }
  }
  return { gainM, lossM, maxM, minM };
}

/**
 * Tobler yürüyüş fonksiyonu: v = 6 · e^(−3,5 · |eğim + 0,05|) km/sa.
 * Yükseklik bilinmeyen parçalar düz kabul edilir. Dönen değer saniye.
 */
export function toblerSuresi(r: RotaNoktasi[]): number {
  let s = 0;
  for (let i = 1; i < r.length; i++) {
    const d = haversine(r[i - 1], r[i]);
    if (d <= 0) continue;
    const a = r[i - 1].ele;
    const b = r[i].ele;
    const egim = a != null && b != null ? (b - a) / d : 0;
    const kmsa = 6 * Math.exp(-3.5 * Math.abs(egim + 0.05));
    s += d / ((kmsa * 1000) / 3600);
  }
  return s;
}

/** Rota başı ile sonu bu kadar yakınsa döngü (başladığın yere dönen rota) sayılır (m) */
export function donguMu(r: RotaNoktasi[], esikM = 150): boolean {
  return r.length > 2 && haversine(r[0], r[r.length - 1]) <= esikM && rotaUzunlugu(r) > esikM * 4;
}

export type Zemin = 'asfalt' | 'toprak' | 'patika';

const ASFALT_YUZEY = new Set(['asphalt', 'paved', 'concrete', 'concrete:plates', 'concrete:lanes', 'paving_stones', 'sett', 'cobblestone', 'chipseal', 'metal', 'wood']);
const TOPRAK_YUZEY = new Set(['unpaved', 'gravel', 'fine_gravel', 'compacted', 'dirt', 'earth', 'ground', 'grass', 'sand', 'mud', 'pebblestone', 'rock', 'grass_paver']);
const PATIKA_YOL = new Set(['path', 'footway', 'bridleway', 'steps', 'via_ferrata']);
const ASFALT_YOL = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'pedestrian', 'cycleway',
]);

/**
 * OSM etiketlerinden (ör. "highway=path surface=gravel") zemin sınıfı.
 * Patika türü yollar yüzeyden bağımsız patika sayılır; diğerlerinde önce yüzey etiketine bakılır.
 */
export function zeminSinifi(etiketler: string): Zemin | null {
  const tag: Record<string, string> = {};
  for (const kv of etiketler.split(/\s+/)) {
    const i = kv.indexOf('=');
    if (i > 0) tag[kv.slice(0, i)] = kv.slice(i + 1);
  }
  const yol = tag.highway;
  const yuzey = tag.surface;
  if (yol && PATIKA_YOL.has(yol)) return 'patika';
  if (yuzey && ASFALT_YUZEY.has(yuzey)) return 'asfalt';
  if (yuzey && TOPRAK_YUZEY.has(yuzey)) return 'toprak';
  if (yol === 'track') return 'toprak';
  if (yol && ASFALT_YOL.has(yol)) return 'asfalt';
  return null;
}

export type ZeminDagilimi = Record<Zemin, number>;

/** Zemin metrelerini 0..1 oranlara çevirir (bilinmeyenler hariç); hiç veri yoksa null */
export function zeminOranlari(m: ZeminDagilimi): ZeminDagilimi | null {
  const t = m.asfalt + m.toprak + m.patika;
  if (t <= 0) return null;
  return { asfalt: m.asfalt / t, toprak: m.toprak / t, patika: m.patika / t };
}

export type RotaIlerlemesi = {
  /** Rota boyunca tamamlanan mesafe (m) */
  doneM: number;
  remainingM: number;
  totalM: number;
  /** Rotaya olan dik uzaklık (m) */
  sapmaM: number;
};

/** Noktanın bir doğru parçasına izdüşümü (yerel düzlem yaklaşımı; kısa parçalar için yeterli) */
function izdusum(a: RotaNoktasi, b: RotaNoktasi, p: RotaNoktasi) {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lng - p.lng) * kx;
  const ay = a.lat - p.lat;
  const bx = (b.lng - p.lng) * kx;
  const by = b.lat - p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / L2)) : 0;
  const q = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  return { t, uzaklik: haversine(p, q) };
}

/**
 * Kayıt sırasında rotadaki ilerleme. Nokta en yakın rota parçasına izdüşürülür.
 *
 * Gidiş-dönüş ve kendini kesen rotalarda aynı yere yakın birden çok parça olabilir; o zaman
 * bir önceki ilerlemeye (`oncekiM`) en yakın aday seçilir, böylece dönüş yolundayken
 * ilerleme birden gidişe atlamaz. İlk konumda belirsizlik varsa rotanın başı tercih edilir.
 */
export function rotaIlerlemesi(
  r: RotaNoktasi[],
  burasi: RotaNoktasi,
  oncekiM?: number | null,
  cum: number[] = kumulatifMesafe(r),
): RotaIlerlemesi {
  const totalM = cum[cum.length - 1] ?? 0;
  if (r.length < 2) return { doneM: 0, remainingM: 0, totalM, sapmaM: r[0] ? haversine(r[0], burasi) : 0 };

  const adaylar: { m: number; uzaklik: number }[] = [];
  let enYakin = Infinity;
  for (let i = 1; i < r.length; i++) {
    const { t, uzaklik } = izdusum(r[i - 1], r[i], burasi);
    adaylar.push({ m: cum[i - 1] + (cum[i] - cum[i - 1]) * t, uzaklik });
    if (uzaklik < enYakin) enYakin = uzaklik;
  }

  // Aday: rotanın ayrı kollarındaki en yakın yerler (uzaklığın yerel en küçükleri) ve en yakına
  // göre makul uzaklıktakiler. Aynı köşenin iki yanındaki komşu parçalar ayrı aday sayılmaz.
  const tolerans = Math.max(25, enYakin * 0.5);
  const uygun = adaylar.filter((a, i) => {
    if (a.uzaklik > enYakin + tolerans) return false;
    const once = adaylar[i - 1]?.uzaklik ?? Infinity;
    const sonra = adaylar[i + 1]?.uzaklik ?? Infinity;
    return a.uzaklik <= once && a.uzaklik <= sonra;
  });
  let secilen = uygun[0];
  if (oncekiM != null) {
    for (const a of uygun) {
      // Geriye gitmeyi biraz cezalandır: GPS titremesiyle ilerleme geri sekmesin
      const fark = (x: { m: number }) => (x.m >= oncekiM ? x.m - oncekiM : (oncekiM - x.m) * 1.5);
      if (fark(a) < fark(secilen)) secilen = a;
    }
  }
  return { doneM: secilen.m, remainingM: Math.max(0, totalM - secilen.m), totalM, sapmaM: secilen.uzaklik };
}

/** Uzun rotaları kayıt sırasında hızlı hesaplamak için seyreltir (en az minM aralık; uçlar korunur) */
export function rotaSeyrelt<T extends RotaNoktasi>(r: T[], minM = 10): T[] {
  if (r.length <= 2) return r;
  const out = [r[0]];
  for (let i = 1; i < r.length - 1; i++) if (haversine(out[out.length - 1], r[i]) >= minM) out.push(r[i]);
  out.push(r[r.length - 1]);
  return out;
}
