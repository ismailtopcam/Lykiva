/**
 * GPS kaydedici.
 *
 * - Arka plan izni varsa expo-task-manager görevi ile kaydeder: ekran kapalıyken ve
 *   uygulama arka plandayken devam eder (Android'de bildirimli ön plan servisi).
 * - Arka plan izni yoksa uygulama açıkken kaydeder.
 * - Kayıt durumu her nokta grubunda telefona yazılır; uygulama kapanırsa kaldığı yerden sürer.
 * - Duraklatma yeni bir "parça" başlatır; parçalar arası yol mesafeye eklenmez.
 * - Otomatik duraklatma (Ayarlar'dan kapatılabilir, bkz. otoDuraklat.ts): durunca kayıt kendiliğinden duraklar, hareket
 *   edince sürer. Kararı `@lykiva/shared` > `otoDurak` verir. Elle duraklatmadan farkı: GPS açık kalır (yeniden hareketi
 *   görmek için), yeni parça başlamaz (durulan yerden devam edilen yere kadar yol mesafeye eklenir) ve canlı ekran
 *   açık kalır. Otomatik duraklatılmışken "Duraklat"a basılırsa elle duraklatmaya dönüşür.
 * - Kilit ekranında süre, mesafe ve ortalama hız gösterilir: Android bildirim, iOS Live Activity (kilitEkrani.ts).
 * - Yol tarifi "Egzersiz olarak da kaydet" kapalıyken başlatıldıysa (`kaydetme`) her şey aynı işler, yalnızca
 *   bitirince aktivite oluşmaz: ekranlar `bitir` yerine `iptalEt` çağırır (kullanıcı isterse yine kaydedebilir).
 * - Rota takip edilirken rotadan çıkınca telefon titrer ve bildirim gelir (arka planda da; bkz. rotaUyarisi.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { acceptPoint, haversine, LOCATION_DISTANCE_INTERVAL_M, OTO_DURAK, otoDurak, prepareRoute, rotaUyarisi, trackOnRoute, type ActivityType, type HavaDurumu, type OtoDurakAyari, type OtoDurakDurumu, type OtoDurakOlayi, type PreparedRoute, type RotaUyariDurumu, type RotaUyariOlayi, type RouteProgress, type RoutePoint, type TrackPoint } from '@lykiva/shared';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

import { simdikiHava } from '@/lib/hava';

import { hemenYayinla, konumYayinla, paylasimiBitir, type PaylasimGrubu } from './canliPaylasim';
import { kilitEkrani, kilitEkraniIzniIste, kilitEkraniniYenile } from './kilitEkrani';
import { otoDuraklatAcik } from './otoDuraklat';
import { kuyrugaEkle, kuyruguGonder, sunucuIdsi } from './kuyruk';
import { paketOlustur } from './paket';
import { rotaUyarisiIzni, rotaUyarisiniKaldir, rotaUyarisiVer } from './rotaUyarisi';
import { $t } from '@/i18n';

export const KONUM_GOREVI = 'lykiva-konum-kaydi';
const DEPO = 'lykiva.kayit.aktif.v1';

export type KayitDurumu = 'bos' | 'kayitta' | 'duraklatildi';

export type Kayit = {
  durum: KayitDurumu;
  clientId: string;
  activity: ActivityType;
  /**
   * Araba yolculuğu (Harita > Yolculuk yap > Araba). Araba etkinlik türü değildir: `kaydetme` hep açıktır ve
   * "Aktivite olarak kaydet" seçeneği sunulmaz (`bitir` de iptal eder). `activity` bu durumda anlamsızdır, gösterilmez.
   */
  araba: boolean;
  /** Duraklatmalarla bölünmüş nokta listeleri */
  segments: TrackPoint[][];
  baslangic: number;
  duraklatmaBaslangic: number | null;
  /** Bitmiş duraklatmaların toplamı (ms) */
  duraklamaToplam: number;
  /** Arka planda da kaydediyor mu (izin verildi mi) */
  arkaPlan: boolean;
  /** Son gelen konum (kabul edilmese de) — GPS durumu ve harita için */
  sonKonum: TrackPoint | null;
  /** Takip edilen rota (varsa) */
  rota: KayitRotasi | null;
  /** Rotadaki son ilerleme */
  rotaIlerleme: RouteProgress | null;
  /** Rotadan çıkma uyarısının durumu (saklanır: uygulama kapanıp açılsa da aynı uyarı tekrarlanmaz) */
  rotaUyari: RotaUyariDurumu | null;
  /** Canlı konumun paylaşıldığı grup (yoksa grupla paylaşılmıyor) */
  paylasim: PaylasimGrubu | null;
  /** Canlı konum bağlantısının anahtarı (bağlantıyla paylaşılıyorsa; bkz. canliPaylasim.ts) */
  canliBaglanti: string | null;
  /** Kayıt başlarken alınan hava (internet yoksa null kalır) */
  hava: HavaDurumu | null;
  /** Yalnızca yol tarifi: bitince aktivite olarak kaydedilmeyecek */
  kaydetme: boolean;
  /** Otomatik duraklatmanın durumu; `durdu` ise şu anki duraklatma otomatik (bkz. `otoDuraklatildi`) */
  otoDurak: OtoDurakDurumu | null;
};

