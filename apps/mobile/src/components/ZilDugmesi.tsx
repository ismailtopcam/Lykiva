/**
 * Akış başlığındaki zil: okunmamış bildirim sayısı rozetiyle, bildirimler ekranını açar.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useBildirimSayisi } from '@/bildirim/bildirimler';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { colors, fontFamily, minTouchTarget } from '@/theme';

export function ZilDugmesi() {
  const n = useBildirimSayisi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={n ? `Bildirimler, ${n} okunmamış` : 'Bildirimler'}
      onPress={() => router.push('/bildirimler')}
      hitSlop={4}
      style={({ pressed }) => [styles.base, pressed && { opacity: 0.6 }]}>
      <Icon name="bell" size={22} strokeWidth={2} color={colors.ink} />
      {n > 0 ? (
        <View style={styles.badge} pointerEvents="none">
          <Txt style={styles.badgeText}>{n > 99 ? '99+' : n}</Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: minTouchTarget, height: minTouchTarget, borderRadius: minTouchTarget / 2, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.terra,
    borderWidth: 2,
    borderColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 10, lineHeight: 12 },
});
