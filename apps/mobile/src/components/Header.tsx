import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import type { IconName } from '@/components/Icon';
import { colors, space } from '@/theme';
import { $t } from '@/i18n';

/** Düz başlık çubuğu: geri + başlık + sağ öğe */
export function Header({
  title,
  right,
  backIcon = 'back',
  dark,
  center,
}: {
  title?: string;
  right?: ReactNode;
  backIcon?: IconName;
  dark?: boolean;
  center?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const fg = dark ? colors.night.text : colors.ink;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4 }]}>
      <IconButton icon={backIcon} label={backIcon === 'close' ? $t('ortak.kapat') : $t('ortak.geri')} color={fg} onPress={() => router.back()} />
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start' }}>
        {title ? (
          <Txt variant="heading" color={fg} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Txt>
        ) : null}
      </View>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** Harita üstünde yüzen başlık: yuvarlak, gölgeli butonlar */
export function FloatingHeader({
  left,
  middle,
  right,
}: {
  left?: ReactNode;
  middle?: ReactNode;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.floating, { top: insets.top + 6 }]}>
      {left ?? <IconButton floating icon="back" label={$t('ortak.geri')} onPress={() => router.back()} />}
      <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center' }}>
        {middle}
      </View>
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingBottom: space.xs, gap: 4 },
  floating: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    zIndex: 10,
  },
});