export type KayitRotasi = { id: string; name: string; points: RoutePoint[] };

const BOS: Kayit = {
  durum: 'bos',
  clientId: '',
  activity: 'bike',
  araba: false,
  segments: [],
  baslangic: 0,
  duraklatmaBaslangic: null,
  duraklamaToplam: 0,
  arkaPlan: false,
  sonKonum: null,
  rota: null,
  rotaIlerleme: null,
  rotaUyari: null,
  paylasim: null,
  canliBaglanti: null,
  hava: null,
  kaydetme: false,
  otoDurak: null,
};

// Hazırlanmış rota (birikmiş mesafeler) — rota başına bir kez hesaplanır
let hazirRota: { id: string; r: PreparedRoute } | null = null;
function hazir(rota: KayitRotasi): PreparedRoute {
  if (hazirRota?.id !== rota.id) hazirRota = { id: rota.id, r: prepareRoute(rota.points) };
  return hazirRota.r;
}

let kayit: Kayit = BOS;
let yuklendi = false;
const dinleyiciler = new Set<() => void>();
let onPlanAboneligi: Location.LocationSubscription | null = null;

function haberVer() {
  dinleyiciler.forEach((f) => f());
  // aktifSure saniye döner, kilit ekranı milisaniye bekler
  kilitEkrani(kayit, () => aktifSure(kayit) * 1000, KONUM_GOREVI);
}

function degistir(yeni: Partial<Kayit>, kaydet = true) {
  kayit = { ...kayit, ...yeni };
  haberVer();
  otoZamanlayiciyiAyarla();
  if (kaydet) void yaz();
}

/** Şu anki duraklatma otomatik mi (GPS açık, hareket edince kendiliğinden sürecek) */
export function otoDuraklatildi(k: Kayit): boolean {
  return k.durum === 'duraklatildi' && !!k.otoDurak?.durdu;
}

/** Kaydın ekranı: otomatik duraklatılmışken de canlı ekran */
export function kayitEkrani(): '/kayit/canli' | '/kayit/duraklatildi' | '/kayit' {
  if (kayit.durum === 'kayitta' || otoDuraklatildi(kayit)) return '/kayit/canli';
  return kayit.durum === 'duraklatildi' ? '/kayit/duraklatildi' : '/kayit';
}

function otoAyari(k: Kayit): OtoDurakAyari {
  return OTO_DURAK[k.araba ? 'car' : k.activity] ?? OTO_DURAK.bike;
}

/** Durulan yere varıldıktan sonraki noktalar (yerinde kıpırtı) atılır */
function durustanSonrakileriAt(segments: TrackPoint[][], baslangic: number): TrackPoint[][] {
  if (!segments.length) return segments;
  const kopya = [...segments];
  kopya[kopya.length - 1] = kopya[kopya.length - 1].filter((q) => q.t <= baslangic);
  return kopya;
}

// Yerinde dururken konum hiç gelmeyebilir (konum ancak birkaç metre ilerleyince geliyor): kayıt sürerken birkaç
// saniyede bir konumsuz karar istenir. Uygulama arka planda uyurken çalışmayabilir; o zaman mola, sonraki konum
// geldiğinde geriye dönük işlenir (bkz. otoDurak).
const OTO_KONTROL_MS = 2000;
let otoZamanlayici: ReturnType<typeof setInterval> | null = null;

