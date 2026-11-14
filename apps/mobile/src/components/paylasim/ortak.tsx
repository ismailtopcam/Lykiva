/**
 * Paylaşım temalarının ortak parçaları: renkler, metin, iz izdüşümü, yumuşak eğri, aktivite değerleri.
 * Temalar tasarımdaki "tasarım pikseli" ile çizilir (hikâye 360 × 640, gönderi 432 × 540, kare 480 × 480);
 * önizlemede `Olcekli` ile küçültülür, görsel üretirken 1080 px genişlikte yakalanır.
 * Kaynak: tasarim/AKTARIM.md ve tasarim/kaynak/KartNN-*.dc.html
 */
import { ACTIVITY_LABELS, haversine, kmUnit, mUnit } from '@lykiva/shared';
import type { ReactNode } from 'react';
import { Text, View, type TextProps } from 'react-native';

import type { Activity, LngLat } from '@/data/ornek';
import { fontFamily } from '@/theme';
import { $t, yerel } from '@/i18n';

/** Tasarım renkleri (AKTARIM.md > Renkler) */
export const R = {
  ink: '#16201B',
  cream: '#F2EDE3',
  surf: '#FBF8F2',
  terra: '#B04E25',
  orange: '#E07A4A',
  sea: '#0B6A6A',
  night: '#0E1512',
  muted: '#4F5751',
  mutedDark: '#A3ACA5',
  line: '#D3C9B7',
  lineDark: '#2E3B35',
} as const;

export const F = {
  govde: fontFamily.body,
  govdeOrta: fontFamily.bodyMedium,
  govdeYari: fontFamily.bodySemiBold,
  govdeKalin: fontFamily.bodyBold,
  baslik: fontFamily.display,
  baslikAgir: fontFamily.displayHeavy,
} as const;

/** Kart metni: telefonun yazı büyüklüğü ayarından etkilenmez (görsel sabit ölçüde) */
export function T(p: TextProps) {
  return <Text allowFontScaling={false} {...p} style={[{ includeFontPadding: false }, p.style]} />;
}

export type Bicim = 'hikaye' | 'gonderi' | 'kare';
export const BICIM_OLCU: Record<Bicim, { w: number; h: number }> = {
  hikaye: { w: 360, h: 640 },
  gonderi: { w: 432, h: 540 },
  kare: { w: 480, h: 480 },
};

