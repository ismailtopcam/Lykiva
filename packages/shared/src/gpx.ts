/**
 * GPX içe aktarma: Garmin, Komoot, Strava, Wikiloc, AllTrails vb. dosyalarını okur.
 *
 * - İz (trk / trkseg / trkpt) varsa o okunur, parçalar ayrı tutulur (aktivitede duraklatma sayılır);
 *   yoksa rota (rte / rtept). Ara noktalar (wpt) okunmaz.
 * - Ad, tür (<type>), rakım (<ele>) ve zaman (<time>) okunur. Zaman her noktada ve sırayla artıyorsa
 *   dosya aktivite olarak da içe aktarılabilir (`zamanli`).
 * - Telefonda DOM yok; okuma düzenli ifadelerle. Bozuk ya da kapsam dışı noktalar atlanır.
 * Saf fonksiyonlar; testleri gpx.test.ts içinde.
 */
import type { ActivityType } from './activity';

export type GpxNoktasi = { lat: number; lng: number; alt: number | null; t: number | null };

export type GpxSonucu = {
  ad: string | null;
  tur: ActivityType | null;
  /** İz parçaları (trkseg); rota dosyasında tek parça */
  parcalar: GpxNoktasi[][];
  /** Her noktada zaman var ve zaman geri gitmiyor: aktivite olarak içe aktarılabilir */
  zamanli: boolean;
};

const TURLER: Record<string, ActivityType> = {
  cycling: 'bike',
  biking: 'bike',
  bike: 'bike',
  road_biking: 'bike',
  road_cycling: 'bike',
  ride: 'bike',
  gravel_cycling: 'bike',
  mountain_biking: 'mtb',
  mountain_bike: 'mtb',
  mtb: 'mtb',
  running: 'run',
  run: 'run',
  street_running: 'run',
  walking: 'walk',
  walk: 'walk',
  hiking: 'hike',
  hike: 'hike',
  trekking: 'hike',
  trail_running: 'trail_run',
  trail_run: 'trail_run',
};

const VARLIKLAR: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function metin(ham: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(ham);
  const s = cdata ? cdata[1] : ham;
  return s
    .replace(/&(amp|lt|gt|quot|apos);/g, (_t, v: string) => VARLIKLAR[v])
    .replace(/&#(\d+);/g, (_t, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_t, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .trim();
}

function etiket(xml: string, ad: string): string | null {
  const m = new RegExp(`<${ad}\\b[^>]*>([\\s\\S]*?)</${ad}>`, 'i').exec(xml);
  return m ? metin(m[1]) : null;
}

function nitelik(nitelikler: string, ad: string): number | null {
  const m = new RegExp(`\\b${ad}\\s*=\\s*["']([^"']+)["']`, 'i').exec(nitelikler);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

/** Bir bloktaki <trkpt> / <rtept> noktaları */
function noktalar(blok: string, tag: 'trkpt' | 'rtept'): GpxNoktasi[] {
  const sonuc: GpxNoktasi[] = [];
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(blok))) {
    const lat = nitelik(m[1], 'lat');
    const lng = nitelik(m[1], 'lon');
    if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    const ic = m[2] ?? '';
    const ele = etiket(ic, 'ele');
    const zaman = etiket(ic, 'time');
    const alt = ele != null && ele !== '' && Number.isFinite(Number(ele)) ? Number(ele) : null;
    const t = zaman ? Date.parse(zaman) : NaN;
    sonuc.push({ lat, lng, alt, t: Number.isFinite(t) ? t : null });
  }
  return sonuc;
}