function otoZamanlayiciyiAyarla() {
  const gerekli = kayit.durum === 'kayitta';
  if (gerekli && !otoZamanlayici) {
    otoZamanlayici = setInterval(otoKontrol, OTO_KONTROL_MS);
  } else if (!gerekli && otoZamanlayici) {
    clearInterval(otoZamanlayici);
    otoZamanlayici = null;
  }
}

function otoKontrol() {
  if (kayit.durum !== 'kayitta' || !otoDuraklatAcik()) return;
  const r = otoDurak(kayit.otoDurak, { t: Date.now() }, otoAyari(kayit));
  if (r.olay?.tur !== 'duraklat') return;
  degistir({ durum: 'duraklatildi', duraklatmaBaslangic: r.olay.baslangic, otoDurak: r.durum, segments: durustanSonrakileriAt(kayit.segments, r.olay.baslangic) });
  if (kayit.paylasim || kayit.canliBaglanti) hemenYayinla(paylasimDurumu());
}

let yazmaBekliyor = false;
async function yaz() {
  if (yazmaBekliyor) return;
  yazmaBekliyor = true;
  // Saniyede bir noktada her seferinde yazmamak için kısa gecikme
  await new Promise((r) => setTimeout(r, 1500));
  yazmaBekliyor = false;
  try {
    if (kayit.durum === 'bos') await AsyncStorage.removeItem(DEPO);
    else await AsyncStorage.setItem(DEPO, JSON.stringify({ ...kayit, sonKonum: null }));
  } catch {
    // depolama dolu vb. — kayıt bellekte sürer
  }
}

/** Uygulama açılışında (veya görev uyandığında) yarım kalan kaydı geri yükler */
export async function kaydiGeriYukle(): Promise<Kayit> {
  if (yuklendi) return kayit;
  yuklendi = true;
  try {
    const s = await AsyncStorage.getItem(DEPO);
    if (s) kayit = { ...BOS, ...(JSON.parse(s) as Kayit) };
  } catch {
    kayit = BOS;
  }
  haberVer();
  otoZamanlayiciyiAyarla();
  // Yarım kalan ve arka plansız kayıtta ön plan izlemesini yeniden başlat (otomatik duraklatılmışken de GPS açık)
  if ((kayit.durum === 'kayitta' || otoDuraklatildi(kayit)) && !kayit.arkaPlan) await onPlanIzle();
  return kayit;
}

function konumdanNokta(l: Location.LocationObject): TrackPoint {
  return {
    t: l.timestamp,
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    alt: l.coords.altitude,
    acc: l.coords.accuracy,
    speed: l.coords.speed,
  };
}

