import { router } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ElevationProfile } from '@/components/charts';
import { FloatingHeader } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { AvatarStack, Button, Stat } from '@/components/ui';
import { faralyaKabak, people } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

export default function RotaDetayScreen() {
  const r = faralyaKabak;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const friends = r.friendsDone.map((id) => people[id]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <TopoMap
          style={{ height: 270 + insets.top }}
          route={r.route}
          markers={[
            { id: 's', coord: r.route[0], kind: 'start' },
            { id: 'e', coord: r.route[r.route.length - 1], kind: 'end' },
          ]}
          padding={{ top: insets.top + 70, bottom: 30 }}
          accessibilityLabel={`${r.title} rotasının haritası`}
        />
        <View style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {[
              [r.difficulty, colors.terraSoft, colors.terraInk],
              [r.type, colors.seaSoft, colors.seaInk],
              [r.direction, colors.sand, colors.sandInk],
            ].map(([t, bg, fg]) => (
              <View key={t} style={[styles.tag, { backgroundColor: bg }]}>
                <Txt style={{ fontSize: 12, fontFamily: fontFamily.bodyBold, color: fg }}>{t}</Txt>
              </View>
            ))}
          </View>
          <Txt variant="display" style={{ fontSize: 27 }} accessibilityRole="header">
            {r.title}
          </Txt>
          <Txt variant="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {r.by}
          </Txt>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 }}>
            <Stat label="Mesafe" value={`${r.distanceKm} km`} />
            <Stat label="Tırmanış" value={`↑ ${r.climbM} m`} />
            <Stat label="Ortalama süre" value={r.avgTime} />
          </View>
          <ElevationProfile values={r.elevation} width={width - space.lg * 2} height={56} color={colors.ink} label="Yükseklik profili" />

          <View style={styles.done}>
            <AvatarStack items={friends} size={30} bg={colors.ground} />
            <Txt style={{ fontSize: 13, flex: 1 }}>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{friends.map((f) => f.short).join(' ve ')}</Txt>{' '}
              <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>dahil {r.doneBy.toLocaleString('tr-TR')} kişi bu rotayı yaptı</Txt>
            </Txt>
          </View>

          <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14, marginTop: 12, marginBottom: 6 }}>Topluluk notları</Txt>
          <Txt style={{ fontSize: 13, lineHeight: 20, color: '#2E3631' }}>{r.notes}</Txt>
        </View>
      </ScrollView>

      <FloatingHeader
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton floating icon="download" label="Çevrimdışı kullanım için indir" />
            <IconButton floating icon="bookmark" label="Rotayı kaydet" />
            <IconButton floating icon="share" label="Rotayı paylaş" onPress={() => router.push('/rota/ornek/paylas')} />
          </View>
        }
      />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Grupla planla" icon="users" variant="outline" href="/etkinlik/olustur" style={{ flex: 1 }} />
        <Button label="Bu rotayı başlat" icon="play" href="/kayit" style={{ flex: 1.2 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  tag: { height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineStrong },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
