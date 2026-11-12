import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { fotoSec, MOLA_FOTO_SINIRI, molaFotoAdresleri, molaFotografiEkle, molaFotografiSil, type Kaynak } from '@/lib/foto';
import { colors, fontFamily, radius, temaliStil } from '@/theme';
import { $t } from '@/i18n';

/**
 * Bir molanın fotoğrafları. Fotoğraflar gizli kovada; aktiviteyi görebilen herkes görür (bir saatlik imzalı adres),
 * yalnızca sahibi ekler / siler.
 */
export function MolaFotolari({ aktiviteId, molaId, ilk, sahibi, molaAdi }: { aktiviteId: string; molaId: string; ilk: string[]; sahibi: boolean; molaAdi: string }) {
  const [yollar, setYollar] = useState(ilk);
  const [adresler, setAdresler] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState(false);
  const [buyuk, setBuyuk] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const eksik = yollar.filter((y) => !adresler[y]).join('|');
  useEffect(() => {
    if (!eksik) return;
    let acik = true;
    molaFotoAdresleri(eksik.split('|'))
      .then((a) => acik && setAdresler((x) => ({ ...x, ...a })))
      .catch(() => undefined);
    return () => {
      acik = false;
    };
  }, [eksik]);

  async function ekle(kaynak: Kaynak) {
    try {
      const uri = await fotoSec(kaynak);
      if (!uri) return;
      setYukleniyor(true);
      setYollar(await molaFotografiEkle(aktiviteId, molaId, yollar, uri));
    } catch (e) {
      Alert.alert($t('molaFotolari.fotograf_eklenemedi'), e instanceof Error ? e.message : $t('molaFotolari.bir_sorun_oldu'));
    } finally {
      setYukleniyor(false);
    }
  }

  function ekleMenusu() {
    Alert.alert($t('molaFotolari.icin_fotograf', { molaAdi }), undefined, [
      { text: $t('molaFotolari.galeriden_sec'), onPress: () => void ekle('galeri') },
      { text: $t('molaFotolari.fotograf_cek'), onPress: () => void ekle('kamera') },
      { text: $t('ortak.vazgec'), style: 'cancel' as const },
    ]);
  }

  function silmeyiSor(yol: string) {
    Alert.alert($t('molaFotolari.fotograf_silinsin_mi'), $t('molaFotolari.bu_fotograf_moladan_kaldirilir'), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      {
        text: $t('ortak.sil'),
        style: 'destructive' as const,
        onPress: async () => {
          try {
            setYollar(await molaFotografiSil(molaId, yollar, yol));
            setBuyuk(null);
          } catch (e) {
            Alert.alert($t('ortak.silinemedi'), e instanceof Error ? e.message : $t('molaFotolari.bir_sorun_oldu'));
          }
        },
      },
    ]);
  }

  if (!yollar.length && !sahibi) return null;

  return (
    <View style={styles.sira}>
      {yollar.map((y, i) => (
        <Pressable
          key={y}
          accessibilityRole="imagebutton"
          accessibilityLabel={$t('molaFotolari.fotograf_buyutmek_icin_dokun', { molaAdi, a: i + 1, a2: sahibi ? $t('molaFotolari.silmek_icin_basili_tut') : '' })}
          onPress={() => setBuyuk(y)}
          onLongPress={sahibi ? () => silmeyiSor(y) : undefined}
          style={styles.kucuk}>
          {adresler[y] ? <Image source={{ uri: adresler[y] }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Icon name="image" size={18} color={colors.inkMuted} />}
        </Pressable>
      ))}
      {sahibi && yollar.length < MOLA_FOTO_SINIRI ? (
        <Pressable accessibilityRole="button" accessibilityLabel={$t('molaFotolari.icin_fotograf_ekle', { molaAdi })} onPress={ekleMenusu} disabled={yukleniyor} style={[styles.kucuk, styles.ekle]}>
          {yukleniyor ? <ActivityIndicator color={colors.terra} /> : <Icon name="camera" size={18} color={colors.terra} />}
        </Pressable>
      ) : null}

      <Modal visible={!!buyuk} transparent animationType="fade" onRequestClose={() => setBuyuk(null)}>
        <View style={styles.perde}>
          {buyuk && adresler[buyuk] ? (
            <Image source={{ uri: adresler[buyuk] }} style={{ width, height: height * 0.75 }} resizeMode="contain" accessibilityLabel={$t('molaFotolari.fotografi', { molaAdi })} />
          ) : (
            <ActivityIndicator color="#fff" />
          )}
          <View style={[styles.ust, { top: insets.top + 8 }]}>
            <IconButton icon="close" label={$t('ortak.kapat')} color="#fff" onPress={() => setBuyuk(null)} />
            {sahibi && buyuk ? (
              <Pressable accessibilityRole="button" onPress={() => silmeyiSor(buyuk)} hitSlop={10} style={styles.sil}>
                <Txt style={{ color: '#fff', fontFamily: fontFamily.bodySemiBold }}>{$t('molaFotolari.sil')}</Txt>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  sira: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  kucuk: { width: 64, height: 48, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  ekle: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.terra },
  perde: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  ust: { position: 'absolute', left: 8, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sil: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.15)' },
}));
