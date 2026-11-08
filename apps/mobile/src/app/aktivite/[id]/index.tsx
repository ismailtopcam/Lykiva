import { ACTIVITY_LABELS } from '@lykiva/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ElevationProfile } from '@/components/charts';
import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { useAktivite } from '@/data/aktivite';
import { people } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

export default function AktiviteOzetiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { a, yukleniyor, hata, bekliyor } = useAktivite(id);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!a) {
    return (
      <View style={[styles.root, styles.center]}>
        <FloatingHeader />
        {yukleniyor ? <ActivityIndicator color={colors.terra} /> : <Txt variant="muted">{hata ?? 'Aktivite bulunamadı'}</Txt>}
      </View>
    );
  }

  const stopCoord = (at: number) => a.route[Math.round(at * (a.route.length - 1))];
  const hasRoute = a.route.length > 1;

  const cells: [string, string, boolean?][] = [
    ['Mesafe', `${a.distanceKm} km`],
    ['Hareket', a.durationMoving],
    ['Toplam süre', a.durationTotal],
    ['Maks. hız', a.maxSpeed, true],
    ['Ort. hız', a.avgSpeed],
    ['Min. hız*', a.minSpeed],
  ];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <TopoMap
          style={{ height: 300 + insets.top }}
          route={a.route}
          markers={
            hasRoute
              ? [
                  { id: 's', coord: a.route[0], kind: 'start' as const },
                  { id: 'e', coord: a.route[a.route.length - 1], kind: 'end' as const },
                  ...a.stops.map((s) => ({ id: 'm' + s.n, coord: s.coord ?? stopCoord(s.at), kind: 'stop' as const, text: String(s.n) })),
                ]
              : []
          }
          padding={{ top: insets.top + 70, bottom: 30 }}
          accessibilityLabel={`Rota haritası${a.stops.length ? `, ${a.stops.length} mola noktası işaretli` : ''}`}
        />
        <View style={{ padding: space.lg, paddingBottom: 0 }}>
          <Txt variant="small">
            {a.when} · {ACTIVITY_LABELS[a.type]}
          </Txt>
          {bekliyor ? (
            <Txt variant="small" style={{ color: colors.terra, marginTop: 2 }}>
              Telefonda bekliyor · internet gelince gönderilecek
            </Txt>
          ) : null}
          <Txt variant="display" style={{ fontSize: 25, marginVertical: 2 }} accessibilityRole="header">
            {a.title}
          </Txt>
          {a.with.length ? (
            <Txt variant="muted" style={{ fontSize: 13 }}>
              {a.with.map((p) => people[p].short).join(', ').replace(/, ([^,]*)$/, ' ve $1')} ile birlikte
            </Txt>
          ) : null}
        </View>

        <View style={styles.grid}>
          {cells.map(([l, v, hi]) => (
            <View key={l} style={styles.cell}>
              <Txt style={{ fontSize: 11, color: colors.inkMuted }}>{l}</Txt>
              <Txt style={{ fontFamily: fontFamily.display, fontSize: 21, color: hi ? colors.terra : colors.ink }}>{v}</Txt>
            </View>
          ))}
        </View>
        <Txt variant="small" style={{ paddingHorizontal: space.lg, marginTop: 6 }}>
          km/sa · *Min. hız yalnızca hareket hâlindeyken ölçülür
        </Txt>

        {a.hasElevation === false ? (
          <Txt variant="small" style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
            Bu kayıtta cihaz rakım bilgisi vermedi; yükseklik profili yok.
          </Txt>
        ) : (
        <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>Yükseklik</Txt>
            <Txt variant="small">
              ↑ {a.climbM} m · ↓ {a.descentM} m · en yüksek {a.maxElevationM} m
            </Txt>
          </View>
          <ElevationProfile
            values={a.elevation}
            width={width - space.lg * 2}
            markers={a.stops.map((s) => ({ at: s.at, n: s.n }))}
            label={`Yükseklik profili, en yüksek nokta ${a.maxElevationM} metre`}
          />
        </View>
        )}

        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/aktivite/[id]/uc-boyut', params: { id: a.id } })} style={styles.link3d}>
          <Icon name="mountain" color={colors.seaInk} />
          <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.seaInk }}>İnişli çıkışlı haritada gör (3B)</Txt>
          <Icon name="chevron" size={18} color={colors.seaInk} strokeWidth={2} />
        </Pressable>
      </ScrollView>

      <FloatingHeader />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Hız & molalar" icon="gauge" variant="outline" href={{ pathname: '/aktivite/[id]/hiz', params: { id: a.id } }} style={{ flex: 1 }} />
        <Button label="Paylaş" icon="share" href={{ pathname: '/aktivite/[id]/paylas', params: { id: a.id } }} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: space.lg, marginTop: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.lineStrong, gap: 1 },
  cell: { width: '33.1%', flexGrow: 1, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10 },
  link3d: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: space.lg, marginTop: space.lg, padding: 14, borderRadius: 16, backgroundColor: colors.seaSoft },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