function noktalarEkle(locs: Location.LocationObject[]) {
  if (!locs.length) return;
  const yeni = [...locs].sort((a, b) => a.timestamp - b.timestamp).map(konumdanNokta);
  const sonKonum = yeni[yeni.length - 1];
  // Elle duraklatılmışken GPS kapalı; yine de gelen olursa yalnızca konum güncellenir
  if (kayit.durum !== 'kayitta' && !otoDuraklatildi(kayit)) {
    degistir({ sonKonum }, false);
    return;
  }
  const segments = kayit.segments.length ? [...kayit.segments] : [[]];
  let seg = [...segments[segments.length - 1]];
  let rotaIlerleme = kayit.rotaIlerleme;
  let rotaUyari = kayit.rotaUyari;
  let uyari: RotaUyariOlayi = null;
  let durum = kayit.durum;
  let duraklatmaBaslangic = kayit.duraklatmaBaslangic;
  let duraklamaToplam = kayit.duraklamaToplam;
  let oto = kayit.otoDurak;
  const otoAcik = otoDuraklatAcik();
  const ayar = otoAyari(kayit);
  for (const p of yeni) {
    if (!acceptPoint(seg[seg.length - 1], p)) continue;
    let olay: OtoDurakOlayi = null;
    if (otoAcik) {
      const r = otoDurak(oto, { t: p.t, nokta: p }, ayar);
      oto = r.durum;
      olay = r.olay;
    } else {
      // Ayar otomatik duraklatılmışken kapatıldıysa kayıt sürer
      if (durum === 'duraklatildi') olay = { tur: 'devam', bitis: p.t, sinyalKaybi: false };
      oto = null;
    }
    if (olay?.tur === 'duraklat') {
      const bas = olay.baslangic;
      seg = seg.filter((q) => q.t <= bas);
      durum = 'duraklatildi';
      duraklatmaBaslangic = bas;
    } else if (olay?.tur === 'mola') {
      const bas = olay.baslangic;
      seg = seg.filter((q) => q.t <= bas);
      duraklamaToplam += Math.max(0, olay.bitis - bas);
    } else if (olay?.tur === 'devam') {
      // Sinyal kaybıysa (tünel) mola değildi: süre geri alınır
      if (!olay.sinyalKaybi && duraklatmaBaslangic != null) duraklamaToplam += Math.max(0, olay.bitis - duraklatmaBaslangic);
      durum = 'kayitta';
      duraklatmaBaslangic = null;
    }
    // Duraklatılmışken nokta eklenmez; devam edince aynı parçaya eklenir (durulan yerden buraya yol sayılır)
    if (durum !== 'kayitta') continue;
    seg.push(p);
    if (kayit.rota) {
      rotaIlerleme = trackOnRoute(hazir(kayit.rota), p, rotaIlerleme);
      const u = rotaUyarisi(rotaUyari, { offRouteM: rotaIlerleme.offRouteM, remainingM: rotaIlerleme.remainingM, t: p.t, acc: p.acc });
      rotaUyari = u.durum;
      // Arka planda konumlar toplu gelebilir: gruptaki son olay geçerli (çıktı ve döndüyse uyarı kalkar)
      if (u.olay) uyari = u.olay;
    }
  }
  segments[segments.length - 1] = seg;
  const durumDegisti = durum !== kayit.durum;
  degistir({ segments, sonKonum, rotaIlerleme, rotaUyari, durum, duraklatmaBaslangic, duraklamaToplam, otoDurak: oto });
  if (uyari && kayit.rota && rotaIlerleme) void rotaUyarisiVer(uyari, rotaIlerleme.offRouteM, kayit.rota.name);
  if (!kayit.hava) havayiYakala();
  if (kayit.paylasim || kayit.canliBaglanti) {
    if (durumDegisti) hemenYayinla(paylasimDurumu());
    else konumYayinla(paylasimDurumu());
  }
}

// Kayıt başına bir kez dene (internet yoksa sessizce vazgeç; kayıt hava bilgisiz kaydedilir)
let havaIstenen: string | null = null;
function havayiYakala() {
  const k = kayit.sonKonum;
  if (!k || kayit.durum === 'bos' || havaIstenen === kayit.clientId) return;
  const clientId = kayit.clientId;
  havaIstenen = clientId;
  simdikiHava(k.lat, k.lng)
    .then((hava) => {
      if (hava && kayit.clientId === clientId) degistir({ hava });
    })
    .catch(() => undefined);
}

function paylasimDurumu() {
  return {
    grup: kayit.paylasim,
    baglanti: !!kayit.canliBaglanti,
    activity: kayit.activity,
    segments: kayit.segments,
    baslangic: kayit.baslangic,
    duraklatildi: kayit.durum === 'duraklatildi',
    sonKonum: kayit.sonKonum,
  };
}

// Arka plan görevi modül yüklenirken tanımlanmalı (kök düzende içe aktarılır)
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(KONUM_GOREVI, async ({ data, error }) => {
    if (error || !data) return;
    await kaydiGeriYukle();
    noktalarEkle(data.locations);
  });
}

const IZLEME = (): Location.LocationTaskOptions => ({
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: LOCATION_DISTANCE_INTERVAL_M,
  activityType: Location.ActivityType.Fitness,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    // Kaydedilmeyen yolculukta bildirim "kaydediyor" demesin
    notificationTitle: kayit.kaydetme ? $t('kayit_kaydedici.yol_tarifi_suruyor') : $t('kayit_kaydedici.lykiva_kaydediyor'),
    notificationBody: kayit.kaydetme ? $t('kayit_kaydedici.yol_tarifi_konum') : $t('kayit_kaydedici.rotan_hizin_ve_molalarin'),
    notificationColor: '#B04E25',
    killServiceOnDestroy: false,
  },
});