export function gpxOku(xml: string): GpxSonucu {
  // Ara noktalar (wpt) adları karıştırmasın
  const govde = xml.replace(/<wpt\b[\s\S]*?<\/wpt>/gi, '');
  const trk = /<trk\b[^>]*>([\s\S]*?)<\/trk>/i.exec(govde)?.[1] ?? null;

  let parcalar: GpxNoktasi[][] = [];
  if (trk) {
    const re = /<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(govde))) {
      const p = noktalar(m[1], 'trkpt');
      if (p.length) parcalar.push(p);
    }
  }
  if (!parcalar.some((p) => p.length)) {
    const rte = /<rte\b[^>]*>([\s\S]*?)<\/rte>/i.exec(govde)?.[1];
    const p = rte ? noktalar(rte, 'rtept') : [];
    parcalar = p.length ? [p] : [];
  }

  const kaynak = trk ?? /<rte\b[^>]*>([\s\S]*?)<\/rte>/i.exec(govde)?.[1] ?? '';
  const metadata = /<metadata\b[^>]*>([\s\S]*?)<\/metadata>/i.exec(govde)?.[1] ?? '';
  const ad = (etiket(kaynak, 'name') || etiket(metadata, 'name') || null)?.slice(0, 120) ?? null;
  const turHam = etiket(kaynak, 'type')?.toLowerCase().replace(/[\s-]+/g, '_') ?? null;
  const tur = turHam ? (TURLER[turHam] ?? null) : null;

  const hepsi = parcalar.flat();
  let zamanli = hepsi.length > 1 && hepsi.every((p) => p.t != null);
  for (let i = 1; zamanli && i < hepsi.length; i++) if ((hepsi[i].t as number) < (hepsi[i - 1].t as number)) zamanli = false;
  if (zamanli && (hepsi[hepsi.length - 1].t as number) - (hepsi[0].t as number) < 1000) zamanli = false;

  return { ad, tur, parcalar, zamanli };
}

/**
 * Rotayı sadeleştirir (Ramer–Douglas–Peucker): düz giden kısımlardaki gereksiz noktalar atılır, köşeler kalır.
 * `toleransM`: çizgiden en fazla bu kadar sapan nokta atılır. Sonuç `enFazla`'yı aşarsa tolerans büyütülür.
 */
export function rotaSadelestir<T extends { lat: number; lng: number }>(girdi: T[], toleransM = 3, enFazla = 5000): T[] {
  if (girdi.length <= 2) return girdi.slice();
  // Çok büyük dosyada önce eşit aralıkla seyrelt (en fazla 8 × enFazla nokta): telefon takılmasın
  const adim = Math.ceil(girdi.length / (enFazla * 8));
  const pts = adim > 1 ? girdi.filter((_p, i) => i % adim === 0 || i === girdi.length - 1) : girdi;
  const lat0 = pts[0].lat;
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111320;
  const ky = 110574;
  const x = pts.map((p) => p.lng * kx);
  const y = pts.map((p) => p.lat * ky);

  const sadelestir = (tol: number) => {
    const tut = new Uint8Array(pts.length);
    tut[0] = 1;
    tut[pts.length - 1] = 1;
    const yigin: [number, number][] = [[0, pts.length - 1]];
    while (yigin.length) {
      const [a, b] = yigin.pop() as [number, number];
      const dx = x[b] - x[a];
      const dy = y[b] - y[a];
      const len2 = dx * dx + dy * dy;
      let enUzak = -1;
      let enUzakD = 0;
      for (let i = a + 1; i < b; i++) {
        let d: number;
        if (len2 === 0) d = Math.hypot(x[i] - x[a], y[i] - y[a]);
        else {
          const t = Math.max(0, Math.min(1, ((x[i] - x[a]) * dx + (y[i] - y[a]) * dy) / len2));
          d = Math.hypot(x[i] - (x[a] + t * dx), y[i] - (y[a] + t * dy));
        }
        if (d > enUzakD) {
          enUzakD = d;
          enUzak = i;
        }
      }
      if (enUzak > 0 && enUzakD > tol) {
        tut[enUzak] = 1;
        yigin.push([a, enUzak], [enUzak, b]);
      }
    }
    return pts.filter((_p, i) => tut[i]);
  };

  let tol = toleransM;
  let sonuc = sadelestir(tol);
  while (sonuc.length > enFazla && tol < 1000) {
    tol *= 2;
    sonuc = sadelestir(tol);
  }
  return sonuc;
}
