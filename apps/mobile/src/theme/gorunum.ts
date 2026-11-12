/**
 * Görünüm seçimi: telefonun teması, aydınlık ya da karanlık; seçim telefonda saklanır (bkz. i18n, aynı düzen).
 *
 * Tema değişince kök düzen yeniden kurulur (_layout `key`). Telefonun teması kendiliğinden değişirse (akşam
 * otomatik karanlık mod vb.) yalnızca uygulama öndeyken ve kayıt sürmüyorken uygulanır; kayıt sırasında
 * ekranlar baştan kurulmasın diye bir sonraki öne gelişe kalır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Appearance, AppState } from 'react-native';

import { aktifSema, semaAyarla, type Sema } from './renkler';

export type GorunumSecimi = 'sistem' | 'acik' | 'koyu';
export const GORUNUMLER: GorunumSecimi[] = ['sistem', 'acik', 'koyu'];

const SECIM_ANAHTARI = 'lykiva.gorunum.v1';
let secim: GorunumSecimi = 'sistem';

const dinleyiciler = new Set<() => void>();
const haberVer = () => dinleyiciler.forEach((f) => f());

function secimMi(s: unknown): s is GorunumSecimi {
  return s === 'sistem' || s === 'acik' || s === 'koyu';
}

/** Telefonun teması (seçim "sistem" iken uygulama onu ezmez, doğrudan okunur) */
export function cihazSemasi(): Sema {
  return Appearance.getColorScheme() === 'dark' ? 'koyu' : 'acik';
}

function uygula() {
  // Uyarılar, klavye, tarih seçici gibi telefonun kendi parçaları da aynı temada görünsün
  if (typeof Appearance.setColorScheme === 'function') {
    Appearance.setColorScheme(secim === 'sistem' ? 'unspecified' : secim === 'koyu' ? 'dark' : 'light');
  }
  const s = secim === 'sistem' ? cihazSemasi() : secim;
  if (s !== aktifSema()) {
    semaAyarla(s);
    haberVer();
  }
}

/** Uygulama açılırken bir kez: saklanan seçimi okur (kök düzen bitene kadar bekler) */
export async function gorunumYukle(): Promise<void> {
  try {
    const s = await AsyncStorage.getItem(SECIM_ANAHTARI);
    secim = secimMi(s) ? s : 'sistem';
  } catch {
    secim = 'sistem';
  }
  uygula();
}

export async function gorunumSecimiYap(s: GorunumSecimi): Promise<void> {
  secim = s;
  if (s === 'sistem') await AsyncStorage.removeItem(SECIM_ANAHTARI).catch(() => undefined);
  else await AsyncStorage.setItem(SECIM_ANAHTARI, s).catch(() => undefined);
  uygula();
}

export function gorunumSecimi(): GorunumSecimi {
  return secim;
}

/**
 * Telefonun teması değişince uygular. `bekle()` true dönerse (kayıt sürüyor) şimdilik uygulamaz.
 * Arka plandayken gelen değişiklikler sayılmaz (iOS ekran görüntüsü alırken temayı bir an çevirir);
 * öne gelince doğrusu okunur.
 */
export function cihazSemasiniDinle(bekle: () => boolean): () => void {
  const dene = () => {
    if (secim === 'sistem' && AppState.currentState === 'active' && !bekle()) uygula();
  };
  const a = Appearance.addChangeListener(dene);
  const b = AppState.addEventListener('change', (d) => d === 'active' && dene());
  return () => {
    a.remove();
    b.remove();
  };
}

/** O anki tema; değişince bileşeni yeniden çizer */
export function useSema(): Sema {
  return useSyncExternalStore(
    (f) => {
      dinleyiciler.add(f);
      return () => {
        dinleyiciler.delete(f);
      };
    },
    aktifSema,
    aktifSema,
  );
}
