/**
 * Harita sekmesinde aramayla seçilen son yerler ("Son gittiklerin"); yalnızca telefonda saklanır, sunucuya gitmez.
 * Haritaya dokunarak seçilen adsız noktalar listeye girmez. Tek tek ya da hepsi birden silinebilir.
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

/** Aynı yer: ad ve yaklaşık konum */
function ayniYer(a: SonHedef, b: SonHedef) {
  return a.ad === b.ad && Math.abs(a.c[0] - b.c[0]) < 1e-4 && Math.abs(a.c[1] - b.c[1]) < 1e-4;
}

function kaydet(yeni: SonHedef[]) {
  // Okuma bitmeden yazılırsa sonradan gelen eski liste bunu ezmesin
  yuklendi = true;
  liste = yeni;
  dinleyiciler.forEach((f) => f());
  if (liste.length) void AsyncStorage.setItem(ANAHTAR, JSON.stringify(liste)).catch(() => undefined);
  else void AsyncStorage.removeItem(ANAHTAR).catch(() => undefined);
}

/** Aynı yer yeniden seçilirse başa taşınır */
export function sonHedefEkle(h: SonHedef) {
  kaydet([h, ...liste.filter((x) => !ayniYer(x, h))].slice(0, EN_FAZLA));
}

/** Bir yeri listeden kaldırır */
export function sonHedefSil(h: SonHedef) {
  kaydet(liste.filter((x) => !ayniYer(x, h)));
}

/** Bütün listeyi siler */
export function sonHedefleriTemizle() {
  kaydet([]);
}
