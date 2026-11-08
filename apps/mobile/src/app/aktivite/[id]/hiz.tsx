import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpeedChart } from '@/components/charts';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Card, SectionHeader } from '@/components/ui';
import { kasKalkan } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

export default function HizMolalarScreen() {
  const a = kasKalkan;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxIndex = a.speed.indexOf(Math.max(...a.speed));

  return (
    <View style={styles.root}>
      <Header title="Hız & molalar" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 6, paddingBottom: insets.bottom + 40 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={[styles.kpi, { backgroundColor: colors.terra, borderColor: colors.terra }]}>
            <Txt style={styles.kpiLabelLight}>Maks.</Txt>
            <Txt style={[styles.kpiValue, { color: '#FFFFFF' }]}>{a.maxSpeed}</Txt>
            <Txt style={styles.kpiLabelLight}>Sarıbelen inişi</Txt>
          </View>
          <View style={styles.kpi}>
            <Txt variant="small">Ortalama</Txt>
            <Txt style={styles.kpiValue}>{a.avgSpeed}</Txt>
            <Txt variant="small">hareketteyken</Txt>
          </View>
          <View style={styles.kpi}>
            <Txt variant="small">Min.</Txt>
            <Txt style={styles.kpiValue}>{a.minSpeed}</Txt>
            <Txt variant="small">dik yokuşta</Txt>
          </View>
        </View>

        <Card style={{ padding: 12, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>Hız (km/sa)</Txt>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={styles.legend}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#EADFC9' }} />
                <Txt variant="small">Mola</Txt>
              </View>
              <View style={styles.legend}>
                <View style={{ width: 12, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.sea }} />
                <Txt variant="small">Ortalama</Txt>
              </View>
            </View>
          </View>
          <SpeedChart
            values={a.speed}
            width={width - space.lg * 2 - 26}
            avg={16.7}
            maxIndex={maxIndex}
            start="08:12"
            end="10:08"
            label={`Hız grafiği: iki molada hız sıfıra düşüyor, en yüksek hız ${a.maxSpeed} km/sa`}
          />
        </Card>

        <SectionHeader title="Nerede durdun?" />
        <Txt variant="small" style={{ marginTop: -6, marginBottom: 10 }}>
          Toplam mola 17:45
        </Txt>
        {a.stops.map((s) => (
          <View key={s.n} style={styles.stop}>
            <View style={{ alignItems: 'center' }}>
              <View style={styles.num}>
                <Txt style={{ color: colors.surface, fontFamily: fontFamily.bodyBold, fontSize: 12 }}>{s.n}</Txt>
              </View>
              <View style={styles.rail} />
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15, flex: 1 }}>{s.title}</Txt>
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>{s.duration} dk</Txt>
              </View>
              <Txt variant="small">
                {s.time} · {s.km}. km · {s.note}
              </Txt>
              {s.n === 1 ? (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {[colors.water, colors.sand].map((bg) => (
                    <View key={bg} style={[styles.photo, { backgroundColor: bg }]}>
                      <Icon name="image" size={18} color={colors.inkMuted} />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))}
        <View style={styles.stop}>
          <View style={[styles.num, styles.numDashed]} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }}>Kısa duraklamalar</Txt>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>0:25 dk</Txt>
            </View>
            <Txt variant="small">4 kez, her biri 1 dakikadan kısa</Txt>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  kpi: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  kpiValue: { fontFamily: fontFamily.displayHeavy, fontSize: 24, color: colors.ink },
  kpiLabelLight: { fontSize: 11, color: '#FFFFFF', fontFamily: fontFamily.body },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stop: { flexDirection: 'row', gap: 12 },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  numDashed: { backgroundColor: 'transparent', borderWidth: 2, borderStyle: 'dashed', borderColor: '#9C9282' },
  rail: { flex: 1, width: 2, backgroundColor: colors.lineStrong, marginVertical: 4 },
  photo: { width: 56, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
