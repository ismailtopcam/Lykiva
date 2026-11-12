/**
 * Kulüp (grup) sayfasındaki "Paylaş" sekmesi: kulübe metin ve en fazla 4 fotoğraflı gönderi.
 * Fotoğraflar paylaş'a basılınca yüklenir; paylaşım başarısız olursa yüklenenler silinir.
 */
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { grupGonderisiPaylas } from '@/grup/gruplar';
import { fotoSec, GONDERI_FOTO_SINIRI, gonderiFotografiYukle, gonderiFotograflariniSil, type Kaynak } from '@/lib/foto';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

const METIN_SINIRI = 2000;

export function GonderiPaylas({ grupId, onPaylasildi }: { grupId: string; onPaylasildi: () => void }) {
  const [metin, setMetin] = useState('');
  const [fotolar, setFotolar] = useState<string[]>([]);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const bos = !metin.trim() && fotolar.length === 0;

  async function ekle(kaynak: Kaynak) {
    try {
      const uri = await fotoSec(kaynak);
      if (uri) setFotolar((x) => (x.length >= GONDERI_FOTO_SINIRI ? x : [...x, uri]));
    } catch (e) {
      Alert.alert($t('kulup.fotograf_eklenemedi'), e instanceof Error ? e.message : String(e));
    }
  }

  async function paylas() {
    if (bos || gonderiliyor) return;
    setGonderiliyor(true);
    const yuklenen: string[] = [];
    try {
      for (const uri of fotolar) yuklenen.push(await gonderiFotografiYukle(grupId, uri));
      await grupGonderisiPaylas(grupId, metin.trim(), yuklenen);
      setMetin('');
      setFotolar([]);
      onPaylasildi();
    } catch (e) {
      await gonderiFotograflariniSil(yuklenen);
      Alert.alert($t('kulup.paylasilamadi'), e instanceof Error ? e.message : String(e));
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <TextInput
        value={metin}
        onChangeText={setMetin}
        placeholder={$t('kulup.ne_paylasmak')}
        placeholderTextColor={colors.inkMuted}
        accessibilityLabel={$t('kulup.metin_etiketi')}
        multiline
        maxLength={METIN_SINIRI}
        textAlignVertical="top"
        style={styles.metin}
      />
      {metin.length > METIN_SINIRI - 200 ? (
        <Txt variant="small" style={{ textAlign: 'right', marginTop: -8 }}>
          {metin.length} / {METIN_SINIRI}
        </Txt>
      ) : null}

      {fotolar.length ? (
        <View style={styles.fotolar}>
          {fotolar.map((uri, i) => (
            <View key={uri + i} style={styles.foto}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={$t('kulup.fotografi_cikar')}
                hitSlop={8}
                disabled={gonderiliyor}
                onPress={() => setFotolar((x) => x.filter((_, j) => j !== i))}
                style={styles.cikar}>
                <Icon name="close" size={14} color="#FFFFFF" strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {fotolar.length < GONDERI_FOTO_SINIRI ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Pressable accessibilityRole="button" disabled={gonderiliyor} onPress={() => void ekle('galeri')} style={styles.ekle}>
            <Icon name="image" size={18} />
            <Txt style={styles.ekleYazi}>{$t('kulup.galeriden', { n: fotolar.length, sinir: GONDERI_FOTO_SINIRI })}</Txt>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={gonderiliyor} onPress={() => void ekle('kamera')} style={styles.ekle}>
            <Icon name="camera" size={18} />
            <Txt style={styles.ekleYazi}>{$t('kulup.fotograf_cek')}</Txt>
          </Pressable>
        </View>
      ) : null}

      <Button label={gonderiliyor ? $t('kulup.paylasiliyor') : $t('kulup.paylas_dugmesi')} icon="send" disabled={bos || gonderiliyor} onPress={() => void paylas()} />
      <Txt variant="small">{$t('kulup.paylas_notu')}</Txt>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  metin: {
    minHeight: 120,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  fotolar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foto: { width: 76, height: 76, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.sand },
  cikar: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  ekle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong },
  ekleYazi: { fontFamily: fontFamily.bodySemiBold, fontSize: 13 },
}));
