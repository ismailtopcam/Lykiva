import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EpostaGiris } from '@/components/EpostaGiris';
import { GoogleLogo } from '@/components/GoogleLogo';
import { Logo } from '@/components/Logo';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { appleIleGiris, appleKullanilabilir, GirisIptal, googleIleGiris, type GirisSonucu } from '@/lib/giris';
import { colors, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

/**
 * Giriş ekranı (zorunlu): e-posta + şifre formu, altında Google ve (iOS'ta) Apple. Kayıt ol ve şifremi unuttum
 * aynı ekranda (`EpostaGiris`). Geçici hesapla başlanmışsa kayıtlar giriş yapılan hesaba bağlanır / taşınır.
 */
export default function GirisScreen() {
  const [apple, setApple] = useState(false);
  const [bekleyen, setBekleyen] = useState<'apple' | 'google' | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    void appleKullanilabilir().then(setApple);
  }, []);

  function tamam(sonuc: GirisSonucu) {
    if (sonuc.tasinan > 0) {
      Alert.alert($t('giris.hesabina_giris_yapildi'), $t('giris.bu_telefondaki_kayit_hesabina', { tasinan: sonuc.tasinan }));
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
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

  const sosyal = (
    <View style={{ gap: space.md }}>
      {hata ? (
        <View accessibilityLiveRegion="polite" style={styles.hata}>
          <Txt style={{ color: colors.terraInk, fontSize: 13 }}>{hata}</Txt>
        </View>
      ) : null}

      <Button
        variant="outline"
        label={bekleyen === 'google' ? $t('giris.google_aciliyor') : $t('giris.google_ile_devam_et')}
        leading={<GoogleLogo />}
        onPress={() => void giris('google')}
        disabled={!!bekleyen}
        style={{ borderRadius: radius.lg }}
      />

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
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.icerik}>
          <View style={styles.ust}>
            <Logo size={34} />
            <Txt style={{ fontSize: 15, lineHeight: 21, color: colors.inkMuted, marginTop: space.md }}>
              {$t('giris.kayitlarin_hesabinda_saklanir_telefon')}
            </Txt>
          </View>
          <EpostaGiris onBitti={tamam} sosyal={sosyal} />
        </ScrollView>
      </KeyboardAvoidingView>
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

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  icerik: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.xl, paddingVertical: space.xl },
  ust: { marginBottom: space.xl },
  dugme: { height: 54, width: '100%' },
  hata: { backgroundColor: colors.terraSoft, borderRadius: radius.md, padding: space.md },
}));
