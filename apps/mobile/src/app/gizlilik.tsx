/**
 * Gizlilik kontrolleri (Ayarlar > Gizlilik): profil sayfası, aktiviteler, grup aktiviteleri, bahsetmeler —
 * her biri herkes / takipçiler / hiç kimse. Sunucu kuralları: supabase/migrations/20261115000000_gizlilik.sql.
 * Isı haritası katılımı da burada.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { Card, Chip, Label, ToggleRow } from '@/components/ui';
import { useHesap } from '@/lib/giris';
import { supabase } from '@/lib/supabase';
import { colors, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

type Duzey = 'herkes' | 'takipciler' | 'kimse';
type Alan = 'profil_gizliligi' | 'aktivite_gizliligi' | 'grup_aktivite_gizliligi' | 'bahsetme_izni';
type Ayarlar = Record<Alan, Duzey> & { isi_haritasinda: boolean };

const ALANLAR: Alan[] = ['profil_gizliligi', 'aktivite_gizliligi', 'grup_aktivite_gizliligi', 'bahsetme_izni'];
const DUZEYLER: Duzey[] = ['herkes', 'takipciler', 'kimse'];

const duzeyAdi = (d: Duzey) => ({ herkes: $t('gizlilik.herkes'), takipciler: $t('gizlilik.takipciler'), kimse: $t('gizlilik.kimse') })[d];

const bolumler = (): Record<Alan, { baslik: string; alt: string }> => ({
  profil_gizliligi: { baslik: $t('gizlilik.profil'), alt: $t('gizlilik.profil_alt') },
  aktivite_gizliligi: { baslik: $t('gizlilik.aktiviteler'), alt: $t('gizlilik.aktiviteler_alt') },
  grup_aktivite_gizliligi: { baslik: $t('gizlilik.grup'), alt: $t('gizlilik.grup_alt') },
  bahsetme_izni: { baslik: $t('gizlilik.bahsetme'), alt: $t('gizlilik.bahsetme_alt') },
});

export default function GizlilikScreen() {
  const hesap = useHesap();
  const [ayar, setAyar] = useState<Ayarlar | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState<Alan | 'isi' | null>(null);

  useEffect(() => {
    if (!hesap?.id) return;
    let acik = true;
    supabase
      .from('profiles')
      .select('profil_gizliligi,aktivite_gizliligi,grup_aktivite_gizliligi,bahsetme_izni,isi_haritasinda')
      .eq('id', hesap.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!acik) return;
        if (error || !data) setHata(error?.message ?? $t('ortak.yuklenemedi'));
        else setAyar(data as Ayarlar);
      });
    return () => {
      acik = false;
    };
  }, [hesap?.id]);

  async function kaydet(alan: Alan, deger: Duzey, gecmiseUygula = false) {
    if (!ayar) return;
    const once = ayar;
    setAyar({ ...ayar, [alan]: deger });
    setKaydediliyor(alan);
    const { data, error } = await supabase.rpc('gizlilik_ayarla', { alan, deger, gecmise_uygula: gecmiseUygula });
    setKaydediliyor(null);
    if (error) {
      setAyar(once);
      Alert.alert($t('ayarlar.yapilamadi'), error.message);
      return;
    }
    if (gecmiseUygula) Alert.alert($t('gizlilik.aktiviteler'), $t('gizlilik.degisti', { n: Number(data) || 0 }));
  }

  function sec(alan: Alan, deger: Duzey) {
    if (!ayar || ayar[alan] === deger || kaydediliyor) return;
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
    const once = ayar;
    setAyar({ ...ayar, isi_haritasinda: v });
    setKaydediliyor('isi');
    const { error } = await supabase.rpc('isi_haritasi_ayarla', { katil: v });
    setKaydediliyor(null);
    if (error) {
      setAyar(once);
      Alert.alert($t('ayarlar.yapilamadi'), error.message);
    }
  }

  const b = bolumler();

  return (
    <View style={styles.root}>
      <Header title={$t('gizlilik.baslik')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        {!hesap || hesap.gecici ? (
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
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={b[alan].baslik}>
                    {DUZEYLER.map((d) => (
                      <Chip key={d} label={duzeyAdi(d)} role="radio" selected={ayar[alan] === d} onPress={() => sec(alan, d)} />
                    ))}
                  </View>
                </Card>
              </View>
            ))}

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
