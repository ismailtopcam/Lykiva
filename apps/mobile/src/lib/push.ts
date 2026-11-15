/**
 * Telefona anlık bildirim (push): Expo Push Service.
 * Sunucu: supabase/migrations/20261110080000_push.sql (jeton kaydı; yeni bildirimde gönderim).
 *
 * Çalışması için (bir kez, geliştirici tarafında):
 *   - EAS proje kimliği: `npx eas-cli@latest init` (app.json > expo.extra.eas.projectId yazılır)
 *   - iOS: Apple Developer'da push anahtarı (APNs .p8) ve `npx eas-cli@latest credentials` ile Expo'ya yüklenmesi
 *   - Telefona yeni derleme (expo-notifications yerel modül): `npx expo run:ios --device`
 * Bunlar yoksa özellik sessizce kapalı kalır (Ayarlar'da nedeni yazar); uygulama içi bildirimler etkilenmez.
 *
 * İzin, kullanıcı giriş yapınca bir kez kendiliğinden istenir (`pushGiristen`; her kurulumda bir kez). Reddederse bir
 * daha sorulmaz; Ayarlar'dan ya da Bildirimler ekranındaki öneriden açılır. Ölü jetonları sunucu Expo'nun
 * makbuzlarından temizler (20261118000000_push_makbuzlari.sql).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { oturumuSagla, supabase, supabaseHazir } from '@/lib/supabase';
import { $t } from '@/i18n';

const JETON_DEPO = 'lykiva.push.jeton.v1';
const KAPALI_DEPO = 'lykiva.push.kapali.v1';
/** Bu kurulumda izin kendiliğinden bir kez soruldu mu */
const SORULDU_DEPO = 'lykiva.push.soruldu.v1';

export const PROJE_KIMLIGI: string | null =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;

export type PushDurumu =
  | 'desteklenmiyor' // web, simülatör ya da sunucu anahtarı yok
  | 'proje-yok' // EAS proje kimliği yok (geliştirici ayarı)
  | 'reddedildi' // kullanıcı izin vermedi (telefon ayarlarından açılır)
  | 'sorulmadi'
  | 'kapali' // izin var ama kullanıcı uygulamada kapattı
  | 'acik';

// Uygulama öndeyken gelen bildirim de üstte görünsün
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
}

export async function pushDurumu(): Promise<PushDurumu> {
  if (Platform.OS === 'web' || !Device.isDevice || !supabaseHazir) return 'desteklenmiyor';
  if (!PROJE_KIMLIGI) return 'proje-yok';
  const izin = await Notifications.getPermissionsAsync();
  if (!izin.granted) return izin.canAskAgain ? 'sorulmadi' : 'reddedildi';
  return (await AsyncStorage.getItem(KAPALI_DEPO)) ? 'kapali' : 'acik';
}

async function kanaliHazirla() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('varsayilan', { name: $t('ortak.bildirimler'), importance: AndroidImportance.DEFAULT });
  }
}

async function jetonuKaydet(): Promise<void> {
  await kanaliHazirla();
  const { data: jeton } = await Notifications.getExpoPushTokenAsync({ projectId: PROJE_KIMLIGI! });
  await oturumuSagla();
  const { error } = await supabase.rpc('push_jetonu_kaydet', { p_jeton: jeton, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  if (error) throw new Error(error.message);
  await AsyncStorage.setItem(JETON_DEPO, jeton);
}

/** İzin ister (gerekirse) ve bu telefonu kaydeder. Dönen: son durum */
export async function pushAc(): Promise<PushDurumu> {
  const d = await pushDurumu();
  if (d === 'desteklenmiyor' || d === 'proje-yok' || d === 'reddedildi') return d;
  if (d === 'sorulmadi') {
    // Android 13+: izin penceresi bir bildirim kanalı varken çıkar
    await kanaliHazirla();
    const izin = await Notifications.requestPermissionsAsync();
    if (!izin.granted) return izin.canAskAgain ? 'sorulmadi' : 'reddedildi';
  }
  await AsyncStorage.removeItem(KAPALI_DEPO);
  await jetonuKaydet();
  return 'acik';
}

/** Bu telefona bildirim gönderilmesin (jeton sunucudan silinir) */
export async function pushKapat(kalici = true): Promise<void> {
  const jeton = await AsyncStorage.getItem(JETON_DEPO);
  if (jeton && supabaseHazir) await supabase.rpc('push_jetonu_sil', { p_jeton: jeton }).then(undefined, () => undefined);
  await AsyncStorage.removeItem(JETON_DEPO);
  if (kalici) await AsyncStorage.setItem(KAPALI_DEPO, '1');
}

/** Uygulama açılınca: izin verilmiş ve kapatılmamışsa jetonu tazele (jeton değişebilir, hesap değişmiş olabilir) */
export async function pushTazele(): Promise<void> {
  if ((await pushDurumu()) !== 'acik') return;
  await jetonuKaydet().catch(() => undefined);
}

/**
 * Kullanıcı giriş yapınca (geçici hesap değilken; hesap değişince yeniden): izin varsa jeton bu hesaba kaydedilir;
 * izin hiç sorulmadıysa bu kurulumda bir kez sorulur.
 */
export async function pushGiristen(): Promise<void> {
  const d = await pushDurumu();
  if (d === 'acik') {
    await jetonuKaydet().catch(() => undefined);
    return;
  }
  if (d !== 'sorulmadi' || (await AsyncStorage.getItem(SORULDU_DEPO))) return;
  await AsyncStorage.setItem(SORULDU_DEPO, '1');
  await pushAc().catch(() => undefined);
}
