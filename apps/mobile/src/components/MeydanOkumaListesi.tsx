/**
 * Meydan okumalar listesi: katıldıkların, katılabileceklerin (herkese açık + gruplarının), bitenler.
 * Gruplar sekmesindeki "Meydan okumalar" bölümü ve /meydan-okuma sayfası kullanır; kaydırmayı çağıran sağlar.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MeydanOkumaKarti } from '@/components/MeydanOkumaKarti';
import { Txt } from '@/components/Txt';
import { SectionHeader } from '@/components/ui';
import { durumu, meydanOkumalar, type MeydanOkuma } from '@/data/meydanOkuma';
import { supabaseHazir } from '@/lib/supabase';
import { colors, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export function MeydanOkumaListesi() {
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

  if (!supabaseHazir) {
    return (
      <View style={styles.center}>
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          {$t('basari.sunucu_yok')}
        </Txt>
      </View>
    );
  }
  if (!liste) {
    return <View style={styles.center}>{hata ? <Txt variant="muted" style={{ textAlign: 'center' }}>{hata}</Txt> : <ActivityIndicator color={colors.terra} />}</View>;
  }
  if (liste.length === 0) {
    return (
      <View style={styles.center}>
        <Icon name="flag" size={44} color={colors.inkMuted} />
        <Txt variant="muted" style={{ textAlign: 'center', marginTop: space.md }}>
          {$t('meydan.bos')}
        </Txt>
      </View>
    );
  }

  const surenler = liste.filter((m) => durumu(m, simdi) !== 'bitti');
  // Sürenler bitişe, yaklaşanlar başlangıca göre
  const sira = (a: MeydanOkuma, b: MeydanOkuma) => Date.parse(a.bitis) - Date.parse(b.bitis);
  const katildiklarim = surenler.filter((m) => m.katildim).sort(sira);
  const katilabilecekler = surenler.filter((m) => !m.katildim).sort(sira);
  const bitenler = liste.filter((m) => durumu(m, simdi) === 'bitti').sort((a, b) => -sira(a, b));

  return (
    <View style={{ gap: space.sm }}>
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
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl, minHeight: 240 },
}));
