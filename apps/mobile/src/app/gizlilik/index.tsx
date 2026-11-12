/**
 * Gizlilik kontrolleri (Ayarlar > Gizlilik): profil sayfası, aktiviteler, grup aktiviteleri, bahsetmeler —
 * her biri herkes / takipçiler / hiç kimse. Altında ek kontroller (ayrı ekranlar) ve ısı haritası katılımı.
 * Sunucu kuralları: supabase/migrations/20261115000000_gizlilik.sql, 20261116000000_ek_gizlilik.sql.
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { DuzeySecici } from '@/components/DuzeySecici';
import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { Card, Label, ListRow, ToggleRow } from '@/components/ui';
import { duzeyAdi, duzeyAyarla, isiHaritasiAyarla, useGizlilikAyarlari, type Duzey, type DuzeyAlani } from '@/lib/gizlilik';
import { colors, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

type Alan = Exclude<DuzeyAlani, 'meydan_okuma_gizliligi'>;
const ALANLAR: Alan[] = ['profil_gizliligi', 'aktivite_gizliligi', 'grup_aktivite_gizliligi', 'bahsetme_izni'];

const bolumler = (): Record<Alan, { baslik: string; alt: string }> => ({
  profil_gizliligi: { baslik: $t('gizlilik.profil'), alt: $t('gizlilik.profil_alt') },
  aktivite_gizliligi: { baslik: $t('gizlilik.aktiviteler'), alt: $t('gizlilik.aktiviteler_alt') },
  grup_aktivite_gizliligi: { baslik: $t('gizlilik.grup'), alt: $t('gizlilik.grup_alt') },
  bahsetme_izni: { baslik: $t('gizlilik.bahsetme'), alt: $t('gizlilik.bahsetme_alt') },
});

export default function GizlilikScreen() {
  const { ayar, hata, degistir, girisGerekli } = useGizlilikAyarlari();
  const [mesgul, setMesgul] = useState(false);

  async function kaydet(alan: Alan, deger: Duzey, gecmiseUygula = false) {
    if (!ayar) return;
    const once = ayar[alan];
    degistir({ [alan]: deger });
    setMesgul(true);
    try {
      const n = await duzeyAyarla(alan, deger, gecmiseUygula);
      if (gecmiseUygula) Alert.alert($t('gizlilik.aktiviteler'), $t('gizlilik.degisti', { n: Number(n) || 0 }));
    } catch (e) {
      degistir({ [alan]: once });
      Alert.alert($t('ayarlar.yapilamadi'), e instanceof Error ? e.message : String(e));
    } finally {
      setMesgul(false);
    }
  }

  function sec(alan: Alan, deger: Duzey) {
    if (!ayar || ayar[alan] === deger || mesgul) return;
    if (alan !== 'aktivite_gizliligi') return void kaydet(alan, deger);
    // Aktivitelerde: yalnızca yeni kayıtlar mı, geçmiştekiler de mi?
    Alert.alert($t('gizlilik.gecmis_baslik'), $t('gizlilik.gecmis_metin', { secim: duzeyAdi(deger) }), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      { text: $t('gizlilik.yalnizca_yeni'), onPress: () => void kaydet(alan, deger) },
      { text: $t('gizlilik.hepsine_uygula'), onPress: () => void kaydet(alan, deger, true) },
    ]);
  }

  async function isiDegistir(v: boolean) {
    if (!ayar) return;
    degistir({ isi_haritasinda: v });
    try {
      await isiHaritasiAyarla(v);
    } catch (e) {
      degistir({ isi_haritasinda: !v });
      Alert.alert($t('ayarlar.yapilamadi'), e instanceof Error ? e.message : String(e));
    }
  }

  const b = bolumler();

  return (
    <View style={styles.root}>
      <Header title={$t('gizlilik.baslik')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        {girisGerekli ? (
          <Txt variant="muted">{$t('gizlilik.giris_gerekli')}</Txt>
        ) : hata ? (
          <Txt variant="muted">{$t('gizlilik.yuklenemedi')}</Txt>
        ) : !ayar ? (
          <ActivityIndicator color={colors.terra} style={{ marginTop: space.xl }} />
        ) : (
          <>
            {ALANLAR.map((alan) => (
              <View key={alan}>
                <Label>{b[alan].baslik}</Label>
                <Card style={{ padding: space.lg, gap: space.md }}>
                  <Txt variant="small">{b[alan].alt}</Txt>
                  <DuzeySecici deger={ayar[alan]} etiket={b[alan].baslik} onSec={(d) => sec(alan, d)} />
                </Card>
              </View>
            ))}

            <View>
              <Label>{$t('gizlilik.ek_kontroller')}</Label>
              <Card style={{ paddingHorizontal: space.lg }}>
                <ListRow icon="map" iconTone="sea" title={$t('gizlilik.harita')} caption={$t('gizlilik.harita_kisa')} href="/gizlilik/harita" />
                <ListRow icon="gauge" iconTone="sea" title={$t('gizlilik.ayrintilar')} caption={$t('gizlilik.ayrintilar_kisa')} href="/gizlilik/ayrintilar" />
                <ListRow icon="route" iconTone="sea" title={$t('gizlilik.gecmis')} caption={$t('gizlilik.gecmis_kisa')} href="/gizlilik/gecmis" />
                <ListRow icon="user" iconTone="terra" title={$t('gizlilik.engellenenler')} caption={$t('gizlilik.engellenenler_kisa')} href="/gizlilik/engellenenler" />
                <ListRow icon="shield" iconTone="sand" title={$t('gizlilik.kisisel')} caption={$t('gizlilik.kisisel_kisa')} href="/gizlilik/kisisel-bilgiler" />
                <ListRow icon="flag" iconTone="sand" title={$t('gizlilik.meydan')} caption={duzeyAdi(ayar.meydan_okuma_gizliligi)} href="/gizlilik/meydan-okuma" />
              </Card>
            </View>

            <View>
              <Label>{$t('gizlilik.isi_baslik')}</Label>
              <Card style={{ paddingHorizontal: space.lg }}>
                <ToggleRow
                  title={$t('ayarlar.isi_haritalarinda_gorun')}
                  subtitle={$t('ayarlar.isi_haritalarinda_gorun_alt')}
                  value={ayar.isi_haritasinda}
                  onChange={(v) => void isiDegistir(v)}
                />
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
}));
