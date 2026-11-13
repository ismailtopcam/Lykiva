/**
 * Standart harita stilinin (OpenFreeMap Liberty) renklerini kullanıma göre ayarlar. Saf işlevler: React Native'e
 * bağlı değil, stil JSON'unu alıp yenisini döndürür.
 *
 * - acikStil: Liberty'nin kendisi; yalnızca patikalar (path / pedestrian) görünür yapılır. Liberty'de patikalar
 *   beyaz kesikli çizgi, açık zeminde neredeyse kaybolur; yürüyüş / koşu / dağ bisikleti için en önemli yollar bunlar.
 *   Renk bilerek rota çizgisinden (mor) ayrı: kahve-gri.
 * - koyuStil: aynı ayrıntıda gece haritası (karanlık tema). Zemin, alanlar ve yazılar açıklığı tersine çevrilerek
 *   koyulaştırılır (renk tonu korunur: su mavi, orman yeşil kalır), yollar koyu zeminde açık gri / soluk renkli olur.
 *   OpenFreeMap Dark'tan farkı: patikalar, parklar, orman, yer adları ve ilgi noktaları kaybolmuyor.
 */
import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-react-native';

type Katman = LayerSpecification;

/** Patika rengi (açık / koyu harita): rota çizgisinin morundan ayrı, toprak tonu */
export const PATIKA = { acik: 'hsl(28,30%,46%)', koyu: 'hsl(30,28%,62%)' };

/**
 * Rota çizgisi (açık / koyu harita): mor. Strava'nın turuncusuna benzemesin; haritadaki su (mavi), orman / park
 * (yeşil), ana yollar (sarı-turuncu), patikalar (kahve) ve eğim renkleriyle (deniz, gri, hardal, kiremit, bordo)
 * karışmasın diye.
 */
export const ROTA_RENGI = { acik: '#6A3FD0', koyu: '#A98BFF' };

/**
 * Kayıtta rotanın gidilen kısmı (açık / koyu harita): canlı mavi. Mor rotadan, deniz (camgöbeği) eğim renginden
 * ve soluk su renginden ayrılsın diye doygun.
 */
export const GIDILEN_RENGI = { acik: '#1F6FEB', koyu: '#58A6FF' };

/** Gece haritasının zemini */
export const KOYU_ZEMIN = 'hsl(150,9%,10%)';

// ---- Renk ayrıştırma ----

type Hsla = { h: number; s: number; l: number; a: number };

const ADLI: Record<string, string> = { white: '#ffffff', black: '#000000', transparent: 'rgba(0,0,0,0)' };

function rgbdenHsl(r: number, g: number, b: number, a: number): Hsla {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l, a };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l, a };
}

/** "#fff", "#f8f4f0", "rgba(1,2,3,0.5)", "hsl(35,8%,85%)", "white" … → HSLA; renk değilse null */
export function renkAyristir(deger: string): Hsla | null {
  const s = (ADLI[deger.trim().toLowerCase()] ?? deger).trim().toLowerCase();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (!/^[0-9a-f]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) return null;
    if (hex.length <= 4) hex = hex.split('').map((c) => c + c).join('');
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
    return rgbdenHsl(n(0), n(2), n(4), hex.length === 8 ? n(6) / 255 : 1);
  }
  const m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
  if (!m) return null;
  const p = m[2].split(/[\s,/]+/).filter(Boolean);
  if (p.length < 3) return null;
  const sayi = (x: string) => parseFloat(x);
  const a = p[3] !== undefined ? (p[3].endsWith('%') ? sayi(p[3]) / 100 : sayi(p[3])) : 1;
  if ([...p.slice(0, 3).map(sayi), a].some((x) => !Number.isFinite(x))) return null;
  if (m[1].startsWith('rgb')) return rgbdenHsl(sayi(p[0]), sayi(p[1]), sayi(p[2]), a);
  return { h: sayi(p[0]), s: sayi(p[1]) / 100, l: sayi(p[2]) / 100, a };
}

const yuvarla = (x: number, b = 1) => Math.round(x * 10 ** b) / 10 ** b;
const sinirla = (x: number) => Math.min(1, Math.max(0, x));