/** Tasarım ölçüsündeki içeriği `s` katıyla küçültüp/büyütüp yerleştirir */
export function Olcekli({ w, h, s, children }: { w: number; h: number; s: number; children: ReactNode }) {
  return (
    <View style={{ width: w * s, height: h * s, overflow: 'hidden' }}>
      <View style={{ width: w, height: h, transform: [{ scale: s }], transformOrigin: 'top left' }}>{children}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* İz                                                                  */
/* ------------------------------------------------------------------ */

export type Nokta = [number, number];
export type Kutu = { x: number; y: number; w: number; h: number };

/** Web Mercator "dünya pikseli" (yakınlaştırma 0, 256 px'lik karo) */
export const dunyaX = (lng: number) => ((lng + 180) / 360) * 256;
export function dunyaY(lat: number) {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256;
}

/** Dünya pikselinden kart pikseline: kart = o + dünya × s (harita zemini aynı dönüşümle çizilir) */
export type Cerceve = { s: number; ox: number; oy: number };

/**
 * İzi kutuya sığdırır (Web Mercator, harita karolarıyla aynı izdüşüm). `idx` her çizim noktasının izdeki sırası
 * (hız rengi için). Çok noktalı izler en fazla `enFazla` noktaya seyreltilir.
 */
export function izNoktalari(route: LngLat[], kutu: Kutu, enFazla = 400): { pts: Nokta[]; idx: number[]; cerceve: Cerceve | null } {
  if (route.length < 2) return { pts: [], idx: [], cerceve: null };
  const wx = route.map((c) => dunyaX(c[0]));
  const wy = route.map((c) => dunyaY(c[1]));
  const [minX, maxX, minY, maxY] = [Math.min(...wx), Math.max(...wx), Math.min(...wy), Math.max(...wy)];
  // Çok kısa izde (birkaç metre) aşırı büyütme olmasın: en fazla ~yakınlaştırma 17
  const s = Math.min(kutu.w / (maxX - minX || 1e-9), kutu.h / (maxY - minY || 1e-9), 2 ** 17);
  const cerceve: Cerceve = {
    s,
    ox: kutu.x + (kutu.w - (maxX - minX) * s) / 2 - minX * s,
    oy: kutu.y + (kutu.h - (maxY - minY) * s) / 2 - minY * s,
  };
  const adim = Math.max(1, Math.floor(route.length / enFazla));
  const idx: number[] = [];
  for (let i = 0; i < route.length; i += adim) idx.push(i);
  if (idx[idx.length - 1] !== route.length - 1) idx.push(route.length - 1);
  const pts = idx.map((i): Nokta => [cerceve.ox + wx[i] * s, cerceve.oy + wy[i] * s]);
  return { pts, idx, cerceve };
}

export const yolD = (pts: Nokta[]) => (pts.length < 2 ? '' : 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L'));

/** Noktalardan yumuşak eğri (Catmull-Rom → kübik Bézier) */
export function egriD(pts: Nokta[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Nokta = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Nokta = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Diziyi n değere indirir (kutu ortalaması); kısa diziyi doğrusal araya koymayla uzatır */
export function yenidenOrnekle(dizi: number[], n: number): number[] {
  if (dizi.length === 0) return new Array(n).fill(0);
  if (dizi.length === 1) return new Array(n).fill(dizi[0]);
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    if (dizi.length >= n) {
      const a = Math.floor((k * dizi.length) / n);
      const b = Math.max(a + 1, Math.floor(((k + 1) * dizi.length) / n));
      const dilim = dizi.slice(a, b);
      out.push(dilim.reduce((s, v) => s + v, 0) / dilim.length);
    } else {
      const t = (k / (n - 1)) * (dizi.length - 1);
      const i = Math.floor(t);
      const f = t - i;
      out.push(dizi[i] * (1 - f) + (dizi[Math.min(i + 1, dizi.length - 1)] ?? dizi[i]) * f);
    }
  }
  return out;
}

/**
 * İzin her noktasındaki hız (km/sa). Sunucudaki aktivitede mesafeye göre hız profili var;
 * örnek aktivitede zamana göre kutulanmış `speed` dizisi sıraya oranla eşlenir.
 * (Uçları kırpılmış izde ~200 m kayma olur; üç renk kademesinde görünmez.)
 */
export function noktaHizlari(a: Activity, route: LngLat[]): number[] {
  const hp = a.hizProfili;
  if (hp && hp.length > 1) {
    const out: number[] = [];
    let d = 0;
    let j = 0;
    for (let i = 0; i < route.length; i++) {
      if (i > 0) d += haversine({ lng: route[i - 1][0], lat: route[i - 1][1] }, { lng: route[i][0], lat: route[i][1] });
      while (j < hp.length - 1 && hp[j + 1].d <= d) j++;
      out.push(hp[j].v);
    }
    return out;
  }
  const s = a.speed;
  if (!s.length) return route.map(() => 0);
  return route.map((_, i) => s[Math.round((i / Math.max(1, route.length - 1)) * (s.length - 1))] ?? 0);
}

/* ------------------------------------------------------------------ */
/* Değerler                                                            */
/* ------------------------------------------------------------------ */

/** "1:38:20" → "1:38", "41:18" → "41 dk", "0:55" → "55 sn" */
export function kisaSure(s: string) {
  const p = s.split(':');
  if (p.length === 3) return `${p[0]}:${p[1]}`;
  return Number(p[0]) > 0 ? $t('paylasimKarti.dk', { number: Number(p[0]) }) : $t('paylasimKarti.sn', { number: Number(p[1]) });
}

export const buyuk = (s: string) => s.toLocaleUpperCase(yerel());
export const tur = (a: Activity) => ACTIVITY_LABELS[a.type];
export const yukseklikVar = (a: Activity) => a.hasElevation !== false;
export const hizVar = (a: Activity) => !a.hizGizli && a.maxSpeed !== '—';

/** "7 Kasım" (başlangıç zamanı yoksa aktivitedeki tarih metni) */
export function gun(a: Activity) {
  if (a.baslangic) return new Date(a.baslangic).toLocaleDateString(yerel(), { day: 'numeric', month: 'long' });
  return a.when.split(' · ')[0];
}
/** "7 Kasım 2026" */
export function tamTarih(a: Activity) {
  if (a.baslangic) return new Date(a.baslangic).toLocaleDateString(yerel(), { day: 'numeric', month: 'long', year: 'numeric' });
  return a.when.split(' · ')[0];
}
/** "07.11.2026" (dilin düzeniyle) */
export function kisaTarih(a: Activity) {
  if (a.baslangic) return new Date(a.baslangic).toLocaleDateString(yerel(), { day: '2-digit', month: '2-digit', year: 'numeric' });
  return a.when.split(' · ')[0];
}

export type Deger = { etiket: string; deger: string };
type DegerAdi = 'mesafe' | 'sure' | 'tirmanis' | 'inis' | 'maks' | 'ort';

/** İstenen sırayla, aktivitede olan değerlerden ilk `n` tanesi (hız gizliyse ya da rakım yoksa atlanır) */
export function degerler(a: Activity, sira: DegerAdi[], n: number): Deger[] {
  const out: Deger[] = [];
  for (const k of sira) {
    if (out.length >= n) break;
    if (k === 'mesafe') out.push({ etiket: $t('ortak.mesafe'), deger: `${a.distanceKm} ${kmUnit()}` });
    else if (k === 'sure') out.push({ etiket: $t('ortak.sure'), deger: kisaSure(a.durationMoving) });
    else if (k === 'tirmanis' && yukseklikVar(a)) out.push({ etiket: $t('ortak.tirmanis'), deger: `${a.climbM} ${mUnit()}` });
    else if (k === 'inis' && yukseklikVar(a)) out.push({ etiket: $t('paylasimTemalari.inis'), deger: `↓ ${a.descentM} ${mUnit()}` });
    else if (k === 'maks' && hizVar(a)) out.push({ etiket: $t('paylasimKarti.maks'), deger: a.maxSpeed });
    else if (k === 'ort' && hizVar(a) && a.avgSpeed !== '—') out.push({ etiket: $t('paylasimKarti.ort'), deger: a.avgSpeed });
  }
  return out;
}

/** Birlikte yapılan kişilerin kısa adları */
export function birlikteAdlar(a: Activity): string[] {
  if (a.birlikte?.length) return a.birlikte.filter((k) => !k.me).map((k) => k.kisa);
  return a.with.map((u) => `@${u}`);
}
