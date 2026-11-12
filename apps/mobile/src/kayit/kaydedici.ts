/**
 * GPS kaydedici.
 *
 * - Arka plan izni varsa expo-task-manager görevi ile kaydeder: ekran kapalıyken ve
 *   uygulama arka plandayken devam eder (Android'de bildirimli ön plan servisi).
 * - Arka plan izni yoksa uygulama açıkken kaydeder.
 * - Kayıt durumu her nokta grubunda telefona yazılır; uygulama kapanırsa kaldığı yerden sürer.
 * - Duraklatma yeni bir "parça" başlatır; parçalar arası yol mesafeye eklenmez.
 * - Android'de kilit ekranında süre, mesafe ve ortalama hız gösterilir (kilitEkrani.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { acceptPoint, LOCATION_DISTANCE_INTERVAL_M, prepareRoute, trackOnRoute, type ActivityType, type HavaDurumu, type PreparedRoute, type RouteProgress, type RoutePoint, type TrackPoint } from '@lykiva/shared';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

import { simdikiHava } from '@/lib/hava';

import { hemenYayinla, konumYayinla, paylasimiBitir, type PaylasimGrubu } from './canliPaylasim';
import { kilitEkrani, kilitEkraniIzniIste, kilitEkraniniYenile } from './kilitEkrani';
import { kuyrugaEkle, kuyruguGonder, sunucuIdsi } from './kuyruk';
import { paketOlustur } from './paket';
import { $t } from '@/i18n';

export const KONUM_GOREVI = 'lykiva-konum-kaydi';
const DEPO = 'lykiva.kayit.aktif.v1';

export type KayitDurumu = 'bos' | 'kayitta' | 'duraklatildi';

export type Kayit = {
  durum: KayitDurumu;
  clientId: string;
  activity: ActivityType;
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
  /** Canlı konumun paylaşıldığı grup (yoksa paylaşılmıyor) */
  paylasim: PaylasimGrubu | null;
  /** Kayıt başlarken alınan hava (internet yoksa null kalır) */
  hava: HavaDurumu | null;
};

export type KayitRotasi = { id: string; name: string; points: RoutePoint[] };

const BOS: Kayit = {
  durum: 'bos',
  clientId: '',
  activity: 'bike',
  segments: [],
  baslangic: 0,
  duraklatmaBaslangic: null,
  duraklamaToplam: 0,
  arkaPlan: false,
  sonKonum: null,
  rota: null,
  rotaIlerleme: null,
  paylasim: null,
  hava: null,
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
  kilitEkrani(kayit, () => aktifSure(kayit), KONUM_GOREVI);
}

function degistir(yeni: Partial<Kayit>, kaydet = true) {
  kayit = { ...kayit, ...yeni };
  haberVer();
  if (kaydet) void yaz();
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
  // Yarım kalan ve arka plansız kayıtta ön plan izlemesini yeniden başlat
  if (kayit.durum === 'kayitta' && !kayit.arkaPlan) await onPlanIzle();
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
  if (kayit.durum !== 'kayitta') {
    degistir({ sonKonum }, false);
    return;
  }
  const segments = kayit.segments.length ? [...kayit.segments] : [[]];
  const seg = [...segments[segments.length - 1]];
  let rotaIlerleme = kayit.rotaIlerleme;
  for (const p of yeni) {
    if (acceptPoint(seg[seg.length - 1], p)) {
      seg.push(p);
      if (kayit.rota) rotaIlerleme = trackOnRoute(hazir(kayit.rota), p, rotaIlerleme);
    }
  }
  segments[segments.length - 1] = seg;
  degistir({ segments, sonKonum, rotaIlerleme });
  if (!kayit.hava) havayiYakala();
  if (kayit.paylasim) konumYayinla(paylasimDurumu());
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
    notificationTitle: $t('kayit_kaydedici.lykiva_kaydediyor'),
    notificationBody: $t('kayit_kaydedici.rotan_hizin_ve_molalarin'),
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

export async function baslat(activity: ActivityType, rota: KayitRotasi | null = null, paylasim: PaylasimGrubu | null = null) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new IzinHatasi($t('kayit_kaydedici.konum_izni_verilmedi_ayarlar'));
  degistir({
    ...BOS,
    durum: 'kayitta',
    clientId: randomUUID(),
    activity,
    segments: [[]],
    baslangic: Date.now(),
    sonKonum: kayit.sonKonum,
    rota,
    rotaIlerleme: rota && kayit.sonKonum ? trackOnRoute(hazir(rota), kayit.sonKonum) : null,
    paylasim,
  });
  if (paylasim) hemenYayinla(paylasimDurumu());
  havayiYakala();
  const arkaPlan = await izlemeyiBaslat();
  degistir({ arkaPlan });
  kilitEkraniniYenile(1500);
  // İzin yeni verildiyse bildirim ancak yeniden gönderilince görünür
  void kilitEkraniIzniIste().then(() => kilitEkraniniYenile());
}

export async function duraklat() {
  if (kayit.durum !== 'kayitta') return;
  await izlemeyiDurdur();
  degistir({ durum: 'duraklatildi', duraklatmaBaslangic: Date.now() });
  if (kayit.paylasim) hemenYayinla(paylasimDurumu());
}

export async function devamEt() {
  if (kayit.durum !== 'duraklatildi') return;
  const son = kayit.segments[kayit.segments.length - 1];
  const segments = son && son.length === 0 ? kayit.segments : [...kayit.segments, []];
  const duraklamaToplam = kayit.duraklamaToplam + (kayit.duraklatmaBaslangic ? Date.now() - kayit.duraklatmaBaslangic : 0);
  degistir({ durum: 'kayitta', duraklatmaBaslangic: null, duraklamaToplam, segments });
  if (kayit.paylasim) hemenYayinla(paylasimDurumu());
  const arkaPlan = await izlemeyiBaslat();
  degistir({ arkaPlan });
  kilitEkraniniYenile(1500);
}

/**
 * Kaydı bitirir, kuyruğa koyar ve göndermeyi dener.
 * Dönen değer gösterilecek aktivitenin adresi: sunucu id'si ya da "yerel-<client_id>".
 */
export async function bitir(title?: string): Promise<string | null> {
  await izlemeyiDurdur();
  const paket = paketOlustur({ clientId: kayit.clientId, activity: kayit.activity, segments: kayit.segments, title, routeId: kayit.rota?.id, hava: kayit.hava });
  const clientId = kayit.clientId;
  const paylasiyordu = !!kayit.paylasim;
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
  const paylasiyordu = !!kayit.paylasim;
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

/** Kayıt sürüyor ya da duraklatılmış mı (bileşeni yeniden çizmeden okumak için) */
export function kayitSuruyor(): boolean {
  return kayit.durum !== 'bos';
}

/** Başlat ekranı için: kayıt başlamadan GPS'i ısıtır ve konumu gösterir */
export function konumOnizlemeBaslat(): () => void {
  let sub: Location.LocationSubscription | null = null;
  let iptal = false;
  (async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted || iptal) return;
    sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 }, (l) => {
      if (kayit.durum === 'bos') degistir({ sonKonum: konumdanNokta(l) }, false);
    });
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
