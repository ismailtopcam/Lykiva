/**
 * Meydan okumalar: katıldıkların, katılabileceklerin (herkese açık + gruplarının), bitenler.
 * Herkese açık olanları yönetim panelinden açılır; grup meydan okuması grup sayfasından başlatılır.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { MeydanOkumaKarti } from '@/components/MeydanOkumaKarti';
import { Txt } from '@/components/Txt';
import { SectionHeader } from '@/components/ui';
import { durumu, meydanOkumalar, type MeydanOkuma } from '@/data/meydanOkuma';
import { supabaseHazir } from '@/lib/supabase';
import { colors, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export default function MeydanOkumalarScreen() {
  const insets = useSafeAreaInsets();
  const [liste, setListe] = useState<MeydanOkuma[] | null>(null);
  const [simdi, setSimdi] = useState(0);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!supabaseHazir) return;
      let acik = true;
      meydanOkumalar()
        .then((l) => {
          if (!acik) return;
          setListe(l);
          setSimdi(Date.now());
          setHata(null);
        })
        .catch((e: unknown) => acik && setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi')));
      return () => {
        acik = false;
      };
    }, []),
  );

  const surenler = (liste ?? []).filter((m) => durumu(m, simdi) !== 'bitti');
  // Sürenler bitişe, yaklaşanlar başlangıca göre
  const sira = (a: MeydanOkuma, b: MeydanOkuma) => Date.parse(a.bitis) - Date.parse(b.bitis);
  const katildiklarim = surenler.filter((m) => m.katildim).sort(sira);
  const katilabilecekler = surenler.filter((m) => !m.katildim).sort(sira);
  const bitenler = (liste ?? []).filter((m) => durumu(m, simdi) === 'bitti').sort((a, b) => -sira(a, b));

  return (
    <View style={styles.root}>
      <Header title={$t('meydan.baslik')} />
      {!supabaseHazir ? (
        <View style={styles.center}>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            {$t('basari.sunucu_yok')}
          </Txt>
        </View>
      ) : !liste ? (
        <View style={styles.center}>{hata ? <Txt variant="muted" style={{ textAlign: 'center' }}>{hata}</Txt> : <ActivityIndicator color={colors.terra} />}</View>
      ) : liste.length === 0 ? (
        <View style={styles.center}>
          <Icon name="flag" size={44} color={colors.inkMuted} />
          <Txt variant="muted" style={{ textAlign: 'center', marginTop: space.md }}>
            {$t('meydan.bos')}
          </Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40, gap: space.sm }}>
          {katildiklarim.length ? <SectionHeader title={$t('meydan.katildiklarin')} /> : null}
          {katildiklarim.map((m) => (
            <MeydanOkumaKarti key={m.id} m={m} simdi={simdi} />
          ))}
          <SectionHeader title={$t('meydan.katilabileceklerin')} />
          {katilabilecekler.length ? (
            katilabilecekler.map((m) => <MeydanOkumaKarti key={m.id} m={m} simdi={simdi} />)
          ) : (
            <Txt variant="muted" style={{ paddingHorizontal: space.sm }}>
              {$t('meydan.acik_yok')}
            </Txt>
          )}
          {bitenler.length ? <SectionHeader title={$t('meydan.bitenler')} /> : null}
          {bitenler.map((m) => (
            <MeydanOkumaKarti key={m.id} m={m} simdi={simdi} />
          ))}
          <Txt variant="small" style={{ paddingHorizontal: space.sm, marginTop: space.md }}>
            {$t('meydan.grup_notu')}
          </Txt>
        </ScrollView>
      )}
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
}));
