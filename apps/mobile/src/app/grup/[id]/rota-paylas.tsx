import { ACTIVITY_LABELS, formatKm } from '@lykiva/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteThumb } from '@/components/charts';
import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { rotalarim, type Rota } from '@/data/rota';
import { rotayiGrubaPaylas } from '@/grup/gruplar';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

/** Kendi rotalarından birini gruba paylaş: grubun Rotalar sekmesine ve sohbete düşer */
export default function GrubaRotaPaylasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [liste, setListe] = useState<Rota[] | null>(null);
  const [secili, setSecili] = useState<string | null>(null);
  const [notu, setNotu] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiyor, setGonderiyor] = useState(false);

  useEffect(() => {
    rotalarim()
      .then(setListe)
      .catch((e: unknown) => {
        setHata(e instanceof Error ? e.message : $t('grup_rota_paylas.rotalar_yuklenemedi'));
        setListe([]);
      });
  }, []);

  async function paylas() {
    if (!secili || !id) return;
    setGonderiyor(true);
    setHata(null);
    try {
      await rotayiGrubaPaylas(secili, id, notu);
      router.replace({ pathname: '/grup/[id]/sohbet', params: { id } });
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('grup_rota_paylas.paylasilamadi'));
    } finally {
      setGonderiyor(false);
    }
  }

  return (
    <View style={styles.root}>
      <Header title={$t('grup_rota_paylas.gruba_rota_paylas')} backIcon="close" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: insets.bottom + 140 }}>
        {liste === null ? <ActivityIndicator color={colors.terra} /> : null}
        {liste && liste.length === 0 ? (
          <View style={{ gap: space.md }}>
            <Txt variant="muted">{$t('grup_rota_paylas.paylasabilecegin_bir_rotan_yok')}</Txt>
            <Button label={$t('grup_rota_paylas.rota_ciz')} icon="route" variant="outline" href="/rota/olustur" />
          </View>
        ) : null}
        {liste?.map((r) => {
          const on = r.id === secili;
          const yol = r.points.filter((_, i) => i % Math.max(1, Math.floor(r.points.length / 80)) === 0).map((p) => [p.lng, p.lat] as LngLat);
          return (
            <Pressable
              key={r.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setSecili(r.id)}
              style={[styles.row, on && { borderColor: colors.sea, backgroundColor: colors.seaSoft }]}>
              {yol.length > 1 ? <RouteThumb route={yol} size={56} color={colors.sea} /> : <View style={{ width: 56, height: 56 }} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                  {r.name}
                </Txt>
                <Txt variant="small">
                  {$t('grup_rota_paylas.km_m', { km: formatKm(r.distanceM), round: Math.round(r.gainM), a: ACTIVITY_LABELS[r.activity] })}</Txt>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.alt, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          value={notu}
          onChangeText={setNotu}
          placeholder={$t('grup_rota_paylas.not_ekle_istege_bagli')}
          placeholderTextColor={colors.inkMuted}
          maxLength={500}
          accessibilityLabel={$t('grup_rota_paylas.paylasim_notu')}
          style={styles.input}
        />
        {hata ? <Txt style={{ color: colors.terraInk, marginBottom: 6 }}>{hata}</Txt> : null}
        <Button label={gonderiyor ? $t('grup_rota_paylas.paylasiliyor') : $t('grup_rota_paylas.gruba_paylas')} icon="send" onPress={() => void paylas()} disabled={!secili || gonderiyor} />
        <Txt variant="small" style={{ marginTop: 6, textAlign: 'center' }}>
          {$t('grup_rota_paylas.rota_gizli_olsa_bile')}</Txt>
      </View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  alt: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  input: { height: 44, borderRadius: radius.md, backgroundColor: colors.ground, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink, marginBottom: 10 },
}));
