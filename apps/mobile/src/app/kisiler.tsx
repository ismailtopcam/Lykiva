/**
 * Kişi arama. Arama kutusu boşken öneriler: seni takip edenler ve grup arkadaşların.
 * Geçici (giriş yapmamış) hesaplar aramada görünmez.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { kisiAra, type KisiOzeti } from '@/akis/akis';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { KisiSatiri } from '@/components/KisiSatiri';
import { Txt } from '@/components/Txt';
import { SectionHeader } from '@/components/ui';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export default function KisilerScreen() {
  const [arama, setArama] = useState('');
  const [sonuc, setSonuc] = useState<KisiOzeti[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const istekNo = useRef(0);

  // Yazmayı bitirince ara (kısa bekleme); 1 harfte arama yapılmaz
  useEffect(() => {
    const q = arama.trim();
    if (q.length === 1) return;
    const no = ++istekNo.current;
    const t = setTimeout(
      () => {
        setSonuc(null);
        setHata(null);
        kisiAra(q)
          .then((l) => no === istekNo.current && setSonuc(l))
          .catch((e) => {
            if (no !== istekNo.current) return;
            setHata(e instanceof Error ? e.message : $t('kisiler.aranamadi'));
            setSonuc([]);
          });
      },
      q ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [arama]);

  const araniyor = arama.trim().length >= 2;

  return (
    <View style={styles.root}>
      <Header title={$t('kisiler.kisiler')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.inkMuted} />
          <TextInput
            value={arama}
            onChangeText={setArama}
            placeholder={$t('kisiler.ad_ya_da_kullanici')}
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={$t('ortak.kisi_ara')}
            style={styles.input}
            autoFocus
          />
        </View>

        {hata ? (
          <Txt accessibilityRole="alert" style={{ color: colors.terraInk, marginBottom: space.md }}>
            {hata}
          </Txt>
        ) : null}

        <SectionHeader title={araniyor ? $t('kisiler.sonuclar') : $t('kisiler.taniyor_olabileceklerin')} />
        {sonuc === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} /> : null}
        {sonuc && sonuc.length === 0 && !hata ? (
          <Txt variant="muted" style={{ paddingVertical: space.md }}>
            {araniyor
              ? $t('kisiler.bu_adla_kimse_bulunamadi')
              : $t('kisiler.simdilik_onerimiz_yok_bir')}
          </Txt>
        ) : null}
        {sonuc?.map((k) => (
          <KisiSatiri key={k.id} k={k} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.lg,
  },
  input: { flex: 1, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
}));
