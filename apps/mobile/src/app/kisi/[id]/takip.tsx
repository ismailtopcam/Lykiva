/**
 * Bir kişinin takipçileri ya da takip ettikleri (?yon=takipci | takip).
 */
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { takipListesi, type KisiOzeti } from '@/akis/akis';
import { Header } from '@/components/Header';
import { KisiSatiri } from '@/components/KisiSatiri';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/theme';
import { $t } from '@/i18n';

export default function TakipListesiScreen() {
  const { id, yon: yonParam } = useLocalSearchParams<{ id: string; yon?: string }>();
  const yon = yonParam === 'takip' ? 'takip' : 'takipci';
  const [liste, setListe] = useState<KisiOzeti[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let acik = true;
      takipListesi(id, yon)
        .then((l) => acik && setListe(l))
        .catch((e) => {
          if (!acik) return;
          setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi'));
          setListe([]);
        });
      return () => {
        acik = false;
      };
    }, [id, yon]),
  );

  return (
    <View style={styles.root}>
      <Header title={yon === 'takip' ? $t('kisi_takip.takip_ettikleri') : $t('ortak.takipciler')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 60 }}>
        {hata ? (
          <Txt accessibilityRole="alert" style={{ color: colors.terraInk, marginVertical: space.md }}>
            {hata}
          </Txt>
        ) : null}
        {liste === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} /> : null}
        {liste && liste.length === 0 && !hata ? (
          <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: space.lg }}>
            {yon === 'takip' ? $t('kisi_takip.henuz_kimseyi_takip_etmiyor') : $t('kisi_takip.henuz_takipcisi_yok')}
          </Txt>
        ) : null}
        {liste?.map((k) => (
          <KisiSatiri key={k.id} k={k} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
});
