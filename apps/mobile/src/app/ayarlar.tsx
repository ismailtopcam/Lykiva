import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { Button, Card, Label, ListRow } from '@/components/ui';
import { kuyruguGonder, yerelKayitlariTemizle } from '@/kayit/kuyruk';
import { cikisYap, useHesap, type Saglayici } from '@/lib/giris';
import { supabaseHazir } from '@/lib/supabase';
import { colors, space } from '@/theme';

const adlar: Record<Saglayici, string> = { google: 'Google', apple: 'Apple' };

export default function AyarlarScreen() {
  const hesap = useHesap();
  const [cikiliyor, setCikiliyor] = useState(false);

  async function cik() {
    setCikiliyor(true);
    try {
      // Bekleyen kayıtlar başka hesaba gitmesin: önce göndermeyi dene
      const kalan = await kuyruguGonder().catch(() => -1);
      if (kalan !== 0) {
        Alert.alert(
          'Gönderilmemiş kayıt var',
          'Bu telefonda henüz sunucuya gitmemiş kayıtların var. İnternete bağlanıp tekrar dene; şimdi çıkarsan bu kayıtlar silinir.',
          [
            { text: 'Vazgeç', style: 'cancel' },
            {
              text: 'Sil ve çık',
              style: 'destructive',
              onPress: () => void cikisVeYonlendir(),
            },
          ],
        );
        return;
      }
      await cikisVeYonlendir();
    } finally {
      setCikiliyor(false);
    }
  }

  async function cikisVeYonlendir() {
    await cikisYap();
    // Önceki hesabın bekleyen kayıtları ve yerel eşleşmeleri sonraki hesaba karışmasın
    await yerelKayitlariTemizle();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/giris');
  }

  const hesapMetni =
    hesap === undefined
      ? '…'
      : !hesap
        ? 'Oturum yok'
        : hesap.gecici
          ? 'Geçici hesap (bu telefonda)'
          : `${hesap.saglayicilar.map((s) => adlar[s]).join(' + ')} ile giriş yapıldı`;

  return (
    <View style={styles.root}>
      <Header title="Ayarlar" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Label>Hesap</Label>
          <Card style={{ padding: space.lg, gap: 4 }}>
            <Txt style={{ fontSize: 15 }}>{hesapMetni}</Txt>
            {hesap?.eposta ? <Txt variant="small">{hesap.eposta}</Txt> : null}
          </Card>
        </View>

        {!supabaseHazir ? (
          <Txt variant="muted">Sunucu anahtarı girilmemiş; uygulama örnek verilerle çalışıyor.</Txt>
        ) : hesap?.gecici || !hesap ? (
          <ListRow icon="user" iconTone="terra" caption="Kayıtların kaybolmasın" title="Google ya da Apple ile giriş yap" href="/giris" />
        ) : (
          <Button variant="outline" label={cikiliyor ? 'Çıkış yapılıyor…' : 'Çıkış yap'} onPress={() => void cik()} disabled={cikiliyor} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
});
