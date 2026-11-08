/**
 * Basit SVG grafikler: yükseklik profili, hız grafiği.
 */
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { colors } from '@/theme';

function linePath(values: number[], w: number, h: number, pad = 6, min?: number, max?: number) {
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, pad + (h - pad * 2) * (1 - (v - lo) / span)] as const);
  return { d: 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L'), pts, lo, hi };
}

export function ElevationProfile({
  values,
  width,
  height = 96,
  color = colors.terra,
  markers = [],
  cursor,
  label,
}: {
  values: number[];
  width: number;
  height?: number;
  color?: string;
  /** 0..1 konumlarında numaralı işaretler (molalar) */
  markers?: { at: number; n: number }[];
  /** 0..1 seçili konum */
  cursor?: number;
  label: string;
}) {
  const { d, lo, hi } = linePath(values, width, height);
  const yAt = (t: number) => {
    const f = t * (values.length - 1);
    const i = Math.min(Math.floor(f), values.length - 2);
    const v = values[i] + (values[i + 1] - values[i]) * (f - i);
    return 6 + (height - 12) * (1 - (v - lo) / (hi - lo || 1));
  };
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.32} />
            <Stop offset="1" stopColor={color} stopOpacity={0.03} />
          </LinearGradient>
        </Defs>
        <Path d={`${d} L${width} ${height} L0 ${height}Z`} fill="url(#elevFill)" />
        <Path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {markers.map((m) => (
          <G key={m.n}>
            <Line x1={m.at * width} x2={m.at * width} y1={yAt(m.at)} y2={height} stroke={colors.ink} strokeDasharray="3 3" />
            <Circle cx={m.at * width} cy={Math.max(9, yAt(m.at) - 2)} r={8} fill={colors.ink} />
            <SvgText x={m.at * width} y={Math.max(9, yAt(m.at) - 2) + 4} fontSize={10} fontWeight="700" fill={colors.surface} textAnchor="middle">
              {String(m.n)}
            </SvgText>
          </G>
        ))}
        {cursor !== undefined ? (
          <>
            <Line x1={cursor * width} x2={cursor * width} y1={0} y2={height} stroke={colors.ink} strokeWidth={1.5} />
            <Circle cx={cursor * width} cy={yAt(cursor)} r={5} fill={colors.ink} stroke={colors.surface} strokeWidth={2} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

export function SpeedChart({
  values,
  width,
  height = 140,
  avg,
  maxIndex,
  start,
  end,
  label,
}: {
  values: number[];
  width: number;
  height?: number;
  avg: number;
  maxIndex: number;
  start: string;
  end: string;
  label: string;
}) {
  const chartH = height - 20;
  const max = Math.max(...values) * 1.08;
  const step = width / (values.length - 1);
  const y = (v: number) => chartH - (v / max) * (chartH - 4);
  const d = 'M' + values.map((v, i) => `${(i * step).toFixed(1)} ${y(v).toFixed(1)}`).join(' L');
  const bands = values
    .map((v, i) => (v === 0 ? i : -1))
    .filter((i) => i >= 0)
    .map((i, k) => ({ x: Math.max(0, i * step - step / 2), w: step, n: k + 1 }));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={width} height={height}>
        {bands.map((b) => (
          <Rect key={b.n} x={b.x} y={0} width={b.w} height={chartH} fill="#EADFC9" />
        ))}
        <Line x1={0} x2={width} y1={chartH} y2={chartH} stroke={colors.lineStrong} />
        <Line x1={0} x2={width} y1={y(avg)} y2={y(avg)} stroke={colors.sea} strokeWidth={1.5} strokeDasharray="4 4" />
        <Path d={d} fill="none" stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" />
        <Circle cx={maxIndex * step} cy={y(values[maxIndex])} r={5} fill={colors.terra} stroke={colors.surface} strokeWidth={2} />
        {bands.map((b) => (
          <SvgText key={'t' + b.n} x={b.x + b.w / 2} y={height - 4} fontSize={10} fontWeight="700" fill={colors.inkMuted} textAnchor="middle">
            {String(b.n)}
          </SvgText>
        ))}
        <SvgText x={0} y={height - 4} fontSize={10} fill={colors.inkMuted}>
          {start}
        </SvgText>
        <SvgText x={width} y={height - 4} fontSize={10} fill={colors.inkMuted} textAnchor="end">
          {end}
        </SvgText>
      </Svg>
    </View>
  );
}

/** Mini rota çizimi: liste kartlarında küçük harita küçük resmi */
export function RouteThumb({ route, size = 64, height, color = colors.terra }: { route: [number, number][]; size?: number; height?: number; color?: string }) {
  const w = size;
  const h = height ?? size;
  const xs = route.map((p) => p[0]);
  const ys = route.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = Math.min(w, h) * 0.16;
  const s = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
  const offX = (w - (maxX - minX) * s) / 2;
  const offY = (h - (maxY - minY) * s) / 2;
  const d =
    'M' +
    route
      .map(([x, yy]) => `${(offX + (x - minX) * s).toFixed(1)} ${(h - offY - (yy - minY) * s).toFixed(1)}`)
      .join(' L');
  return (
    <Svg width={w} height={h} style={{ borderRadius: 12 }}>
      <Rect width={w} height={h} rx={12} fill={colors.land} />
      <Path d={`M0 ${h * 0.75} C ${w * 0.25} ${h * 0.68}, ${w * 0.45} ${h * 0.85}, ${w} ${h * 0.9} L${w} ${h} L0 ${h}Z`} fill={colors.water} />
      <Path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
