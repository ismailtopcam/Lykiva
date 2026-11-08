/**
 * GPS kaydedici.
 *
 * - Arka plan izni varsa expo-task-manager görevi ile kaydeder: ekran kapalıyken ve
 *   uygulama arka plandayken devam eder (Android'de bildirimli ön plan servisi).
 * - Arka plan izni yoksa uygulama açıkken kaydeder.
 * - Kayıt durumu her nokta grubunda telefona yazılır; uygulama kapanırsa kaldığı yerden sürer.
 * - Duraklatma yeni bir "parça" başlatır; parçalar arası yol mesafeye eklenmez.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { acceptPoint, type ActivityType, type TrackPoint } from '@lykiva/shared';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { kuyrugaEkle, kuyruguGonder, sunucuIdsi } from './kuyruk';
import { paketOlustur } from './paket';

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
};

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
};

let kayit: Kayit = BOS;
let yuklendi = false;
const dinleyiciler = new Set<() => void>();
let onPlanAboneligi: Location.LocationSubscription | null = null;

function degistir(yeni: Partial<Kayit>, kaydet = true) {
  kayit = { ...kayit, ...yeni };
  dinleyiciler.forEach((f) => f());
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
  dinleyiciler.forEach((f) => f());
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
  for (const p of yeni) {
    if (acceptPoint(seg[seg.length - 1], p)) seg.push(p);
  }
  segments[segments.length - 1] = seg;
  degistir({ segments, sonKonum });
}

// Arka plan görevi modül yüklenirken tanımlanmalı (kök düzende içe aktarılır)
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(KONUM_GOREVI, async ({ data, error }) => {
    if (error || !data) return;
    await kaydiGeriYukle();
    noktalarEkle(data.locations);
  });
}

const IZLEME: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 3,
  activityType: Location.ActivityType.Fitness,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'Lykiva kaydediyor',
    notificationBody: 'Rotan, hızın ve molaların kaydediliyor.',
    notificationColor: '#B04E25',
    killServiceOnDestroy: false,
  },
};

async function onPlanIzle() {
  onPlanAboneligi?.remove();
  onPlanAboneligi = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 },
    (l) => noktalarEkle([l]),
  );
}

async function izlemeyiBaslat(): Promise<boolean> {
  let arkaPlan = false;
  if (Platform.OS !== 'web' && (await TaskManager.isAvailableAsync())) {
    const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    if (bg?.granted) {
      if (!(await Location.hasStartedLocationUpdatesAsync(KONUM_GOREVI).catch(() => false))) {
        await Location.startLocationUpdatesAsync(KONUM_GOREVI, IZLEME);
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

export async function baslat(activity: ActivityType) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new IzinHatasi('Konum izni verilmedi. Ayarlar > Lykiva > Konum bölümünden açabilirsin.');
  degistir({
    ...BOS,
    durum: 'kayitta',
    clientId: randomUUID(),
    activity,
    segments: [[]],
    baslangic: Date.now(),
    sonKonum: kayit.sonKonum,
  });
  const arkaPlan = await izlemeyiBaslat();
  degistir({ arkaPlan });
}

export async function duraklat() {
  if (kayit.durum !== 'kayitta') return;
  await izlemeyiDurdur();
  degistir({ durum: 'duraklatildi', duraklatmaBaslangic: Date.now() });
}

export async function devamEt() {
  if (kayit.durum !== 'duraklatildi') return;
  const son = kayit.segments[kayit.segments.length - 1];
  const segments = son && son.length === 0 ? kayit.segments : [...kayit.segments, []];
  const duraklamaToplam = kayit.duraklamaToplam + (kayit.duraklatmaBaslangic ? Date.now() - kayit.duraklatmaBaslangic : 0);
  degistir({ durum: 'kayitta', duraklatmaBaslangic: null, duraklamaToplam, segments });
  const arkaPlan = await izlemeyiBaslat();
  degistir({ arkaPlan });
}

/**
 * Kaydı bitirir, kuyruğa koyar ve göndermeyi dener.
 * Dönen değer gösterilecek aktivitenin adresi: sunucu id'si ya da "yerel-<client_id>".
 */
export async function bitir(title?: string): Promise<string | null> {
  await izlemeyiDurdur();
  const paket = paketOlustur({ clientId: kayit.clientId, activity: kayit.activity, segments: kayit.segments, title });
  const clientId = kayit.clientId;
  degistir({ ...BOS, sonKonum: kayit.sonKonum });
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
  degistir({ ...BOS, sonKonum: kayit.sonKonum });
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