function hslaYaz({ h, s, l, a }: Hsla): string {
  return `hsla(${yuvarla(((h % 360) + 360) % 360)},${yuvarla(sinirla(s) * 100)}%,${yuvarla(sinirla(l) * 100)}%,${yuvarla(sinirla(a), 3)})`;
}

/**
 * Paint değerindeki (düz renk ya da ifade: interpolate, match …) bütün renkleri dönüştürür.
 * Yalnızca adı "color" ile biten özelliklere uygulanır; ifadelerdeki "get", alan adları vb. renk değildir, dokunulmaz.
 */
function renkleriDonustur(deger: unknown, f: (c: Hsla) => Hsla): unknown {
  if (typeof deger === 'string') {
    const c = renkAyristir(deger);
    return c ? hslaYaz(f(c)) : deger;
  }
  if (Array.isArray(deger)) return deger.map((d) => renkleriDonustur(d, f));
  return deger;
}

function paintDonustur(k: Katman, f: (c: Hsla) => Hsla): Katman {
  if (!('paint' in k) || !k.paint) return k;
  const paint: Record<string, unknown> = { ...k.paint };
  for (const ad of Object.keys(paint)) {
    if (ad.endsWith('color')) paint[ad] = renkleriDonustur(paint[ad], f);
  }
  return { ...k, paint } as Katman;
}

// ---- Katman sınıflandırma ----

function kaynakKatmani(k: Katman): string | undefined {
  return 'source-layer' in k ? (k['source-layer'] as string | undefined) : undefined;
}

/** Patika / yaya yolu çizgisi (kenarlığı değil) */
function patikaMi(k: Katman): boolean {
  return k.type === 'line' && kaynakKatmani(k) === 'transportation' && /path|pedestrian/.test(k.id) && !k.id.includes('casing');
}

/** Yol, demiryolu, köprü / tünel çizgileri (patikalar hariç) */
function yolMu(k: Katman): boolean {
  return k.type === 'line' && (kaynakKatmani(k) === 'transportation' || kaynakKatmani(k) === 'aeroway') && !patikaMi(k);
}

function patikaRengi(k: Katman, renk: string): Katman {
  return { ...k, paint: { ...(k as { paint?: object }).paint, 'line-color': renk } } as Katman;
}

// ---- Stiller ----

export function acikStil(s: StyleSpecification): StyleSpecification {
  return { ...s, layers: s.layers.map((k) => (patikaMi(k) ? patikaRengi(k, PATIKA.acik) : k)) };
}

/** Zemin, alan, yazı: açıklık tersine, doygunluk biraz kısılır (beyaz zemin → koyu, siyah yazı → açık) */
const ters = (c: Hsla): Hsla => ({ ...c, s: c.s * 0.45, l: 0.07 + (1 - c.l) * 0.85 });
/** Yol çizgileri: koyu zeminde gri; beyaz yol kenarlığından biraz açık kalır, renkli (ana) yollar soluk */
const yol = (c: Hsla): Hsla => ({ ...c, s: c.s * 0.28, l: 0.13 + c.l * 0.16 });

export function koyuStil(s: StyleSpecification): StyleSpecification {
  const layers = s.layers.map((k): Katman => {
    if (patikaMi(k)) return patikaRengi(k, PATIKA.koyu);
    // Zemin: uygulamanın gece renklerine yakın (colors.night), tersine çevrilmiş krem rengi kahveye kaçıyor
    if (k.type === 'background') return { ...k, paint: { ...k.paint, 'background-color': KOYU_ZEMIN } };
    if (k.type === 'raster') {
      // Küçük ölçekteki gölgeli kabartma görüntüsü: koyu zeminde parlamasın
      return { ...k, paint: { ...k.paint, 'raster-brightness-max': 0.35, 'raster-saturation': -0.4 } };
    }
    const d = paintDonustur(k, yolMu(k) ? yol : ters);
    // Kenarı olmayan yazılar (ör. yol adları) koyu zeminde açık yolun üstünde okunmuyor: koyu kenar
    if (d.type === 'symbol' && d.layout?.['text-field'] && !d.paint?.['text-halo-color']) {
      return { ...d, paint: { ...d.paint, 'text-halo-color': KOYU_ZEMIN, 'text-halo-width': 1.2 } };
    }
    return d;
  });
  return { ...s, layers };
}
