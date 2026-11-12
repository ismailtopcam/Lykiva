/**
 * Harita açık mı koyu mu: gündüz açık, gün batımından gün doğumuna kadar koyu. Uygulama karanlık temadaysa
 * (telefonun ayarı ya da Ayarlar > Görünüm > Karanlık) gündüz de koyu.
 *
 * Gün doğumu / batımı telefonun son bilinen konumundan hesaplanır (konum izni zaten verilmişse; izin istenmez).
 * Konum yoksa yerel saatle 07:00–19:00 gündüz sayılır. Dakikada bir ve uygulama öne gelince yeniden bakılır;
 * gün batınca açık haritalar (kayıt sırasında da) koyuya geçer.
 */
import { gunesBatmisMi, saateGoreGeceMi } from '@lykiva/shared';
import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { aktifSema } from '@/theme';

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

function basla() {
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

/** Harita koyu çizilsin mi (karanlık tema ya da güneş batmış); gün batınca / doğunca bileşeni yeniden çizer */
export function useKoyuHarita(): boolean {
  const g = useSyncExternalStore(abone, () => gece, () => gece);
  // Tema değişince kök düzen yeniden kurulur; çizim sırasında okumak yeterli
  return aktifSema() === 'koyu' || g;
}
