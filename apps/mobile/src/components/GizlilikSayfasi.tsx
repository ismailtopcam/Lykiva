import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { colors, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

/** Gizlilik kontrollerinin alt ekranları: başlık, giriş / yükleniyor / hata durumları */
export function GizlilikSayfasi({
  baslik,
  girisGerekli,
  hata,
  hazir,
  children,
}: {
  baslik: string;
  girisGerekli: boolean;
  hata: string | null;
  hazir: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.root}>
      <Header title={baslik} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        {girisGerekli ? (
          <Txt variant="muted">{$t('gizlilik.giris_gerekli')}</Txt>
        ) : hata ? (
          <Txt variant="muted">{$t('gizlilik.yuklenemedi')}</Txt>
        ) : !hazir ? (
          <ActivityIndicator color={colors.terra} style={{ marginTop: space.xl }} />
        ) : (
          children
        )}
      </ScrollView>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
}));
