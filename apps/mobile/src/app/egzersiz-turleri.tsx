/**
 * Tüm egzersizler: şeride sığmayan türler dahil hepsi, gruplu ve aranabilir. Seçince kapanır; seçim
 * `lib/egzersizTuru.ts`'te tutulduğu için açan ekran (Harita sekmesi ya da başlat ekranı) kendiliğinden güncellenir.
 */
import { ACTIVITY_LABELS, type ActivityType } from '@lykiva/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { egzersizTuruSec, grubunTurleri, TUR_GRUPLARI, TUR_IKONLARI, useEgzersizTuru } from '@/lib/egzersizTuru';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export default function EgzersizTurleriScreen() {
  const insets = useSafeAreaInsets();
  const { secili } = useEgzersizTuru();
  const [q, setQ] = useState('');

  const aranan = q.trim().toLocaleLowerCase();
  const gruplar = TUR_GRUPLARI.map((g) => ({
    g,
    turler: grubunTurleri(g).filter((t) => !aranan || ACTIVITY_LABELS[t].toLocaleLowerCase().includes(aranan)),
  })).filter((x) => x.turler.length > 0);

  function sec(t: ActivityType) {
    egzersizTuruSec(t);
    router.back();
  }

  return (
    <View style={styles.root}>
      <Header title={$t('egzersiz.tum_egzersizler')} backIcon="close" center />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, paddingBottom: insets.bottom + space.xl }} keyboardShouldPersistTaps="handled">
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.ink} strokeWidth={2} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={$t('egzersiz.egzersiz_ara')}
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel={$t('egzersiz.egzersiz_ara')}
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>

        {gruplar.map(({ g, turler }) => (
          <View key={g} style={{ marginTop: space.lg }}>
            <Txt variant="caption" accessibilityRole="header" style={{ marginBottom: space.sm, marginLeft: 4 }}>
              {$t(`egzersiz.grup_${g}`)}
            </Txt>
            <View accessibilityRole="radiogroup" style={styles.izgara}>
              {turler.map((t) => {
                const on = t === secili;
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => sec(t)}
                    style={({ pressed }) => [styles.kutu, on && styles.kutuOn, pressed && { opacity: 0.8 }]}>
                    <Icon name={TUR_IKONLARI[t]} size={22} color={on ? colors.ground : colors.ink} />
                    <Txt numberOfLines={1} style={{ flexShrink: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: on ? colors.ground : colors.ink }}>
                      {ACTIVITY_LABELS[t]}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {gruplar.length === 0 ? (
          <Txt variant="muted" style={{ marginTop: space.lg, textAlign: 'center' }}>
            {$t('egzersiz.sonuc_yok')}
          </Txt>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: colors.ground },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 16, color: colors.ink },
  izgara: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // İki sütun: aradaki boşluk düşülünce yarı genişlikten biraz az
  kutu: { width: '48.6%', height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.ground },
  kutuOn: { backgroundColor: colors.ink },
}));
