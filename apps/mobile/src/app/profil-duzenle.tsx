import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, Label } from '@/components/ui';
import { KULLANICI_ADI_BICIMI, kullaniciAdiMusait, kullaniciAdiSadelestir, profilBilgim, profilGuncelle } from '@/data/profil';
import { profilAdresi } from '@/lib/baglanti';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, radius, space } from '@/theme';

type AdDurumu = 'ayni' | 'bakiliyor' | 'musait' | 'alinmis' | 'gecersiz';

export default function ProfilDuzenleScreen() {
  const insets = useSafeAreaInsets();
  const [yuklendi, setYuklendi] = useState(false);
  const [eskiKadi, setEskiKadi] = useState('');
  const [ad, setAd] = useState('');
  const [kadi, setKadi] = useState('');
  const [sehir, setSehir] = useState('');
  const [bio, setBio] = useState('');
  const [adDurumu, setAdDurumu] = useState<AdDurumu>('ayni');
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseHazir) return;
    profilBilgim()
      .then((p) => {
        if (!p) return;
        setAd(p.display_name);
        setKadi(p.username);
        setEskiKadi(p.username);
        setSehir(p.city ?? '');
        setBio(p.bio ?? '');
      })
      .catch((e) => setHata(e instanceof Error ? e.message : 'Profil yüklenemedi'))
      .finally(() => setYuklendi(true));
  }, []);

  // Kullanıcı adı yazıldıkça (yarım saniye bekleyip) uygun mu diye sor
  useEffect(() => {
    if (!yuklendi) return;
    let acik = true;
    const t = setTimeout(() => {
      if (kadi === eskiKadi) return setAdDurumu('ayni');
      if (!KULLANICI_ADI_BICIMI.test(kadi)) return setAdDurumu('gecersiz');
      setAdDurumu('bakiliyor');
      kullaniciAdiMusait(kadi)
        .then((m) => acik && setAdDurumu(m ? 'musait' : 'alinmis'))
        .catch(() => acik && setAdDurumu('ayni'));
    }, 500);
    return () => {
      acik = false;
      clearTimeout(t);
    };
  }, [kadi, eskiKadi, yuklendi]);

  async function kaydet() {
    setHata(null);
    if (ad.trim().length < 2) return setHata('Adın en az 2 karakter olmalı.');
    if (!KULLANICI_ADI_BICIMI.test(kadi)) return setHata('Kullanıcı adı 3–30 karakter olmalı; yalnızca harf, rakam, nokta ve alt çizgi.');
    if (adDurumu === 'alinmis') return setHata('Bu kullanıcı adı kullanılamıyor, başka bir tane dene.');
    setKaydediyor(true);
    try {
      await profilGuncelle({ display_name: ad.trim(), username: kadi, city: sehir.trim() || null, bio: bio.trim() || null });
      router.back();
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setKaydediyor(false);
    }
  }

  const adNotu: Record<AdDurumu, string> = {
    ayni: `Web profilin: ${profilAdresi(kadi || eskiKadi)}`,
    bakiliyor: 'Bakılıyor…',
    musait: 'Bu kullanıcı adı boş.',
    alinmis: 'Bu kullanıcı adı alınmış ya da kullanılamaz.',
    gecersiz: '3–30 karakter: harf, rakam, nokta, alt çizgi.',
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Profili düzenle" backIcon="close" center />
      {!yuklendi && supabaseHazir ? (
        <ActivityIndicator color={colors.terra} style={{ marginTop: space.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, gap: 18, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
          <View>
            <Label>Adın</Label>
            <TextInput value={ad} onChangeText={setAd} placeholder="ör. Ayşe Yılmaz" placeholderTextColor={colors.inkMuted} maxLength={40} accessibilityLabel="Adın" style={styles.input} autoComplete="name" />
          </View>
          <View>
            <Label>Kullanıcı adı</Label>
            <View style={styles.kadiKutu}>
              <Txt style={{ color: colors.inkMuted, fontSize: 15 }}>@</Txt>
              <TextInput
                value={kadi}
                onChangeText={(t) => setKadi(kullaniciAdiSadelestir(t))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                accessibilityLabel="Kullanıcı adı"
                style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 4, backgroundColor: 'transparent' }]}
              />
            </View>
            <Txt variant="small" style={{ marginTop: 4, color: adDurumu === 'alinmis' || adDurumu === 'gecersiz' ? colors.terraInk : colors.inkMuted }} accessibilityLiveRegion="polite">
              {adNotu[adDurumu]}
            </Txt>
          </View>
          <View>
            <Label>Şehir</Label>
            <TextInput value={sehir} onChangeText={setSehir} placeholder="ör. Antalya" placeholderTextColor={colors.inkMuted} maxLength={40} accessibilityLabel="Şehir" style={styles.input} />
          </View>
          <View>
            <Label>Hakkında</Label>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="ör. Hafta sonları Likya Yolu'ndayım"
              placeholderTextColor={colors.inkMuted}
              maxLength={160}
              multiline
              accessibilityLabel="Hakkında"
              style={[styles.input, { height: 96, paddingTop: 12, textAlignVertical: 'top' }]}
            />
            <Txt variant="small" style={{ marginTop: 4, textAlign: 'right' }}>
              {bio.length}/160
            </Txt>
          </View>
          <Txt variant="small">Adın, kullanıcı adın, şehrin, hakkında yazın ve herkese açık aktivitelerin web profilinde görünür. Geçici hesapların web profili yoktur.</Txt>

          {!supabaseHazir ? <Txt variant="muted">Sunucu anahtarı girilmemiş; profil düzenlenemez.</Txt> : null}
          {hata ? (
            <View style={styles.hata} accessibilityRole="alert">
              <Icon name="shield" size={18} color={colors.terraInk} />
              <Txt style={{ flex: 1, color: colors.terraInk }}>{hata}</Txt>
            </View>
          ) : null}
        </ScrollView>
      )}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={kaydediyor ? 'Kaydediliyor…' : 'Kaydet'} icon="user" onPress={() => void kaydet()} disabled={kaydediyor || !supabaseHazir || !yuklendi} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  input: { height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
  kadiKutu: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingLeft: 14 },
  hata: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: colors.terraSoft },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
