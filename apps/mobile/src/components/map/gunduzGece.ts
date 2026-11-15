/**
 * Harita açık mı koyu mu. Kullanıcı katman penceresinden seçer (telefonda saklanır, bütün haritalara uygulanır):
 * - "Sistemle aynı" (varsayılan): gündüz açık, gün batımından gün doğumuna kadar koyu. Uygulama karanlık temadaysa
 *   (telefonun ayarı ya da Ayarlar > Görünüm > Karanlık) gündüz de koyu.
 * - "Açık" / "Karanlık": saatten ve temadan bağımsız hep öyle.
 * Yalnızca standart harita türünü etkiler (uydu ve hibrit fotoğraf, kış hep açık; bkz. haritaTurleri.ts).
 *
 * Gün doğumu / batımı telefonun son bilinen konumundan hesaplanır (konum izni zaten verilmişse; izin istenmez).
 * Konum yoksa yerel saatle 07:00–19:00 gündüz sayılır. Dakikada bir ve uygulama öne gelince yeniden bakılır;
 * gün batınca açık haritalar (kayıt sırasında da) koyuya geçer.
 */
import { gunesBatmisMi, saateGoreGeceMi } from '@lykiva/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { aktifSema } from '@/theme';

export type HaritaGorunumu = 'sistem' | 'acik' | 'koyu';
export const HARITA_GORUNUMLERI: HaritaGorunumu[] = ['sistem', 'acik', 'koyu'];
const GORUNUM_ANAHTARI = 'lykiva.harita_gorunum.v1';
let gorunum: HaritaGorunumu = 'sistem';
let gorunumYuklendi = false;

let konum: [number, number] | null = null;
let gece = hesapla();
let basladi = false;
const dinleyiciler = new Set<() => void>();

function hesapla(): boolean {
  const simdi = new Date();
  return konum ? gunesBatmisMi(simdi, konum[0], konum[1]) : saateGoreGeceMi(simdi);
}

function denetle() {
  const g = hesapla();
  if (g === gece) return;
  gece = g;
  dinleyiciler.forEach((f) => f());
}

async function konumuYenile() {
  try {
    const izin = await Location.getForegroundPermissionsAsync();
    if (izin.status !== 'granted') return;
    // Gün batımı için birkaç km'lik, birkaç saatlik konum yeter
    const son = await Location.getLastKnownPositionAsync({ maxAge: 12 * 3_600_000 });
    if (son) konum = [son.coords.longitude, son.coords.latitude];
  } catch {
    // konum yoksa saate göre
  }
  denetle();
}

function gorunumMu(s: unknown): s is HaritaGorunumu {
  return s === 'sistem' || s === 'acik' || s === 'koyu';
}

function basla() {
  if (!gorunumYuklendi) {
    gorunumYuklendi = true;
    AsyncStorage.getItem(GORUNUM_ANAHTARI)
      .then((s) => {
        if (gorunumMu(s) && s !== gorunum) {
          gorunum = s;
          dinleyiciler.forEach((f) => f());
        }
      })
      .catch(() => undefined);
  }
  if (basladi) return;
  basladi = true;
  void konumuYenile();
  setInterval(denetle, 60_000);
  AppState.addEventListener('change', (d) => {
    if (d === 'active') void konumuYenile();
  });
}

function abone(f: () => void) {
  basla();
  dinleyiciler.add(f);
  return () => {
    dinleyiciler.delete(f);
  };
}

/** Katman penceresindeki seçim; bütün haritalar yeniden çizilir */
export function haritaGorunumuSec(g: HaritaGorunumu) {
  gorunumYuklendi = true;
  gorunum = g;
  dinleyiciler.forEach((f) => f());
  if (g === 'sistem') void AsyncStorage.removeItem(GORUNUM_ANAHTARI).catch(() => undefined);
  else void AsyncStorage.setItem(GORUNUM_ANAHTARI, g).catch(() => undefined);
}

export function useHaritaGorunumu(): HaritaGorunumu {
  return useSyncExternalStore(abone, () => gorunum, () => gorunum);
}

/**
 * Harita koyu çizilsin mi: seçim "Açık" / "Karanlık" ise o; "Sistemle aynı" ise karanlık tema ya da güneş batmış.
 * Gün batınca / doğunca ve seçim değişince bileşeni yeniden çizer
 */
export function useKoyuHarita(): boolean {
  const g = useSyncExternalStore(abone, () => gece, () => gece);
  const secim = useHaritaGorunumu();
  if (secim !== 'sistem') return secim === 'koyu';
  // Tema değişince kök düzen yeniden kurulur; çizim sırasında okumak yeterli
  return aktifSema() === 'koyu' || g;
}
