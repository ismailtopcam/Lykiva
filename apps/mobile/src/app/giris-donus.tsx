import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme';

/**
 * Google girişinden dönüş adresi (lykiva://giris-donus). Kodu giriş ekranı zaten okur
 * (WebBrowser.openAuthSessionAsync); Android bu adresi ayrıca uygulamaya da açtığı için
 * burada sadece önceki ekrana dönülür.
 */
export default function GirisDonus() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.ground }} />;
}
