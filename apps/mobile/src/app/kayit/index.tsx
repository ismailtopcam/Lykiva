/**
 * Eski egzersiz başlatma ekranı. Artık kendi arayüzü yok: süren kayıt varsa onun ekranına, yoksa Harita sekmesinin
 * "Egzersiz yap" paneline gider (rota parametresi varsa rota seçili gelir). Rota sayfasındaki "Bu rotayı başlat"
 * doğrudan Harita'ya gider; bu ekran eski bağlantılar ve yığında kalmış kopyalar için.
 * Harita'ya `dismissTo` ile gidilir: yığındaki mevcut sekmelere dönülür, yeni bir sekme kopyası açılmaz.
 */
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { otoDuraklatildi, useKayit } from '@/kayit/kaydedici';
import { colors } from '@/theme';

export default function KayitBaslatScreen() {
  const kayit = useKayit();
  const params = useLocalSearchParams<{ rota?: string }>();
  const bos = kayit.durum === 'bos';

  useEffect(() => {
    if (!bos) return;
    router.dismissTo({ pathname: '/kesfet', params: params.rota ? { rota: params.rota } : { egzersiz: '1' } });
  }, [bos, params.rota]);

  if (kayit.durum === 'kayitta' || otoDuraklatildi(kayit)) return <Redirect href="/kayit/canli" />;
  if (kayit.durum === 'duraklatildi') return <Redirect href="/kayit/duraklatildi" />;
  return <View style={{ flex: 1, backgroundColor: colors.land }} />;
}
