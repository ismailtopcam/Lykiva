/**
 * Paylaşım kartı — aktivitenin gerçek izi ve seçilen istatistiklerle.
 * Önizlemede 196 pt genişlikte; görsel üretirken aynı kart daha büyük çizilip yakalanır.
 */
import { ACTIVITY_LABELS, haversine, mUnit } from '@lykiva/shared';
import type { Ref } from 'react';
import { View, type HostInstance } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import type { Activity, LngLat } from '@/data/ornek';
import { fontFamily } from '@/theme';
import { Txt } from './Txt';
import { $t, yerel } from '@/i18n';

export const KART_SABLONLARI = () => [
  { name: $t('paylasimKarti.gece'), bg: '#16201B', fg: '#F2EDE3', route: '#E07A4A', contour: '#33413A' },
  { name: $t('paylasimKarti.kirectasi'), bg: '#F2EDE3', fg: '#16201B', route: '#B04E25', contour: '#D3C7B0' },
  { name: $t('paylasimKarti.deniz'), bg: '#0B6A6A', fg: '#FFFFFF', route: '#F6D9A8', contour: '#2A8282' },
  { name: $t('paylasimKarti.kaya'), bg: '#B04E25', fg: '#FFFFFF', route: '#FBF8F2', contour: '#C26A44' },
] as const;

export type KartIstatistigi = 'mesafe' | 'sure' | 'tirmanis' | 'maks' | 'ort' | 'mola' | 'hava' | 'kisiler';

/** Baştan ve sondan metre kadar kırpar (ev / iş konumu görünmesin) */
export function uclariKirp(route: LngLat[], metre = 200): LngLat[] {
  if (route.length < 3) return route;
  const pt = (c: LngLat) => ({ lng: c[0], lat: c[1] });
  let toplam = 0;
  for (let i = 1; i < route.length; i++) toplam += haversine(pt(route[i - 1]), pt(route[i]));
  if (toplam < metre * 3) return route;
  let d = 0;
  const out: LngLat[] = [];
  for (let i = 0; i < route.length; i++) {
    if (i > 0) d += haversine(pt(route[i - 1]), pt(route[i]));
    if (d >= metre && d <= toplam - metre) out.push(route[i]);
  }
  return out.length > 1 ? out : route;
}

