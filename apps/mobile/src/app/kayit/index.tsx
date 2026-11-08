import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from '@lykiva/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button, ListRow, ToggleRow } from '@/components/ui';
import { kasKalkanRoute } from '@/data/ornek';
import { colors, fontFamily, radius, space } from '@/theme';

const icons: Record<ActivityType, IconName> = {
  bike: 'bike',
  mtb: 'bike',
  run: 'run',
  walk: 'walk',
  hike: 'mountain',
  trail_run: 'mountain',
};

export default function KayitBaslatScreen() {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<ActivityType>('bike');
  const [share, setShare] = useState(true);

  return (
    <View style={styles.root}>
      <TopoMap
        style={StyleSheet.absoluteFill}
        markers={[{ id: 'me', coord: kasKalkanRoute[0], kind: 'me' }]}
        route={kasKalkanRoute.slice(0, 5)}
        padding={{ top: 110, bottom: 560 }}
        accessibilityLabel="Bulunduğun konumun haritası"
      />
      <FloatingHeader
        left={<IconButton floating icon="close" label="Kapat" onPress={() => router.back()} />}
        middle={
          <View style={styles.gps}>
            <View style={styles.gpsDot} />
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12 }}>GPS hazır</Txt>
          </View>
        }
        right={<IconButton floating icon="layers" label="Harita katmanları" />}
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <Txt variant="heading" accessibilityRole="header" style={{ marginBottom: 12 }}>
          Ne yapıyorsun?
        </Txt>
        <View accessibilityRole="radiogroup" style={styles.grid}>
          {ACTIVITY_TYPES.map((t) => {
            const on = t === type;
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setType(t)}
                style={[styles.tile, on && styles.tileOn]}>
                <Icon name={icons[t]} size={24} color={on ? colors.ground : colors.ink} />
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: on ? colors.ground : colors.ink }}>{ACTIVITY_LABELS[t]}</Txt>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: space.sm }}>
          <ListRow icon="route" iconTone="terra" caption="Rota" title="Kaş – Kalkan sahil yolu · 27,4 km" href="/rota/ornek" />
          <ListRow icon="users" iconTone="sea" caption="Kiminle" title="Pedal Kaş · Mert, Deniz, Can" href="/grup/ornek" />
        </View>
        <ToggleRow title="Grupla canlı konum paylaş" value={share} onChange={setShare} />

        <Button label="Başlat" icon="play" big href="/kayit/canli" style={{ marginTop: space.md }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  gps: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sea },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.lg,
    paddingTop: 18,
    gap: space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  tile: { width: '31.6%', height: 72, borderRadius: 16, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: 'transparent' },
  tileOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
