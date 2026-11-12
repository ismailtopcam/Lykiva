/**
 * Temaya göre değişen renkler (Ayarlar > Görünüm).
 *
 * `colors.ink` gibi okumalar o anki temanın değerini verir; tema değişince kök düzen yeniden kurulur
 * (_layout `key`), bütün ekranlar yeni renklerle çizilir. Bu yüzden renkler modül düzeyinde (dosya açılırken)
 * bir değişkene kopyalanmamalı; dosya düzeyindeki stiller `temaliStil(() => StyleSheet.create({...}))` ile yazılır.
 */
import { colors as acikRenkler, colorsDark, type Renkler } from '@lykiva/shared';

export type Sema = 'acik' | 'koyu';

let aktif: Sema = 'acik';

export function aktifSema(): Sema {
  return aktif;
}

/** Yalnızca gorunum.ts çağırır (ardından kök düzen yeniden kurulmalı) */
export function semaAyarla(s: Sema) {
  aktif = s;
}

function palet(): Renkler {
  return aktif === 'koyu' ? colorsDark : acikRenkler;
}

export const colors = {} as Renkler;
for (const ad of Object.keys(acikRenkler) as (keyof Renkler)[]) {
  Object.defineProperty(colors, ad, { enumerable: true, get: () => palet()[ad] });
}

/**
 * Dosya düzeyindeki stil nesnesi: her tema için bir kez kurulur, okunduğu anda o anki temanınkini verir.
 * `const styles = temaliStil(() => StyleSheet.create({ kart: { backgroundColor: colors.surface } }))`
 */
export function temaliStil<T extends object>(kur: () => T): T {
  const onbellek: Partial<Record<Sema, T>> = {};
  const al = (): T => (onbellek[aktif] ??= kur());
  return new Proxy({} as T, {
    get: (_, ad) => Reflect.get(al(), ad),
    has: (_, ad) => Reflect.has(al(), ad),
    ownKeys: () => Reflect.ownKeys(al()),
    getOwnPropertyDescriptor: (_, ad) => {
      const d = Reflect.getOwnPropertyDescriptor(al(), ad);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}