/** İzi kutuya sığdırır (enlem düzeltmeli) ve SVG yolu üretir */
function izYolu(route: LngLat[], w: number, h: number, pad: number) {
  if (route.length < 2) return { d: '', a: null as [number, number] | null, b: null as [number, number] | null };
  const lat0 = route.reduce((s, c) => s + c[1], 0) / route.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = route.map((c) => c[0] * kx);
  const ys = route.map((c) => c[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((w - pad * 2) / (maxX - minX || 1e-9), (h - pad * 2) / (maxY - minY || 1e-9));
  const offX = (w - (maxX - minX) * s) / 2;
  const offY = (h - (maxY - minY) * s) / 2;
  const P = (i: number): [number, number] => [offX + (xs[i] - minX) * s, h - offY - (ys[i] - minY) * s];
  // Çok noktalı izlerde çizimi hafiflet
  const adim = Math.max(1, Math.floor(route.length / 400));
  const idx: number[] = [];
  for (let i = 0; i < route.length; i += adim) idx.push(i);
  if (idx[idx.length - 1] !== route.length - 1) idx.push(route.length - 1);
  const d = 'M' + idx.map((i) => P(i).map((v) => v.toFixed(1)).join(' ')).join(' L');
  return { d, a: P(0), b: P(route.length - 1) };
}

/** "1:38:20" → "1:38", "41:18" → "41 dk", "0:55" → "55 sn" */
function kisaSure(s: string) {
  const p = s.split(':');
  if (p.length === 3) return `${p[0]}:${p[1]}`;
  return Number(p[0]) > 0 ? $t('paylasimKarti.dk', { number: Number(p[0]) }) : $t('paylasimKarti.sn', { number: Number(p[1]) });
}

type Props = {
  a: Activity;
  sablon: number;
  goster: Partial<Record<KartIstatistigi, boolean>>;
  uclariGizle: boolean;
  /** Kart genişliği (pt); yükseklik tasarımdaki oranla (196 × 300) */
  genislik?: number;
  /** Görsel yakalamak için */
  ref?: Ref<HostInstance>;
};

export function PaylasimKarti({ a, sablon, goster, uclariGizle, genislik = 196, ref }: Props) {
  const L = KART_SABLONLARI()[sablon];
  const k = genislik / 196;
  const route = uclariGizle ? uclariKirp(a.route) : a.route;
  const W = 164 * k;
  const H = 120 * k;
  const iz = izYolu(route, W, H, 10 * k);

  const istatistikler = (
    [
      goster.sure && [$t('ortak.sure'), kisaSure(a.durationMoving)],
      goster.tirmanis && a.hasElevation !== false && [$t('ortak.tirmanis'), `${a.climbM} ${mUnit()}`],
      goster.maks && [$t('paylasimKarti.maks'), a.maxSpeed],
      goster.ort && [$t('paylasimKarti.ort'), a.avgSpeed],
      goster.mola && [$t('paylasimKarti.mola'), String(a.stops.length)],
      goster.hava && a.hava && [$t('ortak.hava'), $t('paylasimKarti.c', { round: Math.round(a.hava.sicaklik) })],
    ].filter(Boolean) as [string, string][]
  ).slice(0, 3);

  const etiket = `${ACTIVITY_LABELS[a.type]} · ${a.title}`.toLocaleUpperCase(yerel());

  return (
    <View
      ref={ref}
      collapsable={false}
      accessible
      accessibilityLabel={$t('paylasimKarti.paylasim_karti_sablonu_kilometre', { name: L.name, title: a.title, distanceKm: a.distanceKm })}
      style={{ width: genislik, height: 300 * k, borderRadius: 18 * k, padding: 16 * k, backgroundColor: L.bg, justifyContent: 'space-between', overflow: 'hidden' }}>
      <Svg width={W} height={H}>
        <G fill="none" stroke={L.contour} strokeWidth={0.8 * k}>
          <Path d={`M${60 * k} ${30 * k} C ${80 * k} ${12 * k}, ${130 * k} ${10 * k}, ${150 * k} ${30 * k} S ${150 * k} ${70 * k}, ${120 * k} ${70 * k} S ${50 * k} ${60 * k}, ${60 * k} ${30 * k}Z`} />
          <Path d={`M${80 * k} ${34 * k} C ${94 * k} ${24 * k}, ${124 * k} ${24 * k}, ${134 * k} ${34 * k} S ${132 * k} ${56 * k}, ${114 * k} ${56 * k} S ${74 * k} ${50 * k}, ${80 * k} ${34 * k}Z`} />
          <Path d={`M${10 * k} ${70 * k} C ${26 * k} ${50 * k}, ${56 * k} ${52 * k}, ${60 * k} ${72 * k} S ${40 * k} ${100 * k}, ${22 * k} ${96 * k} S 0 ${86 * k}, ${10 * k} ${70 * k}Z`} />
        </G>
        {iz.d ? <Path d={iz.d} fill="none" stroke={L.route} strokeWidth={3.5 * k} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {!uclariGizle && iz.a && iz.b ? (
          <>
            <Circle cx={iz.a[0]} cy={iz.a[1]} r={4 * k} fill={L.route} />
            <Circle cx={iz.b[0]} cy={iz.b[1]} r={4 * k} fill="none" stroke={L.route} strokeWidth={2 * k} />
          </>
        ) : null}
      </Svg>
      <View>
        <Txt numberOfLines={1} style={{ fontSize: 10 * k, fontFamily: fontFamily.bodySemiBold, letterSpacing: 0.8 * k, color: L.fg, opacity: 0.85 }}>
          {etiket}
        </Txt>
        {goster.mesafe ? (
          <Txt style={{ fontFamily: fontFamily.displayHeavy, fontSize: 40 * k, lineHeight: 44 * k, color: L.fg, letterSpacing: -1.2 * k }}>{$t('paylasimKarti.km', { distanceKm: a.distanceKm })}</Txt>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 * k, marginTop: 6 * k }}>
          {istatistikler.map(([l, v]) => (
            <View key={l} style={{ flex: 1 }}>
              <Txt style={{ fontSize: 10 * k, color: L.fg, opacity: 0.85 }}>{l}</Txt>
              <Txt style={{ fontSize: 13 * k, fontFamily: fontFamily.bodyBold, color: L.fg }}>{v}</Txt>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 * k }}>
          <Txt numberOfLines={1} style={{ flex: 1, fontSize: 10 * k, fontFamily: fontFamily.bodySemiBold, color: L.fg }}>
            {goster.kisiler && a.with.length ? a.with.map((p) => `@${p}`).join(' · ') : ''}
          </Txt>
          <Txt style={{ fontSize: 13 * k, fontFamily: fontFamily.displayHeavy, color: L.fg }}>lykiva</Txt>
        </View>
      </View>
    </View>
  );
}

/**
 * Instagram / WhatsApp hikâyesi için 9:16 görsel: kart, şablon renginde dikey zeminin ortasında.
 * 360 × 640 pt çizilir, 1080 × 1920 px yakalanır.
 */
export function HikayeGorseli({ ref, ...p }: Omit<Props, 'genislik'>) {
  const L = KART_SABLONLARI()[p.sablon];
  return (
    <View ref={ref} collapsable={false} style={{ width: 360, height: 640, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center' }}>
      <PaylasimKarti {...p} genislik={316} />
    </View>
  );
}
