import { ACTIVITY_LABELS, ACTIVITY_TYPES } from '@lykiva/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/ScreenShell';
import { Txt } from '@/components/Txt';
import { colors, radius, space } from '@/theme';

export default function KayitBaslatScreen() {
  const [selected, setSelected] = useState<(typeof ACTIVITY_TYPES)[number]>('bike');

  return (
    <ScreenShell
      title="Ne yapıyorsun?"
      plan={[
        'GPS durumu ve harita üzerinde konumun',
        'Rota seçimi (veya serbest kayıt)',
        'Kiminle: grup seçimi ve grupla canlı konum paylaşımı',
      ]}
      links={[{ label: 'Başlat (canlı takip)', href: '/kayit/canli' }]}>
      <View accessibilityRole="radiogroup" style={styles.grid}>
        {ACTIVITY_TYPES.map((t) => {
          const on = t === selected;
          return (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setSelected(t)}
              style={[styles.tile, on && styles.tileOn]}>
              <Txt color={on ? colors.ground : colors.ink} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                {ACTIVITY_LABELS[t]}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '31.5%',
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
