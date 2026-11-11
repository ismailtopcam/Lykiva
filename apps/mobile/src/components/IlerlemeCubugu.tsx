import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/**
 * İlerleme çubuğu (0–1). `isaret` verilirse o noktada ince bir çizgi: dönemin geçen kısmı ("planda olmak için buradasın").
 * Erişilebilirlik etiketini çağıran verir (metin zaten yanında yazılı).
 */
export function IlerlemeCubugu({
  oran,
  isaret,
  renk = colors.terra,
  zemin = colors.land,
  yukseklik = 10,
}: {
  oran: number;
  isaret?: number;
  renk?: string;
  zemin?: string;
  yukseklik?: number;
}) {
  const o = Math.min(1, Math.max(0, oran));
  return (
    <View style={[styles.zemin, { height: yukseklik, borderRadius: yukseklik / 2, backgroundColor: zemin }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: `${o * 100}%`, height: '100%', borderRadius: yukseklik / 2, backgroundColor: renk }} />
      {isaret != null && isaret > 0 && isaret < 1 ? <View style={[styles.isaret, { left: `${isaret * 100}%`, height: yukseklik + 6, top: -3 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zemin: { width: '100%', overflow: 'visible' },
  isaret: { position: 'absolute', width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.ink, opacity: 0.55 },
});
