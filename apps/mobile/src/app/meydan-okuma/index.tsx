/**
 * Meydan okumalar: katıldıkların, katılabileceklerin (herkese açık + gruplarının), bitenler.
 * Herkese açık olanları yönetim panelinden açılır; grup meydan okuması grup sayfasından başlatılır.
 * Aynı liste Gruplar sekmesinde de var (MeydanOkumaListesi).
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { MeydanOkumaListesi } from '@/components/MeydanOkumaListesi';
import { colors, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export default function MeydanOkumalarScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Header title={$t('meydan.baslik')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }}>
        <MeydanOkumaListesi />
      </ScrollView>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
}));
