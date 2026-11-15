/**
 * Rotadan çıkınca uyarı: telefon titrer ve bildirim gelir (ekran kapalıyken, telefon cepteyken de).
 *
 * Ne zaman uyarılacağına `@lykiva/shared` > `rotaUyarisi` karar verir (kaydedici her konumda çağırır); burası yalnızca
 * uyarıyı verir. Uyarı yerel bir bildirimdir: Android'de yüksek öncelikli, titreşimli kendi kanalında (titreşimi
 * sistem yapar; uygulamada titreşim izni yok, ekleseydik yeni derleme gerekirdi), iOS'ta sesli bildirim (sessiz
 * modda telefon titrer). Aynı kimlikle gönderildiği için hatırlatmalar çekmecede tek bildirimi günceller; rotaya
 * dönünce ya da kayıt bitince kaldırılır. Bildirime dokununca canlı kayıt ekranı açılır.
 *
 * Bildirim izni yoksa uyarı yalnızca ekranda kalır (canlı kayıt ekranındaki "Rotadan … m uzaktasın").
 * Ayarlar > Bildirimler'den kapatılabilir (seçim telefonda saklanır).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatMeters, type RotaUyariOlayi } from '@lykiva/shared';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { $t } from '@/i18n';

const KANAL = 'rota-uyarisi';
const BILDIRIM_KIMLIGI = 'lykiva-rota-uyarisi';
const AYAR_DEPO = 'lykiva.rota-uyarisi.v1';

// ---- Ayar (varsayılan açık) ----

let acik = true;
let ayarYuklendi = false;
const dinleyiciler = new Set<() => void>();

function ayariYukle() {
  if (ayarYuklendi) return;
  ayarYuklendi = true;
  AsyncStorage.getItem(AYAR_DEPO)
    .then((s) => {
      if (s === '0' && acik) {
        acik = false;
        dinleyiciler.forEach((f) => f());
      }
    })
    .catch(() => undefined);
}
// Arka plan görevinde de ilk konumdan önce okunsun
if (Platform.OS !== 'web') ayariYukle();

export function useRotaUyarisiAcik(): boolean {
  return useSyncExternalStore(
    (f) => {
      ayariYukle();
      dinleyiciler.add(f);
      return () => {
        dinleyiciler.delete(f);
      };
    },
    () => acik,
    () => acik,
  );
}

export function rotaUyarisiAyarla(v: boolean) {
  ayarYuklendi = true;
  acik = v;
  dinleyiciler.forEach((f) => f());
  void AsyncStorage.setItem(AYAR_DEPO, v ? '1' : '0').catch(() => undefined);
  if (!v) void rotaUyarisiniKaldir();
}

// ---- Uyarı ----

let kanalHazir = false;
async function kanaliHazirla() {
  if (Platform.OS !== 'android' || kanalHazir) return;
  await Notifications.setNotificationChannelAsync(KANAL, {
    name: $t('rota_uyarisi.kanal'),
    importance: AndroidImportance.HIGH,
    enableVibrate: true,
    vibrationPattern: [0, 500, 250, 500],
    sound: 'default',
  });
  kanalHazir = true;
}

/** Rota takip edilirken bildirim izni yoksa bir kez sorar (Android 13+'ta kayıt başlarken zaten soruluyor) */
export async function rotaUyarisiIzni(): Promise<void> {
  if (Platform.OS === 'web' || !acik) return;
  try {
    await kanaliHazirla();
    const izin = await Notifications.getPermissionsAsync();
    if (!izin.granted && izin.canAskAgain) await Notifications.requestPermissionsAsync();
  } catch {
    // izin penceresi açılamadı; uyarı yalnızca ekranda kalır
  }
}

/** Kaydedici çağırır: rotadan çıkıldı / hâlâ dışarıda / dönüldü */
export async function rotaUyarisiVer(olay: RotaUyariOlayi, sapmaM: number, rotaAdi: string): Promise<void> {
  if (Platform.OS === 'web' || !olay) return;
  if (olay === 'dondu') {
    await rotaUyarisiniKaldir();
    return;
  }
  if (!acik) return;
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await kanaliHazirla();
    await Notifications.scheduleNotificationAsync({
      identifier: BILDIRIM_KIMLIGI,
      content: {
        title: olay === 'cikti' ? $t('rota_uyarisi.baslik') : $t('rota_uyarisi.hatirlat_baslik'),
        body: $t('rota_uyarisi.govde', { ad: rotaAdi, meters: formatMeters(sapmaM) }),
        sound: 'default',
        data: { tur: 'rota_uyarisi' },
      },
      trigger: Platform.OS === 'android' ? { channelId: KANAL } : null,
    });
  } catch {
    // bildirim gönderilemedi; ekrandaki uyarı yine görünür
  }
}

/** Rotaya dönülünce ya da kayıt bitince bildirimi çekmeceden kaldırır */
export async function rotaUyarisiniKaldir(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.dismissNotificationAsync(BILDIRIM_KIMLIGI).catch(() => undefined);
}
