/**
 * Android'de pil optimizasyonu. Bazı üreticiler (Xiaomi, Samsung, Huawei, Oppo, OnePlus…) ekran kapalıyken
 * uygulamanın ön plan servisini bile durdurabiliyor: kayıt yarıda kesilir, iz düz çizgiyle birleşir. Lykiva'nın pil
 * kullanımını "Kısıtlamasız" yapmak bunu önler.
 *
 * Durumu okuyacak yerel modül yok (expo-battery kurulu değil; eklenirse yeni derleme gerekir). Bu yüzden:
 * - ilk arka plan kaydında bir kez anlatılır ve ayar sayfası açtırılır (sorulduğu telefonda saklanır),
 * - Ayarlar > Kayıt > "Kayıt yarıda kesilmesin" ile her zaman açılabilir.
 *
 * Uygulama bilgisi sayfası açılır (`Linking.openSettings`): Android 12 ve sonrasında "Pil" > "Kısıtlamasız" orada.
 * Açılamazsa telefonun pil optimizasyonu listesine gidilir. Doğrudan istisna isteyen izin
 * (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) Google Play'de kısıtlı olduğu ve yeni derleme gerektirdiği için kullanılmıyor.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';

import { $t } from '@/i18n';

const SORULDU_DEPO = 'lykiva.pil-optimizasyonu.soruldu.v1';

/** Bu telefonda pil ayarı anlamlı mı (yalnızca Android) */
export const pilAyariVar = Platform.OS === 'android';

/** Lykiva'nın uygulama bilgisi sayfasını (Pil > Kısıtlamasız) açar */
export async function pilAyariniAc(): Promise<void> {
  if (!pilAyariVar) return;
  try {
    await Linking.openSettings();
  } catch {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => undefined);
  }
}

/** Nasıl yapılacağını anlatır, isterse ayar sayfasını açar */
export function pilAyariniAnlat(): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(
      $t('pil_optimizasyonu.baslik'),
      $t('pil_optimizasyonu.aciklama'),
      [
        { text: $t('pil_optimizasyonu.simdi_degil'), style: 'cancel', onPress: () => resolve() },
        { text: $t('pil_optimizasyonu.ayari_ac'), onPress: () => void pilAyariniAc().finally(resolve) },
      ],
      { cancelable: true, onDismiss: () => resolve() },
    );
  });
}

/** İlk arka plan kaydında bir kez sorar (sonra yalnızca Ayarlar'dan) */
export async function pilAyariniBirKezSor(): Promise<void> {
  if (!pilAyariVar) return;
  try {
    if (await AsyncStorage.getItem(SORULDU_DEPO)) return;
    await AsyncStorage.setItem(SORULDU_DEPO, '1');
  } catch {
    return; // depolama yoksa her kayıtta sormaktansa hiç sorma
  }
  await pilAyariniAnlat();
}
