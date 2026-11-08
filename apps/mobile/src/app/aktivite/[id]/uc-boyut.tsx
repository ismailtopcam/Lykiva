/**
 * İnişli çıkışlı (3B) görünüm.
 * 2. aşamada stilize arazi çizimi + kaydırılabilir yükseklik profili.
 * Gerçek 3B arazi (MapLibre terrain + DEM verisi) harita sağlayıcısı seçilince eklenecek.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { ElevationProfile } from '@/components/charts';
import { FloatingHeader } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Button, Stat } from '@/components/ui';
import { kasKalkan } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

const ROUTE: [number, number][] = [
  [30, 352], [80, 322], [130, 300], [170, 258], [210, 214], [240, 184], [275, 198], [320, 240], [360, 270],
];

function lerp(arr: number[], t: number) {
  const f = t * (arr.length - 1);
  const i = Math.min(Math.floor(f), arr.length - 2);
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
}

export default function UcBoyutScreen() {
  const a = kasKalkan;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [pos, setPos] = useState(0.62);
  const [scale, setScale] = useState(1);
  const profileW = width - space.lg * 2;

  const alt = lerp(a.elevation, pos);
  const ahead = lerp(a.elevation, Math.min(1, pos + 0.02));
  const slope = ((ahead - alt) / (27400 * 0.02)) * 100;
  const sx = width / 390;
  const f = pos * (ROUTE.length - 1);
  const i = Math.min(Math.floor(f), ROUTE.length - 2);
  const mx = (ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * (f - i)) * sx;
  const my = ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * (f - i);
  const exaggerate = (y: number) => 380 - (380 - y) * (0.8 + scale * 0.2);

  const onScrub = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    setPos(Math.max(0, Math.min(1, x / profileW)));
  };

  return (
    <View style={styles.root}>
      <Svg width={width} height={460} style={{ marginTop: insets.top }} accessibilityLabel="Rotanın üç boyutlu arazi görünümü">
        <G transform={`scale(${sx},1)`}>
          <Path d="M0 170 L40 140 L80 152 L130 108 L170 128 L220 86 L260 118 L300 98 L350 128 L390 112 L390 460 L0 460Z" fill="#E2D8C5" />
          <Path d="M0 232 C 50 192, 90 212, 140 182 S 230 146, 270 188 S 340 200, 390 180 L390 460 L0 460Z" fill="#D5C8B0" />
          <Path d="M0 304 C 60 272, 120 302, 180 282 S 300 252, 390 292 L390 460 L0 460Z" fill="#C7B899" />
          <Path d="M0 384 C 80 362, 200 392, 390 372 L390 460 L0 460Z" fill={colors.water} />
          {ROUTE.slice(1, -1).map(([x, y]) => (
            <Line key={x} x1={x} x2={x} y1={exaggerate(y)} y2={y + 40 + (x / 8)} stroke={colors.terra} strokeOpacity={0.35} />
          ))}
          <Path d={'M' + ROUTE.map(([x, y]) => `${x} ${exaggerate(y)}`).join(' L')} fill="none" stroke={colors.surface} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          <Path d={'M' + ROUTE.map(([x, y]) => `${x} ${exaggerate(y)}`).join(' L')} fill="none" stroke={colors.terra} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={30} cy={exaggerate(352)} r={6} fill={colors.surface} stroke={colors.sea} strokeWidth={3} />
          <Circle cx={360} cy={exaggerate(270)} r={6} fill={colors.ink} stroke={colors.surface} strokeWidth={2} />
          <SvgText x={240} y={exaggerate(184) - 14} fontSize={11} fontWeight="700" fill={colors.ink} textAnchor="middle">
            {`${a.maxElevationM} m`}
          </SvgText>
        </G>
        <Circle cx={mx} cy={exaggerate(my)} r={9} fill={colors.ink} stroke={colors.surface} strokeWidth={3} />
      </Svg>

      <FloatingHeader
        middle={
          <View accessibilityRole="radiogroup" style={styles.seg}>
            {[1, 2, 3].map((s) => (
              <Pressable
                key={s}
                accessibilityRole="radio"
                accessibilityLabel={`Yükseklik abartısı ${s} kat`}
                accessibilityState={{ checked: s === scale }}
                onPress={() => setScale(s)}
                style={[styles.segBtn, s === scale && { backgroundColor: colors.ink }]}>
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13, color: s === scale ? colors.ground : colors.ink }}>{s}x</Txt>
              </Pressable>
            ))}
          </View>
        }
        right={<IconButton floating icon="rotate" label="Kamerayı döndür" />}
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Stat label="Konum" value={(pos * 27.4).toFixed(1).replace('.', ',')} unit="km" />
          <Stat label="Yükseklik" value={String(Math.round(alt))} unit="m" />
          <Stat
            label="Eğim"
            value={`${slope >= 0 ? '+' : ''}${slope.toFixed(1).replace('.', ',')}%`}
            color={slope > 4 ? colors.terra : slope < -4 ? colors.sea : colors.ink}
          />
          <Stat label="Hız" value={lerp(a.speed.filter((v) => v > 0), pos).toFixed(1).replace('.', ',')} />
        </View>
        <View
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={onScrub}
          onResponderMove={onScrub}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Rota boyunca konum"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(pos * 100) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => setPos((p) => Math.max(0, Math.min(1, p + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))}>
          <ElevationProfile values={a.elevation} width={profileW} height={100} cursor={pos} label="Yükseklik profili ve seçili nokta" />
        </View>
        <Txt variant="small" style={{ marginTop: 4 }}>
          Profil üzerinde parmağını kaydır
        </Txt>
        <Button label="Uçuş videosu oluştur" icon="video" variant="dark" style={{ marginTop: 12 }} />
        <Txt variant="small" style={{ textAlign: 'center', marginTop: 8 }}>
          {"Rotanın üzerinden uçan 15 sn'lik video · hikâyede paylaşılabilir"}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EFE8DB' },
  seg: { flexDirection: 'row', height: 44, borderRadius: 22, padding: 4, backgroundColor: colors.surface },
  segBtn: { minWidth: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: space.lg, paddingTop: 18 },
});
