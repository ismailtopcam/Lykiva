/**
 * Bisiklet egzersizinde haritadaki "ben" işareti: yuvarlak yerine bisiklet.
 * Boyu yuvarlak işaretle aynı (yarıçap 9 + 2,5 kenar ≈ 23 nokta genişlik). Haritada seçilsin diye açık renk kenarlı.
 */
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

/** Bisikletin genişliği yuvarlak işaretin çapına (≈23) denk gelsin diye (ikon 24'lük kutuda ~19 genişlik) */
export const BISIKLET_IMLECI_BOYU = 28;

export function BisikletImleci({ renk, kenar = '#FBF8F2' }: { renk: string; kenar?: string }) {
  return (
    <View pointerEvents="none" style={{ width: BISIKLET_IMLECI_BOYU, height: BISIKLET_IMLECI_BOYU }}>
      <Svg width={BISIKLET_IMLECI_BOYU} height={BISIKLET_IMLECI_BOYU} viewBox="0 0 24 24">
        <BisikletCizimi renk={kenar} kalinlik={5} />
        <BisikletCizimi renk={renk} kalinlik={2.4} />
      </Svg>
    </View>
  );
}

/** Icon.tsx'teki 'bike' ikonunun çizgileri (24×24 kutuda); FallbackMap de kullanır */
export function BisikletCizimi({ renk, kalinlik }: { renk: string; kalinlik: number }) {
  const p = { fill: 'none', stroke: renk, strokeWidth: kalinlik, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <G>
      <Circle cx={6} cy={16} r={3.5} {...p} />
      <Circle cx={18} cy={16} r={3.5} {...p} />
      <Path d="M6 16l4-7h5l3 7M10 9l3 7M13 6h3" {...p} />
    </G>
  );
}
