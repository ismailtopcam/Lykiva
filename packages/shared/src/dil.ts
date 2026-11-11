/**
 * Dil desteği çekirdeği: desteklenen diller, telefon / tarayıcı dilinden seçim, şablon doldurma, çoğul.
 *
 * Telefonda bütün uygulama tek dildedir: `aktifDiliAyarla` ile seçilir, ortak etiketler ve biçimlendiriciler
 * dil verilmezse onu kullanır. Web sunucusu aynı anda farklı dillerde istek karşıladığı için dili her çağrıda
 * açıkça verir.
 */

export const DILLER = ['tr', 'en', 'de', 'ru'] as const;
export type Dil = (typeof DILLER)[number];

/** Dil seçicide her dil kendi adıyla görünür */
export const DIL_ADLARI: Record<Dil, string> = { tr: 'Türkçe', en: 'English', de: 'Deutsch', ru: 'Русский' };

/** Intl (tarih, sayı) için yerel ayar */
export const YEREL_AYAR: Record<Dil, string> = { tr: 'tr-TR', en: 'en-GB', de: 'de-DE', ru: 'ru-RU' };

export const VARSAYILAN_DIL: Dil = 'tr';
/** Desteklenmeyen bir dildeki cihaz için */
export const YEDEK_DIL: Dil = 'en';

export function dilMi(x: unknown): x is Dil {
  return typeof x === 'string' && (DILLER as readonly string[]).includes(x);
}

/**
 * "de-AT", "en_US", "tr" → desteklenen dil. Liste verilirse (Accept-Language sırası) ilk desteklenen seçilir.
 * Hiçbiri desteklenmiyorsa İngilizce.
 */
export function dilSec(yerel: string | readonly (string | null | undefined)[] | null | undefined): Dil {
  const liste = Array.isArray(yerel) ? yerel : [yerel];
  for (const y of liste) {
    if (!y) continue;
    const kod = String(y).trim().toLowerCase().split(/[-_;,\s]/)[0];
    if (dilMi(kod)) return kod;
  }
  return YEDEK_DIL;
}

/** "tr-TR,tr;q=0.9,en;q=0.8" → ["tr-TR", "tr", "en"] (q sırasıyla) */
export function acceptLanguage(baslik: string | null | undefined): string[] {
  if (!baslik) return [];
  return baslik
    .split(',')
    .map((p, i) => {
      const [etiket, ...ek] = p.trim().split(';');
      const q = ek.map((e) => e.trim()).find((e) => e.startsWith('q='));
      return { etiket: etiket.trim(), q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((x) => x.etiket && x.etiket !== '*')
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.etiket);
}

/** Rusça çoğul biçimi: 0 → 1, 21, 31 …; 1 → 2–4, 22–24 …; 2 → 0, 5–20, 25 … (ondalık sayıda 1) */
export function slavCogul(n: number): 0 | 1 | 2 {
  if (!Number.isInteger(n)) return 1;
  const a = Math.abs(n);
  if (a % 10 === 1 && a % 100 !== 11) return 0;
  if (a % 10 >= 2 && a % 10 <= 4 && (a % 100 < 12 || a % 100 > 14)) return 1;
  return 2;
}

let aktif: Dil = VARSAYILAN_DIL;

/** Telefondaki uygulamanın o anki dili */
export function aktifDil(): Dil {
  return aktif;
}

/** Telefonda dil değişince bir kez çağrılır (web sunucusunda çağrılmaz) */
export function aktifDiliAyarla(d: Dil) {
  aktif = d;
}

/** Şablon değişkenleri; null / undefined / true / false boş yazılır (JSX'teki gibi) */
export type Degiskenler = Record<string, string | number | boolean | null | undefined>;

/**
 * Şablonu doldurur: "{n} kişi" + { n: 3 } → "3 kişi".
 * Çoğul: "{n} person|{n} people" — `n` (yoksa ilk sayı) 1 ise ilk biçim, değilse ikinci.
 * Üç biçim (Rusça): "{n} комментарий|{n} комментария|{n} комментариев" — 1, 2–4, 5+ (21, 22, 25 … kuralıyla).
 * Türkçede çoğul biçim yazılmaz (tek biçim).
 */
export function doldur(sablon: string, d?: Degiskenler): string {
  let s = sablon;
  if (s.includes('|')) {
    const sayi = d ? (typeof d.n === 'number' ? d.n : Object.values(d).find((v): v is number => typeof v === 'number')) : undefined;
    const bicimler = s.split('|');
    if (bicimler.length >= 3) s = bicimler[slavCogul(sayi ?? 0)];
    else s = sayi === 1 ? bicimler[0] : (bicimler[1] ?? bicimler[0]);
  }
  if (!d) return s;
  return s.replace(/\{(\w+)\}/g, (tam, ad: string) => {
    if (!(ad in d)) return tam;
    const v = d[ad];
    return v == null || typeof v === 'boolean' ? '' : String(v);
  });
}

/**
 * Anahtarı dile göre değişen etiket tablosu: `tablo[anahtar]` her okunuşta o anki dilden gelir.
 * Telefonda `ACTIVITY_LABELS[t]` gibi mevcut kullanım değişmeden çalışsın diye.
 */
export function dileGoreTablo<K extends string>(kaynak: Record<Dil, Record<K, string>>): Record<K, string> {
  const nesne = {} as Record<K, string>;
  for (const k of Object.keys(kaynak[VARSAYILAN_DIL]) as K[]) {
    Object.defineProperty(nesne, k, { enumerable: true, get: () => kaynak[aktif][k] ?? kaynak[VARSAYILAN_DIL][k] });
  }
  return nesne;
}
