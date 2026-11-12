/**
 * Rozetler: kazanılanlar renkli, kazanılmayanlar soluk ve ilerlemesiyle. Hesap telefonda (packages/shared/src/rozet.ts).
 */
import { type RozetDurumu, type RozetKategori } from '@lykiva/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { Card, SectionHeader } from '@/components/ui';
import { RozetSimgesi } from '@/components/RozetSimgesi';
import { rozetAdi, rozetIlerlemesi, rozetKosulu, rozetVerisi } from '@/data/rozet';
import { oturumuSagla, supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t, yerel } from '@/i18n';

const KATEGORILER: RozetKategori[] = ['toplam', 'tek', 'seri', 'ozel', 'meydan'];
const kategoriAdi = (k: RozetKategori) =>
  k === 'toplam' ? $t('rozet.kat_toplam') : k === 'tek' ? $t('rozet.kat_tek') : k === 'seri' ? $t('rozet.kat_seri') : k === 'ozel' ? $t('rozet.kat_ozel') : $t('rozet.kat_meydan');

const tarihMetni = (t: number) => new Date(t).toLocaleDateString(yerel(), { day: 'numeric', month: 'long', year: 'numeric' });

export default function RozetlerScreen() {
  const insets = useSafeAreaInsets();
  const [durumlar, setDurumlar] = useState<RozetDurumu[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let acik = true;
      (async () => {
        try {
          const uid = supabaseHazir ? await oturumuSagla().catch(() => null) : null;
          const d = await rozetVerisi(uid);
          if (acik) {
            setDurumlar(d);
            setHata(null);
          }
        } catch (e) {
          if (acik) setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi'));
        }
      })();
      return () => {
        acik = false;
      };
    }, []),
  );

  function ayrinti(d: RozetDurumu) {
    const ilerleme = rozetIlerlemesi(d);
    const metin = [
      rozetKosulu(d.tanim),
      d.kazanildi ? (d.tarih ? $t('rozet.kazanildi_tarih', { tarih: tarihMetni(d.tarih) }) : $t('rozet.kazanildi')) : ilerleme ? $t('rozet.ilerleme', { ilerleme }) : null,
    ]
      .filter(Boolean)
      .join('\n\n');
    const aktivite = d.aktiviteId;
    Alert.alert(rozetAdi(d.tanim), metin, [
      ...(aktivite ? [{ text: $t('rozet.aktiviteyi_ac'), onPress: () => router.push({ pathname: '/aktivite/[id]', params: { id: aktivite } }) }] : []),
      { text: $t('ortak.kapat'), style: 'cancel' as const },
    ]);
  }

  const kazanilan = durumlar?.filter((d) => d.kazanildi).length ?? 0;

  return (
    <View style={styles.root}>
      <Header title={$t('rozet.baslik')} />
      {!durumlar ? (
        <View style={styles.center}>{hata ? <Txt variant="muted">{hata}</Txt> : <ActivityIndicator color={colors.terra} />}</View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }}>
          <Card dark style={{ padding: space.lg, marginBottom: space.sm }}>
            <Txt variant="label" color="#B9C2BA">
              {$t('rozet.kazandiklarin')}
            </Txt>
            <Txt style={{ fontFamily: fontFamily.displayHeavy, fontSize: 32, color: colors.night.text }}>
              {kazanilan}
              <Txt style={{ fontFamily: fontFamily.bodyMedium, fontSize: 16, color: '#B9C2BA' }}> / {durumlar.length}</Txt>
            </Txt>
            <Txt variant="small" color="#B9C2BA">
              {kazanilan ? $t('rozet.ozet_alt') : $t('rozet.henuz_yok')}
            </Txt>
          </Card>
          {KATEGORILER.map((k) => {
            const l = durumlar.filter((d) => d.tanim.kategori === k);
            if (!l.length) return null;
            return (
              <View key={k}>
                <SectionHeader title={kategoriAdi(k)} />
                <View style={styles.izgara}>
                  {l.map((d) => (
                    <RozetKutusu key={d.tanim.id} d={d} onPress={() => ayrinti(d)} />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function RozetKutusu({ d, onPress }: { d: RozetDurumu; onPress: () => void }) {
  const ilerleme = rozetIlerlemesi(d);
  const ad = rozetAdi(d.tanim);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ad}. ${d.kazanildi ? $t('rozet.kazanildi') : $t('rozet.kazanilmadi')}${ilerleme ? `, ${ilerleme}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.kutu, pressed && { opacity: 0.75 }]}>
      <RozetSimgesi d={d} />
      <Txt style={[styles.ad, !d.kazanildi && { color: colors.inkMuted }]} numberOfLines={2}>
        {ad}
      </Txt>
      {ilerleme ? (
        <Txt variant="small" style={{ fontSize: 11, textAlign: 'center' }} numberOfLines={1}>
          {ilerleme}
        </Txt>
      ) : d.kazanildi && d.tarih ? (
        <Txt variant="small" style={{ fontSize: 11, textAlign: 'center' }} numberOfLines={1}>
          {new Date(d.tarih).toLocaleDateString(yerel(), { day: 'numeric', month: 'short', year: '2-digit' })}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  izgara: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginBottom: space.sm },
  kutu: { width: '33.33%', alignItems: 'center', paddingHorizontal: 4, gap: 4 },
  ad: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, textAlign: 'center', lineHeight: 15 },
}));
