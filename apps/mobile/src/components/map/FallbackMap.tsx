/**
 * Expo Go için stilize harita: Design canvas'ındaki topoğrafik çizimin aynısı.
 * Gerçek harita değildir; rota koordinatları kutuya oranlanarak çizilir.
 */
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { LngLat } from '@/data/ornek';
import { GIDILEN_RENGI, ROTA_RENGI } from './stilRenkleri';
import type { TopoMapProps } from './TopoMap';

const light = { land: '#E8E0CF', water: '#CBE1DC', contour: '#D3C7B0', casing: '#FBF8F2', line: ROTA_RENGI.acik, gidilen: GIDILEN_RENGI.acik, rest: '#9C9282' };
const night = { land: '#121B17', water: '#12302E', contour: '#24302B', casing: '#0E1512', line: ROTA_RENGI.koyu, gidilen: GIDILEN_RENGI.koyu, rest: '#6E7A73' };

export function FallbackMap({ route = [], progress, markers = [], dark, padding }: TopoMapProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const c = dark ? night : light;
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const { w, h } = size;

  const all = route.length ? route : markers.map((m) => m.coord);
  const pad = { top: 60, right: 40, bottom: 40, left: 40, ...padding };
  const project = makeProjection(all, w, h, pad);

  const split = progress !== undefined ? Math.max(1, Math.round(progress * (route.length - 1))) : route.length - 1;
  const done = route.slice(0, split + 1).map(project);
  const rest = route.slice(split).map(project);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          <Rect width={w} height={h} fill={c.land} />
          <Path d={`M0 ${h * 0.78} C ${w * 0.15} ${h * 0.73}, ${w * 0.3} ${h * 0.86}, ${w * 0.5} ${h * 0.9} S ${w * 0.85} ${h * 0.93}, ${w} ${h * 0.88} L${w} ${h} L0 ${h}Z`} fill={c.water} />
          <G fill="none" stroke={c.contour} strokeWidth={1}>
            {[1, 0.74, 0.48].map((k) => (
              <Ellipse key={'a' + k} cx={w * 0.66} cy={h * 0.32} rx={w * 0.2 * k} ry={h * 0.14 * k} />
            ))}
            {[1, 0.7].map((k) => (
              <Ellipse key={'b' + k} cx={w * 0.18} cy={h * 0.36} rx={w * 0.14 * k} ry={h * 0.12 * k} />
            ))}
            {[1, 0.6].map((k) => (
              <Ellipse key={'c' + k} cx={w * 0.4} cy={h * 0.62} rx={w * 0.1 * k} ry={h * 0.06 * k} />
            ))}
          </G>
          {route.length > 1 ? (
            <Path d={toPath(route)} fill="none" stroke={c.casing} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {done.length > 1 ? (
            <Path d={toPath(done)} fill="none" stroke={progress !== undefined ? c.gidilen : c.line} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {progress !== undefined && rest.length > 1 ? (
            <Path d={toPath(rest)} fill="none" stroke={c.rest} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {markers
            .filter((m) => m.kind !== 'friend')
            .map((m) => {
              const [x, y] = project(m.coord);
              if (m.kind === 'start') return <Circle key={m.id} cx={x} cy={y} r={7} fill={c.casing} stroke={c.line} strokeWidth={3} />;
              if (m.kind === 'end') return <Circle key={m.id} cx={x} cy={y} r={7} fill={c.line} stroke={c.casing} strokeWidth={2} />;
              if (m.kind === 'me')
                return (
                  <G key={m.id}>
                    <Circle cx={x} cy={y} r={22} fill={dark ? '#E07A4A' : '#0B6A6A'} fillOpacity={0.18} />
                    <Circle cx={x} cy={y} r={9} fill={dark ? '#E07A4A' : '#0B6A6A'} stroke={c.casing} strokeWidth={3} />
                  </G>
                );
              if (m.kind === 'cursor') return <Circle key={m.id} cx={x} cy={y} r={8} fill={c.casing} stroke="#16201B" strokeWidth={3.5} />;
              if (m.kind === 'meeting') return <Circle key={m.id} cx={x} cy={y} r={9} fill="#0B6A6A" stroke={c.casing} strokeWidth={3} />;
              return (
                <G key={m.id}>
                  <Circle cx={x} cy={y} r={11} fill="#16201B" />
                  <SvgText x={x} y={y + 4} fontSize={11} fontWeight="700" fill="#FBF8F2" textAnchor="middle">
                    {m.text ?? ''}
                  </SvgText>
                </G>
              );
            })}
        </Svg>
      ) : null}
      {w > 0
        ? markers
            .filter((m) => m.kind === 'friend')
            .map((m) => {
              const [x, y] = project(m.coord);
              return (
                <View key={m.id} style={{ position: 'absolute', left: x, top: y, transform: [{ translateX: -80 }, { translateY: -64 }], width: 160, alignItems: 'center' }}>
                  {m.render}
                </View>
              );
            })
        : null}
    </View>
  );
}

function makeProjection(pts: LngLat[], w: number, h: number, pad: { top: number; right: number; bottom: number; left: number }) {
  if (!pts.length || !w) return (p: LngLat) => [w / 2, h / 2] as [number, number];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const availW = w - pad.left - pad.right;
  const availH = h - pad.top - pad.bottom;
  const s = Math.min(availW / (maxX - minX || 0.01), availH / (maxY - minY || 0.01));
  const offX = pad.left + (availW - (maxX - minX) * s) / 2;
  const offY = pad.top + (availH - (maxY - minY) * s) / 2;
  return (p: LngLat) => [offX + (p[0] - minX) * s, offY + (maxY - p[1]) * s] as [number, number];
}

function toPath(pts: [number, number][]) {
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
}
