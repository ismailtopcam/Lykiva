import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Avatar, Button, ToggleRow } from '@/components/ui';
import { kasKalkanRoute, liveFriends, people } from '@/data/ornek';
import { colors, fontFamily, radius, space } from '@/theme';

export default function CanliHaritaScreen() {
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState(0);
  const [share, setShare] = useState(true);

  return (
    <View style={styles.root}>
      <TopoMap
        style={StyleSheet.absoluteFill}
        route={kasKalkanRoute.slice(0, 8)}
        markers={liveFriends.map((f) => {
          const p = people[f.person];
          return {
            id: f.person,
            coord: f.coord,
            kind: 'friend' as const,
            render: (
              <View style={{ alignItems: 'center', gap: 4 }}>
                <View style={[styles.tag, f.paused && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong }]}>
                  <Txt numberOfLines={1} style={{ fontSize: 11, fontFamily: fontFamily.bodySemiBold, color: f.paused ? colors.ink : colors.ground }}>
                    {p.short} · {f.label}
                  </Txt>
                </View>
                <View style={[styles.pin, { borderColor: f.paused ? '#9C9282' : f.person === 'deniz' ? colors.sea : colors.terra }]}>
                  <Avatar initials={p.initials} tone={p.tone} size={28} />
                </View>
              </View>
            ),
          };
        })}
        padding={{ top: 140, bottom: 400 }}
        accessibilityLabel="Arkadaşların canlı konumlarını gösteren harita"
      />
      <FloatingHeader
        middle={
          <View accessibilityRole="tablist" style={styles.seg}>
            {['Arkadaşlar', 'Pedal Kaş grubu'].map((t, i) => (
              <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: i === scope }} onPress={() => setScope(i)} style={[styles.segBtn, i === scope && { backgroundColor: colors.ink }]}>
                <Txt style={{ fontSize: 13, fontFamily: fontFamily.bodySemiBold, color: i === scope ? colors.ground : colors.ink }}>{t}</Txt>
              </Pressable>
            ))}
          </View>
        }
        right={<IconButton floating icon="pin" label="Konumuma git" />}
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grip} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <Txt variant="heading" style={{ fontSize: 20 }}>
            Şu an yolda
          </Txt>
          <Txt variant="small">{liveFriends.length} kişi canlı paylaşıyor</Txt>
        </View>
        {liveFriends.map((f) => {
          const p = people[f.person];
          return (
            <View key={f.person} style={styles.row}>
              <Avatar initials={p.initials} tone={p.tone} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>{p.name}</Txt>
                <Txt variant="small" numberOfLines={1}>
                  {f.activity} · {f.detail}
                </Txt>
              </View>
              {f.paused ? (
                <Button label="Mesaj" variant="outline" href="/grup/ornek/sohbet" style={styles.small} />
              ) : (
                <Button label="İzle" variant="dark" href="/kayit/canli" style={styles.small} />
              )}
            </View>
          );
        })}
        <View style={styles.shareBox}>
          <Icon name="shield" size={22} color={colors.sea} />
          <View style={{ flex: 1 }}>
            <ToggleRow title="Canlı konumumu paylaş" subtitle="Sadece yakın arkadaşlar ve Pedal Kaş" value={share} onChange={setShare} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  seg: { flexDirection: 'row', height: 44, borderRadius: 22, padding: 4, backgroundColor: colors.surface, alignSelf: 'stretch' },
  segBtn: { flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.ink },
  pin: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: 10 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ECE4D6' },
  small: { height: 36, paddingHorizontal: 14 },
  shareBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, backgroundColor: colors.ground },
});
