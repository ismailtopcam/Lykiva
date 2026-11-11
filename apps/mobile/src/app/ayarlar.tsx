import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { Button, Card, Label, ListRow, ToggleRow } from '@/components/ui';
import { kuyruguGonder, yerelKayitlariTemizle } from '@/kayit/kuyruk';
import { WEB_URL } from '@/lib/baglanti';
import { cikisYap, useHesap, type Saglayici } from '@/lib/giris';
import { hesabiSil } from '@/lib/hesap';
import { pushAc, pushDurumu, pushKapat, type PushDurumu } from '@/lib/push';
import { supabaseHazir } from '@/lib/supabase';
import { colors, space } from '@/theme';

const adlar: Record<Saglayici, string> = { google: 'Google', apple: 'Apple', email: 'E-posta' };

export default function AyarlarScreen() {
  const hesap = useHesap();
  const [cikiliyor, setCikiliyor] = useState(false);
  const [siliniyor, setSiliniyor] = useState(false);
  const [push, setPush] = useState<PushDurumu | null>(null);

  useFocusEffect(
    useCallback(() => {
      let acik = true;
      pushDurumu()
        .then((d) => acik && setPush(d))
        .catch(() => undefined);
      return () => {
        acik = false;
      };
    }, []),
  );

  async function pushDegistir(ac: boolean) {
    try {
      if (ac) setPush(await pushAc());
      else {
        await pushKapat();
        setPush('kapali');
      }
    } catch (e) {
      Alert.alert('Yapılamadı', e instanceof Error ? e.message : String(e));
    }
  }

  const pushAlt =
    push === 'acik'
      ? 'Yorum, takip, etkinlik ve grup bildirimleri bu telefona gelir'
      : push === 'reddedildi'
        ? 'İzin verilmemiş. Telefonun Ayarlar > Lykiva > Bildirimler bölümünden açabilirsin'
        : push === 'proje-yok'
          ? 'Bu derlemede kapalı (EAS proje kimliği eklenmemiş)'
          : push === 'desteklenmiyor'
            ? 'Bu cihazda kullanılamıyor'
            : 'Uygulama kapalıyken de bildirim al';

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

  function silmeyiSor() {
    const gecici = !!hesap?.gecici;
    Alert.alert(
      'Hesabın kalıcı olarak silinsin mi?',
      `${gecici ? 'Bu telefondaki geçici hesabın' : 'Hesabın'} ve ona bağlı her şey silinir: aktiviteler, rotalar, fotoğraflar, yorumlar, beğeniler, takipler, mesajlar ve bildirimler. Kurduğun gruplar en kıdemli yöneticiye ya da üyeye devredilir, oluşturduğun etkinlikler silinir. Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Kalıcı olarak sil', style: 'destructive' as const, onPress: () => void sil() },
      ],
    );
  }

  async function sil() {
    setSiliniyor(true);
    try {
      await hesabiSil();
      if (router.canDismiss()) router.dismissAll();
      router.replace('/giris');
      Alert.alert('Hesabın silindi', 'Hesabın ve verilerin silindi.');
    } catch (e) {
      Alert.alert('Hesap silinemedi', e instanceof Error ? e.message : String(e));
    } finally {
      setSiliniyor(false);
    }
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

        {push && push !== 'desteklenmiyor' ? (
          <View>
            <Label>Bildirimler</Label>
            <Card style={{ paddingHorizontal: space.lg }}>
              <ToggleRow title="Telefona bildirim" subtitle={pushAlt} value={push === 'acik'} onChange={(v) => void pushDegistir(v)} />
            </Card>
          </View>
        ) : null}

        {!supabaseHazir ? (
          <Txt variant="muted">Sunucu anahtarı girilmemiş; uygulama örnek verilerle çalışıyor.</Txt>
        ) : hesap?.gecici || !hesap ? (
          <ListRow icon="user" iconTone="terra" caption="Kayıtların kaybolmasın" title="Giriş yap ya da hesap aç" href="/giris" />
        ) : (
          <Button variant="outline" label={cikiliyor ? 'Çıkış yapılıyor…' : 'Çıkış yap'} onPress={() => void cik()} disabled={cikiliyor} />
        )}

        <View>
          <Label>Hakkında</Label>
          <Card style={{ paddingHorizontal: space.lg }}>
            <ListRow icon="shield" iconTone="sea" title="Gizlilik politikası" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/gizlilik`)} />
            <ListRow icon="lock" iconTone="sea" title="Kullanım koşulları" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/kosullar`)} />
          </Card>
        </View>

        {supabaseHazir && hesap ? (
          <View>
            <Label>Hesabı sil</Label>
            <Card style={{ padding: space.lg, gap: space.md }}>
              <Txt variant="small">Hesabını ve ona bağlı tüm verileri kalıcı olarak siler. Geri alınamaz.</Txt>
              <Button variant="outline" label={siliniyor ? 'Siliniyor…' : 'Hesabımı sil'} onPress={silmeyiSor} disabled={siliniyor || cikiliyor} />
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
});
