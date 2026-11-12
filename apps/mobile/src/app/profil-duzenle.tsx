import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Avatar, Button, Label } from '@/components/ui';
import { KULLANICI_ADI_BICIMI, kullaniciAdiMusait, kullaniciAdiSadelestir, profilBilgim, profilGuncelle } from '@/data/profil';
import { profilAdresi } from '@/lib/baglanti';
import { fotoSec, profilFotografiniKaldir, profilFotografiYukle, type Kaynak } from '@/lib/foto';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

type AdDurumu = 'ayni' | 'bakiliyor' | 'musait' | 'alinmis' | 'gecersiz';

export default function ProfilDuzenleScreen() {
  const insets = useSafeAreaInsets();
  const [yuklendi, setYuklendi] = useState(false);
  const [eskiKadi, setEskiKadi] = useState('');
  const [ad, setAd] = useState('');
  const [kadi, setKadi] = useState('');
  const [sehir, setSehir] = useState('');
  const [bio, setBio] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoIsliyor, setFotoIsliyor] = useState(false);
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
        setFoto(p.avatar_url);
      })
      .catch((e) => setHata(e instanceof Error ? e.message : $t('profil_duzenle.profil_yuklenemedi')))
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

  async function fotoDegistir(kaynak: Kaynak) {
    setHata(null);
    try {
      const uri = await fotoSec(kaynak, true);
      if (!uri) return;
      setFotoIsliyor(true);
      setFoto(await profilFotografiYukle(uri, foto));
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('profil_duzenle.fotograf_yuklenemedi'));
    } finally {
      setFotoIsliyor(false);
    }
  }

  async function fotoKaldir() {
    setHata(null);
    setFotoIsliyor(true);
    try {
      await profilFotografiniKaldir(foto);
      setFoto(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('profil_duzenle.fotograf_kaldirilamadi'));
    } finally {
      setFotoIsliyor(false);
    }
  }

  function fotoMenusu() {
    Alert.alert($t('profil_duzenle.profil_fotografi'), undefined, [
      { text: $t('profil_duzenle.galeriden_sec'), onPress: () => void fotoDegistir('galeri') },
      { text: $t('profil_duzenle.fotograf_cek'), onPress: () => void fotoDegistir('kamera') },
      ...(foto ? [{ text: $t('profil_duzenle.fotografi_kaldir'), style: 'destructive' as const, onPress: () => void fotoKaldir() }] : []),
      { text: $t('ortak.vazgec'), style: 'cancel' as const },
    ]);
  }

  const basHarf = (ad.trim() || '?')
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr-TR');

  async function kaydet() {
    setHata(null);
    if (ad.trim().length < 2) return setHata($t('profil_duzenle.adin_en_az_2'));
    if (!KULLANICI_ADI_BICIMI.test(kadi)) return setHata($t('profil_duzenle.kullanici_adi_3_30'));
    if (adDurumu === 'alinmis') return setHata($t('profil_duzenle.bu_kullanici_adi_kullanilamiyor'));
    setKaydediyor(true);
    try {
      await profilGuncelle({ display_name: ad.trim(), username: kadi, city: sehir.trim() || null, bio: bio.trim() || null });
      router.back();
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('ortak.kaydedilemedi'));
    } finally {
      setKaydediyor(false);
    }
  }

  const adNotu: Record<AdDurumu, string> = {
    ayni: $t('profil_duzenle.web_profilin', { profilAdresi: profilAdresi(kadi || eskiKadi) }),
    bakiliyor: $t('profil_duzenle.bakiliyor'),
    musait: $t('profil_duzenle.bu_kullanici_adi_bos'),
    alinmis: $t('profil_duzenle.bu_kullanici_adi_alinmis'),
    gecersiz: $t('profil_duzenle.m_3_30_karakter_harf'),
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={$t('profil_duzenle.profili_duzenle')} backIcon="close" center />
      {!yuklendi && supabaseHazir ? (
        <ActivityIndicator color={colors.terra} style={{ marginTop: space.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, gap: 18, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
          <View style={styles.fotoSatir}>
            <Pressable accessibilityRole="button" accessibilityLabel={$t('profil_duzenle.profil_fotografini_degistir')} onPress={fotoMenusu} disabled={fotoIsliyor || !supabaseHazir}>
              <Avatar initials={basHarf} tone="ink" size={84} uri={foto} />
              {fotoIsliyor ? (
                <View style={styles.fotoPerde}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </Pressable>
            <View style={{ flex: 1, gap: 6 }}>
              <Button label={foto ? $t('profil_duzenle.fotografi_degistir') : $t('profil_duzenle.fotograf_ekle')} icon="camera" variant="outline" onPress={fotoMenusu} disabled={fotoIsliyor || !supabaseHazir} />
              <Txt variant="small">{$t('profil_duzenle.profil_fotografin_herkese_gorunur')}</Txt>
            </View>
          </View>
          <View>
            <Label>{$t('profil_duzenle.adin')}</Label>
            <TextInput value={ad} onChangeText={setAd} placeholder={$t('profil_duzenle.or_ayse_yilmaz')} placeholderTextColor={colors.inkMuted} maxLength={40} accessibilityLabel={$t('profil_duzenle.adin')} style={styles.input} autoComplete="name" />
          </View>
          <View>
            <Label>{$t('profil_duzenle.kullanici_adi')}</Label>
            <View style={styles.kadiKutu}>
              <Txt style={{ color: colors.inkMuted, fontSize: 15 }}>@</Txt>
              <TextInput
                value={kadi}
                onChangeText={(t) => setKadi(kullaniciAdiSadelestir(t))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                accessibilityLabel={$t('profil_duzenle.kullanici_adi')}
                style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 4, backgroundColor: 'transparent' }]}
              />
            </View>
            <Txt variant="small" style={{ marginTop: 4, color: adDurumu === 'alinmis' || adDurumu === 'gecersiz' ? colors.terraInk : colors.inkMuted }} accessibilityLiveRegion="polite">
              {adNotu[adDurumu]}
            </Txt>
          </View>
          <View>
            <Label>{$t('profil_duzenle.sehir')}</Label>
            <TextInput value={sehir} onChangeText={setSehir} placeholder={$t('profil_duzenle.or_antalya')} placeholderTextColor={colors.inkMuted} maxLength={40} accessibilityLabel={$t('ortak.sehir')} style={styles.input} />
          </View>
          <View>
            <Label>{$t('profil_duzenle.hakkinda')}</Label>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={$t('profil_duzenle.or_hafta_sonlari_likya')}
              placeholderTextColor={colors.inkMuted}
              maxLength={160}
              multiline
              accessibilityLabel={$t('profil_duzenle.hakkinda')}
              style={[styles.input, { height: 96, paddingTop: 12, textAlignVertical: 'top' }]}
            />
            <Txt variant="small" style={{ marginTop: 4, textAlign: 'right' }}>
              {bio.length}/160
            </Txt>
          </View>
          <Txt variant="small">{$t('profil_duzenle.adin_kullanici_adin_sehrin')}</Txt>

          {!supabaseHazir ? <Txt variant="muted">{$t('profil_duzenle.sunucu_anahtari_girilmemis_profil')}</Txt> : null}
          {hata ? (
            <View style={styles.hata} accessibilityRole="alert">
              <Icon name="shield" size={18} color={colors.terraInk} />
              <Txt style={{ flex: 1, color: colors.terraInk }}>{hata}</Txt>
            </View>
          ) : null}
        </ScrollView>
      )}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={kaydediyor ? $t('ortak.kaydediliyor') : $t('ortak.kaydet')} icon="user" onPress={() => void kaydet()} disabled={kaydediyor || !supabaseHazir || !yuklendi} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  input: { height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
  fotoSatir: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  fotoPerde: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 84, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  kadiKutu: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingLeft: 14 },
  hata: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: colors.terraSoft },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
}));
