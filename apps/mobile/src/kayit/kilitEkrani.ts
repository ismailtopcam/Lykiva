/**
 * Kilit ekranında süren kaydın penceresi: süre, mesafe, ortalama hız.
 * Android'de kayıt bildirimi, iOS'ta Live Activity (kilit ekranı + Dynamic Island).
 * Modül: modules/kilit-ekrani. Kaydedici her durum değişikliğinde `kilitEkrani` çağırır.
 *
 * Süre telefonda kendi kendine sayar; mesafe ve hız her yeni konumda yenilenir (en sık saniyede bir).
 * Ortalama hız kayıt ekranındakiyle aynı: yalnızca hareket hâlindeyken.
 */
import { activityLabel, computeSegmentedStats, formatKm, formatSpeedKmh, kmUnit, speedUnit } from '@lykiva/shared';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { $t } from '@/i18n';

import { kilitEkraniGuncelle, kilitEkraniKapat, kilitEkraniVar } from '../../modules/kilit-ekrani';
import type { Kayit } from './kaydedici';

const EN_SIK_MS = 1000;

let sonAnahtar: string | null = null;
let sonGonderim = 0;
let bekleyen: ReturnType<typeof setTimeout> | null = null;
let sonIstek: { k: Kayit; gecenMs: () => number; gorev: string } | null = null;
let zorla = false;
/** Açılışta bir kez: önceki oturumdan kalan pencere (uygulama kapandı / çöktü) kapatılır */
let ilkKapatma = true;
/** Değerler değişmese de arada bir yeniden gönder: servis bildirimi kendi metnine dönmüş olabilir */
const ONARIM_MS = 15_000;

/** Kayıt durumunu kilit ekranına yansıtır; kayıt yoksa pencereyi kapatır */
export function kilitEkrani(k: Kayit, gecenMs: () => number, gorev: string): void {
  if (!kilitEkraniVar) return;
  if (k.durum === 'bos') {
    if (bekleyen) clearTimeout(bekleyen);
    bekleyen = null;
    sonIstek = null;
    if (sonAnahtar != null || ilkKapatma) kilitEkraniKapat();
    ilkKapatma = false;
    sonAnahtar = null;
    return;
  }
  ilkKapatma = false;
  sonIstek = { k, gecenMs, gorev };
  // Durum değişince (duraklat / devam) hemen; değer değişince en sık saniyede bir
  const durumDegisti = !sonAnahtar?.startsWith(`${k.clientId}|${k.durum}|`);
  const bekle = durumDegisti ? 0 : Math.max(0, sonGonderim + EN_SIK_MS - Date.now());
  if (bekle === 0) {
    gonder();
  } else if (!bekleyen) {
    bekleyen = setTimeout(gonder, bekle);
  }
}

function gonder() {
  if (bekleyen) clearTimeout(bekleyen);
  bekleyen = null;
  const istek = sonIstek;
  if (!istek) return;
  const { k, gorev } = istek;
  const stats = computeSegmentedStats(k.segments);
  const mesafe = formatKm(stats.distanceM);
  const hiz = formatSpeedKmh(stats.avgMovingSpeed);
  const sayiyor = k.durum === 'kayitta';
  // Süre telefonda sayıyor; yalnızca durum, değerler ya da dil değişince (bir de 15 sn'de bir) yeniden gönder
  const anahtar = [k.clientId, k.durum, mesafe, hiz, $t('ortak.sure'), Math.floor(Date.now() / ONARIM_MS)].join('|');
  if (anahtar === sonAnahtar && !zorla) return;
  zorla = false;
  sonAnahtar = anahtar;
  sonGonderim = Date.now();
  kilitEkraniGuncelle({
    kanalAdi: $t('kayit_kaydedici.kilit_kanal'),
    etkinlik: k.activity,
    baslik: `${activityLabel(k.activity)} · ${sayiyor ? $t('kayit_kaydedici.kilit_kaydediyor') : $t('kayit_duraklatildi.duraklatildi')}`,
    gecenMs: istek.gecenMs(),
    sayiyor,
    mesafe,
    mesafeBirim: kmUnit(),
    hiz,
    hizBirim: speedUnit(),
    sureEtiket: $t('ortak.sure'),
    mesafeEtiket: $t('ortak.mesafe'),
    hizEtiket: $t('ortak.ort_hiz'),
    gorev,
  });
}

/**
 * Konum servisi başladıktan sonra: servisin kendi bildirimi biraz gecikip gelir, onu pencereye çevirmek
 * için değerler değişmemiş olsa da yeniden gönder.
 */
export function kilitEkraniniYenile(gecikmeMs = 0): void {
  if (!kilitEkraniVar) return;
  setTimeout(() => {
    zorla = true;
    gonder();
  }, gecikmeMs);
}

/**
 * Android 13+ bildirim izni: yoksa kayıt bildirimi (ve kilit ekranı penceresi) hiç görünmez.
 * Kayıt başlarken bir kez sorulur; reddedilirse bir daha sorulmaz (telefon ayarlarından açılır).
 */
export async function kilitEkraniIzniIste(): Promise<void> {
  if (!kilitEkraniVar || Platform.OS !== 'android' || Platform.Version < 33) return;
  try {
    const izin = await Notifications.getPermissionsAsync();
    if (!izin.granted && izin.canAskAgain) await Notifications.requestPermissionsAsync();
  } catch {
    // izin penceresi açılamadı; kayıt bildirimsiz sürer
  }
}
