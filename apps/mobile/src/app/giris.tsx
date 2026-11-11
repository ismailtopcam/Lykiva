import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EpostaGiris } from '@/components/EpostaGiris';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { appleIleGiris, appleKullanilabilir, GirisIptal, girisiAtla, googleIleGiris, type GirisSonucu } from '@/lib/giris';
import { colors, fontFamily, radius, space } from '@/theme';
import { $t } from '@/i18n';

const maddeler = (): [IconName, string][] => [
  ['shield', $t('giris.kayitlarin_hesabinda_saklanir_telefon')],
  ['users', $t('giris.arkadaslarini_takip_et_gruplarla')],
  ['lock', $t('giris.rotanin_basi_ve_sonu')],
];

/**
 * Giriş: Apple (iOS), Google ve e-posta + şifre. Geçici hesapla başlanmışsa kayıtlar yeni hesaba bağlanır.
 * Açılışta bir kez gösterilir; "Şimdilik geç" denirse profilden tekrar açılabilir.
 */
export default function GirisScreen() {
  const [apple, setApple] = useState(false);
  const [bekleyen, setBekleyen] = useState<'apple' | 'google' | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [eposta, setEposta] = useState(false);

  useEffect(() => {
    void appleKullanilabilir().then(setApple);
  }, []);

  function bitti() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function tamam(sonuc: GirisSonucu) {
    if (sonuc.tasinan > 0) {
      Alert.alert($t('giris.hesabina_giris_yapildi'), $t('giris.bu_telefondaki_kayit_hesabina', { tasinan: sonuc.tasinan }));
    }
    bitti();
  }

  async function giris(tur: 'apple' | 'google') {
    if (bekleyen) return;
    setHata(null);
    setBekleyen(tur);
    try {
      tamam(tur === 'apple' ? await appleIleGiris() : await googleIleGiris());
    } catch (e) {
      if (!(e instanceof GirisIptal)) setHata(hataMetni(e));
    } finally {
      setBekleyen(null);
    }
  }

  async function atla() {
    await girisiAtla();
    bitti();
  }

  if (eposta) {
    return (
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.epostaIcerik}>
            <View style={[styles.ust, { marginBottom: space.xl }]}>
              <Logo size={34} />
            </View>
            <EpostaGiris onBitti={tamam} onVazgec={() => setEposta(false)} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.ust}>
        <Logo size={34} />
      </View>

      <View style={styles.orta}>
        <Txt variant="display" accessibilityRole="header" style={{ fontSize: 34, lineHeight: 40 }}>
          {$t('giris.patikada_yolda_dagda_hep')}</Txt>
        <View style={{ gap: space.md, marginTop: space.xl }}>
          {maddeler().map(([ikon, metin]) => (
            <View key={metin} style={styles.madde}>
              <View style={styles.maddeIkon}>
                <Icon name={ikon} size={18} color={colors.seaInk} />
              </View>
              <Txt style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>{metin}</Txt>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.alt}>
        {hata ? (
          <View accessibilityLiveRegion="polite" style={styles.hata}>
            <Txt style={{ color: colors.terraInk, fontSize: 13 }}>{hata}</Txt>
          </View>
        ) : null}

        {apple ? (
          <View>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.lg}
              style={[styles.dugme, bekleyen && { opacity: 0.55 }]}
              onPress={() => void giris('apple')}
            />
            {bekleyen === 'apple' ? <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" /> : null}
          </View>
        ) : null}

        <Button
          variant="outline"
          label={bekleyen === 'google' ? $t('giris.google_aciliyor') : $t('giris.google_ile_devam_et')}
          onPress={() => void giris('google')}
          disabled={!!bekleyen}
          style={{ borderRadius: radius.lg }}
        />

        <Button
          variant="outline"
          label={$t('giris.e_postayla_devam_et')}
          onPress={() => {
            setHata(null);
            setEposta(true);
          }}
          disabled={!!bekleyen}
          style={{ borderRadius: radius.lg }}
        />

        <Pressable accessibilityRole="button" onPress={() => void atla()} disabled={!!bekleyen} hitSlop={8} style={styles.atla}>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.inkMuted }}>{$t('giris.simdilik_gec')}</Txt>
        </Pressable>
        <Txt variant="small" style={{ textAlign: 'center' }}>
          {$t('giris.giris_yapmadan_da_kayit')}</Txt>
      </View>
    </SafeAreaView>
  );
}

function hataMetni(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/network|fetch|internet/i.test(m)) return $t('giris.internet_baglantisi_yok_gibi');
  if (/provider is not enabled|Unsupported provider|provider_disabled/i.test(m)) return $t('giris.bu_giris_yontemi_sunucuda');
  if (/manual linking/i.test(m)) return $t('giris.hesap_baglama_sunucuda_kapali');
  return $t('giris.giris_yapilamadi', { m });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground, paddingHorizontal: space.xl },
  ust: { paddingTop: space.lg },
  orta: { flex: 1, justifyContent: 'center' },
  madde: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  maddeIkon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.seaSoft, alignItems: 'center', justifyContent: 'center' },
  alt: { gap: space.md, paddingBottom: space.lg },
  dugme: { height: 54, width: '100%' },
  atla: { alignSelf: 'center', paddingVertical: space.sm, minHeight: 44, justifyContent: 'center' },
  hata: { backgroundColor: colors.terraSoft, borderRadius: radius.md, padding: space.md },
  epostaIcerik: { flexGrow: 1, paddingBottom: space.xl },
});
