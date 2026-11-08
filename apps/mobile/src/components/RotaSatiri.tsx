import { ACTIVITY_LABELS, formatKm } from '@lykiva/shared';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { RouteThumb } from '@/components/charts';
import { Txt } from '@/components/Txt';
import type { RotaOzeti } from '@/rota/rotalar';
import { colors, fontFamily } from '@/theme';

/** Rota listesi satırı: önizleme + ad + mesafe / tırmanış */
export function RotaSatiri({ rota, onPress, bekliyor }: { rota: RotaOzeti; onPress: () => void; bekliyor?: boolean }) {
  const ayrinti = [
    `${formatKm(rota.mesafeM)} km`,
    rota.tirmanisM != null ? `↑ ${Math.round(rota.tirmanisM)} m` : null,
    ACTIVITY_LABELS[rota.activity],
    rota.dongu ? 'döngü' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rota.ad}, ${ayrinti}`}
      onPress={onPress}
      disabled={bekliyor}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      {rota.onizleme.length > 1 ? <RouteThumb route={rota.onizleme} color={colors.sea} /> : <View style={{ width: 64, height: 64 }} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
          {rota.ad}
        </Txt>
        <Txt variant="small">{ayrinti}</Txt>
      </View>
      {bekliyor ? <ActivityIndicator color={colors.sea} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
});
