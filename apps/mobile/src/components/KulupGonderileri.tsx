/**
 * Kulüp (grup) sayfasındaki "Gönderiler" sekmesi: üyelerin paylaştığı metin ve fotoğraflar, yeniden eskiye.
 * Fotoğraflar gizli `grup_gonderi` kovasında; bir saatlik imzalı adresle gösterilir. Yazan ya da grup yöneticisi siler.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Avatar, Button } from '@/components/ui';
import { basHarfler, grupGonderileri, grupGonderisiSil, grupRengi, kisaZaman, type Gonderi } from '@/grup/gruplar';
import { gonderiFotoAdresleri, gonderiFotograflariniSil } from '@/lib/foto';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

const SAYFA = 30;

export function KulupGonderileri({ grupId, surum }: { grupId: string; /** Değişince liste baştan yüklenir (yeni paylaşım) */ surum: number }) {
  const [liste, setListe] = useState<Gonderi[] | null>(null);
  const [dahaVar, setDahaVar] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [adresler, setAdresler] = useState<Record<string, string>>({});
  const [buyuk, setBuyuk] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let acik = true;
    grupGonderileri(grupId)
      .then((l) => {
        if (!acik) return;
        setListe(l);
        setDahaVar(l.length >= SAYFA);
        setHata(null);
      })
      .catch((e: unknown) => {
        if (!acik) return;
        setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi'));
        setListe((x) => x ?? []);
      });
    return () => {
      acik = false;
    };
  }, [grupId, surum]);

  // Henüz adresi alınmamış fotoğraflar için imzalı adres
  const eksik = (liste ?? [])
    .flatMap((g) => g.photos)
    .filter((y) => !adresler[y])
    .join('|');
  useEffect(() => {
    if (!eksik) return;
    let acik = true;
    gonderiFotoAdresleri(eksik.split('|'))
      .then((a) => acik && setAdresler((x) => ({ ...x, ...a })))
      .catch(() => undefined);
    return () => {
      acik = false;
    };
  }, [eksik]);

  async function dahaEski() {
    const son = liste?.at(-1);
    if (!son) return;
    setYukleniyor(true);
    try {
      const l = await grupGonderileri(grupId, son.created_at);
      setListe((x) => [...(x ?? []), ...l.filter((g) => !x?.some((y) => y.id === g.id))]);
      setDahaVar(l.length >= SAYFA);
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi'));
    } finally {
      setYukleniyor(false);
    }
  }

  function secenekler(g: Gonderi) {
    Alert.alert($t('kulup.gonderi_secenekleri'), undefined, [
      {
        text: $t('kulup.gonderiyi_sil'),
        style: 'destructive',
        onPress: () =>
          Alert.alert($t('kulup.silinsin_mi'), $t('kulup.silinince'), [
            { text: $t('ortak.vazgec'), style: 'cancel' },
            {
              text: $t('ortak.sil'),
              style: 'destructive',
              onPress: async () => {
                try {
                  const fotolar = await grupGonderisiSil(g.id);
                  await gonderiFotograflariniSil(fotolar);
                  setListe((x) => (x ?? []).filter((y) => y.id !== g.id));
                } catch (e) {
                  Alert.alert($t('ortak.silinemedi'), e instanceof Error ? e.message : String(e));
                }
              },
            },
          ]),
      },
      { text: $t('ortak.vazgec'), style: 'cancel' },
    ]);
  }

  if (liste === null) return <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} />;

  return (
    <View style={{ gap: space.md }}>
      {liste.length === 0 && !hata ? <Txt variant="muted">{$t('kulup.gonderi_yok')}</Txt> : null}
      {liste.map((g) => (
        <View key={g.id} style={styles.kart}>
          <View style={styles.ust}>
            <Avatar initials={basHarfler(g.display_name)} tone={grupRengi(g.author_id)} size={36} uri={g.avatar_url} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                {g.display_name}
              </Txt>
              <Txt variant="small">{kisaZaman(g.created_at)}</Txt>
            </View>
            {g.silebilir ? <IconButton icon="more" label={$t('kulup.gonderi_secenekleri')} onPress={() => secenekler(g)} /> : null}
          </View>
          {g.body ? <Txt style={{ fontSize: 15, lineHeight: 21 }}>{g.body}</Txt> : null}
          {g.photos.length ? (
            <View style={styles.fotolar}>
              {g.photos.map((y) => (
                <Pressable
                  key={y}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={$t('kulup.fotografi_buyut')}
                  onPress={() => adresler[y] && setBuyuk(adresler[y])}
                  style={[styles.foto, g.photos.length === 1 ? { width: '100%', aspectRatio: 4 / 3 } : { width: '49%', aspectRatio: 1 }]}>
                  {adresler[y] ? (
                    <Image source={{ uri: adresler[y] }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                  ) : (
                    <ActivityIndicator color={colors.inkMuted} />
                  )}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ))}
      {dahaVar ? <Button label={yukleniyor ? '…' : $t('kulup.daha_eski')} variant="outline" disabled={yukleniyor} onPress={() => void dahaEski()} /> : null}
      {hata ? <Txt style={{ color: colors.terraInk }}>{hata}</Txt> : null}

      <Modal visible={!!buyuk} transparent animationType="fade" onRequestClose={() => setBuyuk(null)}>
        <View style={styles.perde}>
          {buyuk ? <Image source={{ uri: buyuk }} style={{ width, height: height * 0.8 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
          <View style={{ position: 'absolute', top: insets.top + 8, right: 8 }}>
            <IconButton icon="close" label={$t('ortak.kapat')} color="#FFFFFF" onPress={() => setBuyuk(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  kart: { padding: 12, gap: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fotolar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  foto: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  perde: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
}));
