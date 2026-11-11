/**
 * Uygulama dili: telefonun dili (Intl) ya da Ayarlar'da seçilen; seçim telefonda saklanır.
 *
 * Metinler `$t('alan.anahtar', { degisken })` ile okunur. Türkçe kaynak sözlük `tr.ts`; diğer diller aynı
 * biçimde (eksik ya da fazla anahtar TypeScript hatası verir). Çoğul: "{n} person|{n} people", Rusçada üç biçim
 * "{n} человек|{n} человека|{n} человек" (bkz. shared > dil.ts).
 *
 * Dil değişince kök düzen yeniden kurulur (_layout `key`), bütün ekranlar yeni dille çizilir. Bu yüzden
 * metinler modül düzeyinde (dosya açılırken) değil, kullanıldıkları anda okunmalı.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aktifDil, aktifDiliAyarla, DIL_ADLARI, dilMi, dilSec, DILLER, doldur, YEREL_AYAR, type Degiskenler, type Dil } from '@lykiva/shared';
import { useSyncExternalStore } from 'react';

import { de } from './de';
import { en } from './en';
import { ru } from './ru';
import { tr, type Sozluk } from './tr';

export type { Dil };
export { DIL_ADLARI, DILLER };

export type Anahtar = { [A in keyof Sozluk]: `${A & string}.${keyof Sozluk[A] & string}` }[keyof Sozluk];

const SOZLUKLER: Record<Dil, Sozluk> = { tr, en, de, ru };
const SECIM_ANAHTARI = 'lykiva.dil.v1';

/** Telefonun dili (desteklenmiyorsa İngilizce) */
export function cihazDili(): Dil {
  try {
    return dilSec(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'tr';
  }
}

/** Kullanıcının elle seçtiği dil; null = telefonun dili */
let secim: Dil | null = null;
aktifDiliAyarla(cihazDili());

const dinleyiciler = new Set<() => void>();
const haberVer = () => dinleyiciler.forEach((f) => f());

/** Uygulama açılırken bir kez: saklanan seçimi okur (kök düzen bitene kadar bekler) */
export async function dilYukle(): Promise<void> {
  try {
    const s = await AsyncStorage.getItem(SECIM_ANAHTARI);
    secim = dilMi(s) ? s : null;
  } catch {
    secim = null;
  }
  const d = secim ?? cihazDili();
  if (d !== aktifDil()) {
    aktifDiliAyarla(d);
    haberVer();
  }
}

/** Dili değiştirir (null: telefonun diline dön) */
export async function dilSecimiYap(d: Dil | null): Promise<void> {
  secim = d;
  if (d) await AsyncStorage.setItem(SECIM_ANAHTARI, d).catch(() => undefined);
  else await AsyncStorage.removeItem(SECIM_ANAHTARI).catch(() => undefined);
  aktifDiliAyarla(d ?? cihazDili());
  haberVer();
}

export function dilSecimi(): Dil | null {
  return secim;
}

/** O anki dil; değişince bileşeni yeniden çizer */
export function useDil(): Dil {
  return useSyncExternalStore(
    (f) => {
      dinleyiciler.add(f);
      return () => {
        dinleyiciler.delete(f);
      };
    },
    aktifDil,
    aktifDil,
  );
}

/** Dil değişince haber verir (ör. sunucudaki bildirim dilini güncellemek için) */
export function dilDegisikliginiDinle(f: () => void) {
  dinleyiciler.add(f);
  return () => {
    dinleyiciler.delete(f);
  };
}

/** Intl için yerel ayar: "tr-TR", "en-GB", "de-DE" */
export function yerel(): string {
  return YEREL_AYAR[aktifDil()];
}

/** Çeviri: "alan.anahtar" → o anki dildeki metin (yoksa Türkçe) */
export function $t(anahtar: Anahtar, d?: Degiskenler): string {
  const nokta = anahtar.indexOf('.');
  const alan = anahtar.slice(0, nokta) as keyof Sozluk;
  const ad = anahtar.slice(nokta + 1);
  const bul = (s: Sozluk) => (s[alan] as Record<string, string> | undefined)?.[ad];
  const metin = bul(SOZLUKLER[aktifDil()]) ?? bul(tr) ?? anahtar;
  return doldur(metin, d);
}
