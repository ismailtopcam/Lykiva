import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpeedChart } from '@/components/charts';
import { Header } from '@/components/Header';
import { sunucuAktivitesiMi } from '@/akis/akis';
import { Icon } from '@/components/Icon';
import { MolaFotolari } from '@/components/MolaFotolari';
import { Txt } from '@/components/Txt';
import { Card, SectionHeader } from '@/components/ui';
import { useAktivite } from '@/data/aktivite';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';
import { $t } from '@/i18n';

export default function HizMolalarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { a, hata } = useAktivite(id);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!a) {
    return (
      <View style={styles.root}>
        <Header title={$t('aktivite_hiz.hiz_molalar')} />
        <View style={{ padding: space.lg, alignItems: 'center' }}>{hata ? <Txt variant="muted">{hata}</Txt> : <ActivityIndicator color={colors.terra} />}</View>
      </View>
    );
  }

  const maxIndex = a.speed.indexOf(Math.max(...a.speed));
  const ornek = a.id === 'ornek';
  const sunucuda = supabaseHazir && sunucuAktivitesiMi(a.id);

  return (
    <View style={styles.root}>
      <Header title={$t('aktivite_hiz.hiz_molalar')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 6, paddingBottom: insets.bottom + 40 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={[styles.kpi, { backgroundColor: colors.terra, borderColor: colors.terra }]}>
            <Txt style={styles.kpiLabelLight}>{$t('aktivite_hiz.maks')}</Txt>
            <Txt style={[styles.kpiValue, { color: '#FFFFFF' }]}>{a.maxSpeed}</Txt>
            <Txt style={styles.kpiLabelLight}>{ornek ? 'Sarıbelen inişi' : $t('aktivite_hiz.en_yuksek')}</Txt>
          </View>
          <View style={styles.kpi}>
            <Txt variant="small">{$t('aktivite_hiz.ortalama')}</Txt>
            <Txt style={styles.kpiValue}>{a.avgSpeed}</Txt>
            <Txt variant="small">{$t('aktivite_hiz.hareketteyken')}</Txt>
          </View>
          <View style={styles.kpi}>
            <Txt variant="small">{$t('aktivite_hiz.min')}</Txt>
            <Txt style={styles.kpiValue}>{a.minSpeed}</Txt>
            <Txt variant="small">{ornek ? $t('aktivite_hiz.dik_yokusta') : 'hareketteyken'}</Txt>
          </View>
        </View>

        <Card style={{ padding: 12, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>{$t('aktivite_hiz.hiz_km_sa')}</Txt>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={styles.legend}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#EADFC9' }} />
                <Txt variant="small">{$t('aktivite_hiz.mola')}</Txt>
              </View>
              <View style={styles.legend}>
                <View style={{ width: 12, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.sea }} />
                <Txt variant="small">{$t('aktivite_hiz.ortalama')}</Txt>
              </View>
            </View>
          </View>
          <SpeedChart
            values={a.speed}
            width={width - space.lg * 2 - 26}
            avg={parseFloat(a.avgSpeed.replace('.', '').replace(',', '.')) || 0}
            maxIndex={maxIndex}
            start={a.startClock}
            end={a.endClock}
            label={$t('aktivite_hiz.hiz_grafigi_molada_hiz', { length: a.stops.length, maxSpeed: a.maxSpeed })}
          />
        </Card>

        <SectionHeader title={$t('aktivite_hiz.nerede_durdun')} />
        <Txt variant="small" style={{ marginTop: -6, marginBottom: 10 }}>
          {a.stops.length ? $t('aktivite_hiz.toplam_mola', { stopTotal: a.stopTotal }) : $t('aktivite_hiz.m_1_dakikadan_uzun_mola')}
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
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>{$t('aktivite_hiz.dk', { duration: s.duration })}</Txt>
              </View>
              <Txt variant="small">
                {$t('aktivite_hiz.km', { time: s.time, km: s.km, a: s.note ? ` · ${s.note}` : '' })}</Txt>
              {ornek && s.n === 1 ? (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {[colors.water, colors.sand].map((bg) => (
                    <View key={bg} style={[styles.photo, { backgroundColor: bg }]}>
                      <Icon name="image" size={18} color={colors.inkMuted} />
                    </View>
                  ))}
                </View>
              ) : null}
              {sunucuda && s.id ? <MolaFotolari aktiviteId={a.id} molaId={s.id} ilk={s.fotolar ?? []} sahibi={!!a.mine} molaAdi={s.title} /> : null}
            </View>
          </View>
        ))}
        {ornek ? (
        <View style={styles.stop}>
          <View style={[styles.num, styles.numDashed]} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }}>{$t('aktivite_hiz.kisa_duraklamalar')}</Txt>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>{$t('aktivite_hiz.m_0_25_dk')}</Txt>
            </View>
            <Txt variant="small">{$t('aktivite_hiz.m_4_kez_her_biri')}</Txt>
          </View>
        </View>
        ) : null}
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