async function onPlanIzle() {
  onPlanAboneligi?.remove();
  onPlanAboneligi = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: LOCATION_DISTANCE_INTERVAL_M },
    (l) => noktalarEkle([l]),
  );
}

// Google Play kuralı: arka plan konum izni istenmeden önce uygulama içinde açık bir bilgilendirme
// gösterilmeli ve kullanıcı bunu kendisi onaylamalı. Aynı oturumda reddedilirse bir daha sorulmaz.
let arkaPlanBilgisiReddedildi = false;

function arkaPlanBilgisiOnayi(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      $t('kayit_kaydedici.ekran_kapaliyken_de_kaydet'),
      $t('kayit_kaydedici.lykiva_kayit_surerken_uygulama'),
      [
        { text: $t('kayit_kaydedici.simdi_degil'), style: 'cancel', onPress: () => resolve(false) },
        { text: $t('kayit_kaydedici.devam'), onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

async function arkaPlanIzniIste(): Promise<boolean> {
  const mevcut = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (mevcut?.granted) return true;
  if (Platform.OS === 'android') {
    if (arkaPlanBilgisiReddedildi || mevcut?.canAskAgain === false) return false;
    if (!(await arkaPlanBilgisiOnayi())) {
      arkaPlanBilgisiReddedildi = true;
      return false;
    }
  }
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
  return !!bg?.granted;
}

async function izlemeyiBaslat(): Promise<boolean> {
  let arkaPlan = false;
  if (Platform.OS !== 'web' && (await TaskManager.isAvailableAsync())) {
    if (await arkaPlanIzniIste()) {
      if (!(await Location.hasStartedLocationUpdatesAsync(KONUM_GOREVI).catch(() => false))) {
        await Location.startLocationUpdatesAsync(KONUM_GOREVI, IZLEME());
      }
      arkaPlan = true;
    }
  }
  if (!arkaPlan) await onPlanIzle();
  return arkaPlan;
}

async function izlemeyiDurdur() {
  onPlanAboneligi?.remove();
  onPlanAboneligi = null;
  if (Platform.OS !== 'web' && (await Location.hasStartedLocationUpdatesAsync(KONUM_GOREVI).catch(() => false))) {
    await Location.stopLocationUpdatesAsync(KONUM_GOREVI);
  }
}

export class IzinHatasi extends Error {}

/**
 * `kaydetme`: yalnızca yol tarifi; bitince aktivite olarak kaydedilmeyecek.
 * `activity` 'car' ise araba yolculuğu: her zaman `kaydetme` ve sonradan da kaydedilemez (bkz. `Kayit.araba`).
 * `canliBaglanti`: önceden açılmış canlı konum bağlantısının anahtarı (`baglantiAc`).
 */
export async function baslat(activity: ActivityType | 'car', rota: KayitRotasi | null = null, paylasim: PaylasimGrubu | null = null, kaydetme = false, canliBaglanti: string | null = null) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new IzinHatasi($t('kayit_kaydedici.konum_izni_verilmedi_ayarlar'));
  degistir({
    ...BOS,
    durum: 'kayitta',
    clientId: randomUUID(),
    activity: activity === 'car' ? BOS.activity : activity,
    araba: activity === 'car',
    segments: [[]],
    baslangic: Date.now(),
    sonKonum: kayit.sonKonum,
    rota,
    rotaIlerleme: rota && kayit.sonKonum ? trackOnRoute(hazir(rota), kayit.sonKonum) : null,
    paylasim,
    canliBaglanti,
    kaydetme: kaydetme || activity === 'car',
  });
  if (paylasim || canliBaglanti) hemenYayinla(paylasimDurumu());
  havayiYakala();
  const arkaPlan = await izlemeyiBaslat();
  degistir({ arkaPlan });
  kilitEkraniniYenile(1500);
  // İzin yeni verildiyse bildirim ancak yeniden gönderilince görünür. Rota takip ediliyorsa rotadan çıkma uyarısı için
  // de bildirim izni gerekir (iOS'ta burada sorulur; Android 13+'ta kilit ekranı için zaten soruldu)
  void kilitEkraniIzniIste().then(() => {
    kilitEkraniniYenile();
    if (rota) return rotaUyarisiIzni();
  });
}

/** Elle duraklatır. Otomatik duraklatılmışsa elle duraklatmaya çevirir (GPS kapanır; duraklama başı aynı kalır) */
export async function duraklat() {
  if (otoDuraklatildi(kayit)) {
    await izlemeyiDurdur();
    degistir({ otoDurak: null });
    return;
  }
  if (kayit.durum !== 'kayitta') return;
  await izlemeyiDurdur();
  degistir({ durum: 'duraklatildi', duraklatmaBaslangic: Date.now(), otoDurak: null });
  if (kayit.paylasim || kayit.canliBaglanti) hemenYayinla(paylasimDurumu());
}

export async function devamEt() {
  if (kayit.durum !== 'duraklatildi') return;
  // Otomatik duraklatılmışken: GPS zaten açık, aynı parçada sürer
  if (otoDuraklatildi(kayit)) {
    const duraklamaToplam = kayit.duraklamaToplam + (kayit.duraklatmaBaslangic ? Math.max(0, Date.now() - kayit.duraklatmaBaslangic) : 0);
    degistir({ durum: 'kayitta', duraklatmaBaslangic: null, duraklamaToplam, otoDurak: null });
    if (kayit.paylasim || kayit.canliBaglanti) hemenYayinla(paylasimDurumu());
    return;
  }
  const son = kayit.segments[kayit.segments.length - 1];
  const segments = son && son.length === 0 ? kayit.segments : [...kayit.segments, []];
  const duraklamaToplam = kayit.duraklamaToplam + (kayit.duraklatmaBaslangic ? Date.now() - kayit.duraklatmaBaslangic : 0);
  degistir({ durum: 'kayitta', duraklatmaBaslangic: null, duraklamaToplam, segments, otoDurak: null });
  if (kayit.paylasim || kayit.canliBaglanti) hemenYayinla(paylasimDurumu());
  const arkaPlan = await izlemeyiBaslat();
  degistir({ arkaPlan });
  kilitEkraniniYenile(1500);
}

/**
 * Kaydı bitirir, kuyruğa koyar ve göndermeyi dener.
 * Dönen değer gösterilecek aktivitenin adresi: sunucu id'si ya da "yerel-<client_id>".
 */
export async function bitir(title?: string): Promise<string | null> {
  // Araba yolculuğu aktivite değildir: hangi ekrandan bitirilirse bitirilsin kaydedilmez
  if (kayit.araba) {
    await iptalEt();
    return null;
  }
  await izlemeyiDurdur();
  void rotaUyarisiniKaldir();
  const paket = paketOlustur({ clientId: kayit.clientId, activity: kayit.activity, segments: kayit.segments, title, routeId: kayit.rota?.id, hava: kayit.hava });
  const clientId = kayit.clientId;
  const paylasiyordu = !!kayit.paylasim || !!kayit.canliBaglanti;
  degistir({ ...BOS, sonKonum: kayit.sonKonum });
  if (paylasiyordu) void paylasimiBitir();
  if (!paket) return null;
  await kuyrugaEkle(paket);
  try {
    await kuyruguGonder();
  } catch {
    // internet yok — kuyrukta bekler
  }
  return (await sunucuIdsi(clientId)) ?? `yerel-${clientId}`;
}

export async function iptalEt() {
  await izlemeyiDurdur();
  void rotaUyarisiniKaldir();
  const paylasiyordu = !!kayit.paylasim || !!kayit.canliBaglanti;
  degistir({ ...BOS, sonKonum: kayit.sonKonum });
  if (paylasiyordu) void paylasimiBitir();
}

function abone(f: () => void) {
  dinleyiciler.add(f);
  return () => {
    dinleyiciler.delete(f);
  };
}

export function useKayit(): Kayit {
  return useSyncExternalStore(abone, () => kayit, () => kayit);
}

/** Yalnızca durum değişince yeniden çizer (GPS güncellemelerinde değil); ör. alt menü */
export function useKayitDurumu(): KayitDurumu {
  return useSyncExternalStore(abone, kayitDurumu, kayitDurumu);
}

/** Kaydın şu anki durumu (bileşeni yeniden çizmeden okumak için; ör. sekme düğmesi) */
export function kayitDurumu(): KayitDurumu {
  return kayit.durum;
}

/** Kayıt sürüyor ya da duraklatılmış mı (bileşeni yeniden çizmeden okumak için) */
export function kayitSuruyor(): boolean {
  return kayit.durum !== 'bos';
}

/** Önizlemede kullanılacak son bilinen konumun en fazla yaşı (daha eskisi yanlış yere götürebilir) */
const SON_BILINEN_EN_ESKI_MS = 5 * 60_000;

/** Önizleme konumu: kayıt yokken sonKonum'u günceller; ekranı gereksiz yere yeniden çizmemek için kıpırtıyı atlar */
function onizlemeKonumu(l: Location.LocationObject) {
  if (kayit.durum !== 'bos') return;
  const yeni = konumdanNokta(l);
  const eski = kayit.sonKonum;
  if (eski && yeni.t <= eski.t) return;
  // Yerinde dururken GPS saniyede bir aynı noktayı verir; 1 m'den az kıpırtı ve aynı doğruluk için çizim yok
  if (eski && Math.abs((yeni.acc ?? 0) - (eski.acc ?? 0)) < 1 && haversine(eski, yeni) < 1) return;
  degistir({ sonKonum: yeni }, false);
}

/** Bu kadar yeni bir konum varsa açılışta yeniden alınmaz */
const ISITMA_TAZE_MS = 30_000;
let isiniyor = false;

/**
 * Uygulama açılınca / öne gelince konumu önceden alır: Harita sekmesine (ya da Kayıt başlat ekranına) geçildiğinde
 * harita beklemeden konuma gelsin. İzin istemez (izin yoksa hiçbir şey yapmaz); GPS'i sürekli açık tutmaz, tek konum alır.
 */
export async function konumuIsit(): Promise<void> {
  if (isiniyor || kayit.durum !== 'bos') return;
  if (kayit.sonKonum && Date.now() - kayit.sonKonum.t < ISITMA_TAZE_MS) return;
  isiniyor = true;
  try {
    const izin = await Location.getForegroundPermissionsAsync();
    if (!izin.granted) return;
    // Son bilinen konum hemen gelir; ardından taze konum (Balanced: ağ / Wi-Fi destekli, GPS'ten hızlı)
    const son = await Location.getLastKnownPositionAsync({ maxAge: SON_BILINEN_EN_ESKI_MS }).catch(() => null);
    if (son) onizlemeKonumu(son);
    const taze = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
    if (taze) onizlemeKonumu(taze);
  } catch {
    // konum alınamadı; Harita sekmesi kendi izlemesini başlatır
  } finally {
    isiniyor = false;
  }
}

/** Başlat ekranı ve Harita sekmesi için: kayıt başlamadan GPS'i ısıtır ve konumu gösterir */
export function konumOnizlemeBaslat(): () => void {
  let sub: Location.LocationSubscription | null = null;
  let iptal = false;
  (async () => {
    // İzin zaten verildiyse yeniden istenmez (istek her seferinde yerel köprüden geçer, ilk konumu geciktirir)
    let fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted || iptal) return;
    // İlk GPS konumu soğuk başlangıçta birkaç saniye sürebilir; beklerken son bilinen konum hemen gösterilir
    if (!kayit.sonKonum) {
      void Location.getLastKnownPositionAsync({ maxAge: SON_BILINEN_EN_ESKI_MS })
        .then((l) => l && !iptal && onizlemeKonumu(l))
        .catch(() => undefined);
    }
    sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 }, onizlemeKonumu);
    if (iptal) sub.remove();
  })().catch(() => undefined);
  return () => {
    iptal = true;
    sub?.remove();
  };
}

/** Duraklatmalar hariç geçen süre (sn) */
export function aktifSure(k: Kayit, simdi = Date.now()): number {
  if (k.durum === 'bos') return 0;
  const bitis = k.durum === 'duraklatildi' && k.duraklatmaBaslangic ? k.duraklatmaBaslangic : simdi;
  return Math.max(0, (bitis - k.baslangic - k.duraklamaToplam) / 1000);
}
