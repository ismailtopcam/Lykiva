/**
 * Harita sekmesinde aramayla seçilen son yerler ("Son gittiklerin"); yalnızca telefonda saklanır, sunucuya gitmez.
 * Haritaya dokunarak seçilen adsız noktalar listeye girmez.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { LngLat } from '@/data/ornek';

export type SonHedef = { ad: string; ayrinti: string; c: LngLat };

const ANAHTAR = 'lykiva.son-hedefler.v1';
const EN_FAZLA = 5;

let liste: SonHedef[] = [];
let yuklendi = false;

const dinleyiciler = new Set<() => void>();

function gecerli(h: unknown): h is SonHedef {
  const x = h as Partial<SonHedef> | null;
  return !!x && typeof x.ad === 'string' && Array.isArray(x.c) && typeof x.c[0] === 'number' && typeof x.c[1] === 'number';
}

async function yukle() {
  if (yuklendi) return;
  yuklendi = true;
  try {
    const s = await AsyncStorage.getItem(ANAHTAR);
    if (!s) return;
    const j: unknown = JSON.parse(s);
    if (!Array.isArray(j)) return;
    liste = j.filter(gecerli).map((h) => ({ ad: h.ad, ayrinti: typeof h.ayrinti === 'string' ? h.ayrinti : '', c: [h.c[0], h.c[1]] as LngLat })).slice(0, EN_FAZLA);
    dinleyiciler.forEach((f) => f());
  } catch {
    // Bozuk kayıt: boş listeyle devam
  }
}

function abone(f: () => void) {
  dinleyiciler.add(f);
  void yukle();
  return () => {
    dinleyiciler.delete(f);
  };
}

/** En son seçilen başta; değişince bileşeni yeniden çizer */
export function useSonHedefler(): SonHedef[] {
  return useSyncExternalStore(abone, () => liste, () => liste);
}

/** Aynı yer (ad ve yaklaşık konum) yeniden seçilirse başa taşınır */
export function sonHedefEkle(h: SonHedef) {
  const ayni = (x: SonHedef) => x.ad === h.ad && Math.abs(x.c[0] - h.c[0]) < 1e-4 && Math.abs(x.c[1] - h.c[1]) < 1e-4;
  liste = [h, ...liste.filter((x) => !ayni(x))].slice(0, EN_FAZLA);
  dinleyiciler.forEach((f) => f());
  void AsyncStorage.setItem(ANAHTAR, JSON.stringify(liste)).catch(() => undefined);
}
