import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteThumb } from '@/components/charts';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Avatar, Card } from '@/components/ui';
import { myActivities, people, weekKm } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

const tabs = ['Aktiviteler', 'Rotalarım', 'Gruplar'];

export default function ProfilScreen() {
  const [tab, setTab] = useState(0);
  const me = people.me;
  const maxKm = Math.max(...weekKm.map((d) => d.km));

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.top}>
        <IconButton icon="share" label="Profili paylaş" />
        <IconButton icon="layers" label="Ayarlar" />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.identity}>
          <Avatar initials={me.initials} tone="ink" size={76} />
          <View style={{ flex: 1 }}>
            <Txt variant="display" style={{ fontSize: 24 }}>
              {me.name}
            </Txt>
            <Txt variant="muted" style={{ fontSize: 13 }}>
              Antalya · Bisiklet, doğa yürüyüşü
            </Txt>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
              {[
                ['128', 'aktivite'],
                ['342', 'takipçi'],
                ['210', 'takip'],
              ].map(([n, l]) => (
                <Txt key={l} style={{ fontSize: 13 }}>
                  <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{n}</Txt> <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>{l}</Txt>
                </Txt>
              ))}
            </View>
          </View>
        </View>

        <Card dark style={styles.week}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt variant="label" color="#B9C2BA">
              Bu hafta
            </Txt>
            <Txt variant="small" color="#B9C2BA">
              3 – 9 Kasım
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 20, marginVertical: 10 }}>
            {[
              ['64,2', 'km'],
              ['5:12', 'sa'],
              ['1.240', 'm'],
            ].map(([v, u]) => (
              <Txt key={u} style={{ fontFamily: fontFamily.displayHeavy, fontSize: 30, color: colors.night.text, letterSpacing: -0.6 }}>
                {v}
                <Txt style={{ fontFamily: fontFamily.bodyMedium, fontSize: 14, color: colors.night.text }}> {u}</Txt>
              </Txt>
            ))}
          </View>
          <View style={styles.bars} accessible accessibilityLabel="Bu haftanın günlük mesafe grafiği">
            {weekKm.map((d) => (
              <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <View
                  style={{
                    width: '100%',
                    height: d.km ? Math.max(8, (d.km / maxKm) * 56) : 4,
                    borderRadius: d.km ? 6 : 2,
                    backgroundColor: d.km === maxKm ? colors.night.accent : d.km ? '#0F8A86' : '#33413A',
                  }}
                />
                <Txt style={{ fontSize: 11, color: d.km === maxKm ? colors.night.text : '#B9C2BA', fontFamily: d.km === maxKm ? fontFamily.bodyBold : fontFamily.body }}>
                  {d.day}
                </Txt>
              </View>
            ))}
          </View>
        </Card>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {tabs.map((t, i) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === tab }}
              onPress={() => setTab(i)}
              style={[styles.tab, i === tab && styles.tabOn]}>
              <Txt style={{ fontFamily: i === tab ? fontFamily.bodyBold : fontFamily.bodySemiBold, fontSize: 14, color: i === tab ? colors.ink : colors.inkMuted }}>{t}</Txt>
            </Pressable>
          ))}
        </View>

        <View style={{ padding: space.md, gap: space.sm }}>
          {myActivities.map((a) => (
            <Pressable key={a.id} accessibilityRole="link" onPress={() => router.push('/aktivite/ornek')} style={styles.row}>
              <RouteThumb route={a.route} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                  {a.title}
                </Txt>
                <Txt variant="small">{a.meta}</Txt>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginTop: 4 }}>{a.stats}</Txt>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: space.lg, paddingBottom: 14 },
  week: { marginHorizontal: space.md, padding: space.lg, marginBottom: 14 },
  bars: { flexDirection: 'row', gap: 8, height: 76, alignItems: 'flex-end' },
  tabs: { flexDirection: 'row', marginHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.ink },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
});
