/**
 * Tarihi yürüyüş yolları: Likya, Karia, Frig, Hitit, Evliya Çelebi, Aziz Paul, Sultanlar ve Efeler yolu.
 * Haritanın katman penceresinden açılır; açıksa bütün haritalarda kesikli renkli çizgi + adıyla çizilir.
 *
 * Çizgiler OpenStreetMap'teki yürüyüş rotası ilişkilerinden (route=hiking) `scripts/tarihi-yollar.mjs` ile
 * çıkarılıp sadeleştirildi ve uygulamaya gömüldü (`tarihiYollar.json`; internet gerekmez). Veriyi yenilemek
 * için betiği yeniden çalıştır. Veri © OpenStreetMap katkıcıları, ODbL.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { $t, yerel } from '@/i18n';

export type TarihiYolId = 'likya' | 'karia' | 'frig' | 'hitit' | 'evliya' | 'paul' | 'sultanlar' | 'efeler';

export const TARIHI_YOLLAR: TarihiYolId[] = ['likya', 'karia', 'frig', 'hitit', 'evliya', 'paul', 'sultanlar', 'efeler'];

/** Çizgi renkleri: rota moru ve ısı haritasından ayrı, açık / koyu / uydu zeminde seçilir */
export const TARIHI_YOL_RENGI: Record<TarihiYolId, string> = {
  likya: '#E03131',
  karia: '#1098AD',
  frig: '#5C940D',
  hitit: '#A0522D',
  evliya: '#1C7ED6',
  paul: '#F59F00',
  sultanlar: '#C2255C',
  efeler: '#E8590C',
};

export function tarihiYolAdi(id: TarihiYolId): string {
  switch (id) {
    case 'likya':
      return $t('tarihiYollar.likya');
    case 'karia':
      return $t('tarihiYollar.karia');
    case 'frig':
      return $t('tarihiYollar.frig');
    case 'hitit':
      return $t('tarihiYollar.hitit');
    case 'evliya':
      return $t('tarihiYollar.evliya');
    case 'paul':
      return $t('tarihiYollar.paul');
    case 'sultanlar':
      return $t('tarihiYollar.sultanlar');
    case 'efeler':
      return $t('tarihiYollar.efeler');
  }
}

const SECIM_ANAHTARI = 'lykiva.tarihi_yollar.v1';

// ---- Seçim deposu (açık / kapalı) ----

let acik = false;
let yuklendi = false;
const dinleyiciler = new Set<() => void>();
const haberVer = () => dinleyiciler.forEach((f) => f());

function abone(f: () => void) {
  if (!yuklendi) {
    yuklendi = true;
    AsyncStorage.getItem(SECIM_ANAHTARI)
      .then((s) => {
        if (s === '1' && !acik) {
          acik = true;
          haberVer();
        }
      })
      .catch(() => undefined);
  }
  dinleyiciler.add(f);
  return () => {
    dinleyiciler.delete(f);
  };
}

/** Tarihi yollar haritada görünsün mü */
export function useTarihiYollar(): boolean {
  return useSyncExternalStore(abone, () => acik, () => acik);
}

export function tarihiYollariSec(a: boolean) {
  yuklendi = true;
  acik = a;
  haberVer();
  if (a) void AsyncStorage.setItem(SECIM_ANAHTARI, '1').catch(() => undefined);
  else void AsyncStorage.removeItem(SECIM_ANAHTARI).catch(() => undefined);
}

// ---- Veri ----

/** tarihiYollar.json: her yol için OSM ilişkileri, uzunluk ve Google polyline (5 basamak) ile kodlanmış parçalar */
type HamVeri = { tarih: string; yollar: { id: TarihiYolId; osm: number[]; km: number; parcalar: string[] }[] };

type Ozellik = { id: TarihiYolId; ad: string; renk: string };
type Cizgi = { type: 'Feature'; properties: Ozellik; geometry: { type: 'LineString'; coordinates: [number, number][] } };
type Nokta = { type: 'Feature'; properties: Ozellik; geometry: { type: 'Point'; coordinates: [number, number] } };
export type TarihiYolCizgileri = { type: 'FeatureCollection'; features: Cizgi[] };
export type TarihiYolYazilari = { type: 'FeatureCollection'; features: Nokta[] };

/** Google polyline çözümü: [boylam, enlem] dizisi */
export function polylineCoz(s: string): [number, number][] {
  const cikti: [number, number][] = [];
  let i = 0;
  let enlem = 0;
  let boylam = 0;
  const sayi = () => {
    let sonuc = 0;
    let kaydir = 0;
    let b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      sonuc |= (b & 0x1f) << kaydir;
      kaydir += 5;
    } while (b >= 0x20);
    return sonuc & 1 ? ~(sonuc >> 1) : sonuc >> 1;
  };
  while (i < s.length) {
    enlem += sayi();
    boylam += sayi();
    cikti.push([boylam / 1e5, enlem / 1e5]);
  }
  return cikti;
}

let ham: HamVeri | null = null;
function hamVeri(): HamVeri {
  // Büyük dosya: yalnızca katman ilk açıldığında yüklenir
  ham ??= require('./tarihiYollar.json') as HamVeri;
  return ham;
}

/** İki nokta arası, km */
function km(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180;
  const dEnlem = (b[1] - a[1]) * r;
  const dBoylam = (b[0] - a[0]) * r;
  const h = Math.sin(dEnlem / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dBoylam / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Ad etiketleri arası, km (kısa parçada ortasına bir tane) */
const YAZI_ARALIGI_KM = 25;

/**
 * Adın yazılacağı noktalar: parça boyunca her YAZI_ARALIGI_KM'de bir. Ad çizgi boyunca (symbol-placement: line)
 * yazılmıyor: patikalar çok kıvrımlı olduğundan MapLibre harfler arası açı sınırı yüzünden çoğu yere yazamıyor
 * (tarayıcıda denendi). Üst üste binen etiketleri harita kendisi gizler.
 */
function yaziNoktalari(c: [number, number][]): [number, number][] {
  let toplam = 0;
  for (let i = 1; i < c.length; i++) toplam += km(c[i - 1], c[i]);
  if (toplam < 2) return [];
  const hedefler: number[] = [];
  if (toplam < YAZI_ARALIGI_KM) hedefler.push(toplam / 2);
  else for (let d = YAZI_ARALIGI_KM / 2; d < toplam; d += YAZI_ARALIGI_KM) hedefler.push(d);
  const cikti: [number, number][] = [];
  let gecilen = 0;
  let j = 0;
  for (let i = 1; i < c.length && j < hedefler.length; i++) {
    const l = km(c[i - 1], c[i]);
    while (j < hedefler.length && gecilen + l >= hedefler[j]) {
      const t = l ? (hedefler[j] - gecilen) / l : 0;
      cikti.push([c[i - 1][0] + t * (c[i][0] - c[i - 1][0]), c[i - 1][1] + t * (c[i][1] - c[i - 1][1])]);
      j++;
    }
    gecilen += l;
  }
  return cikti;
}

let veri: { dil: string; cizgiler: TarihiYolCizgileri; yazilar: TarihiYolYazilari } | null = null;

/**
 * Haritada çizilecek GeoJSON: cizgiler (kesikli çizgi) ve yazilar (ad etiketlerinin noktaları). Adlar uygulamanın
 * diline göre; aynı dil için hep aynı nesneler (her çizimde yeni nesne verilirse kaynak baştan yüklenir).
 */
export function tarihiYolVerisi(): { cizgiler: TarihiYolCizgileri; yazilar: TarihiYolYazilari } {
  const dil = yerel();
  if (veri?.dil === dil) return veri;
  const cizgiler: Cizgi[] = [];
  const yazilar: Nokta[] = [];
  for (const y of hamVeri().yollar) {
    const properties = { id: y.id, ad: tarihiYolAdi(y.id), renk: TARIHI_YOL_RENGI[y.id] };
    for (const p of y.parcalar) {
      const coordinates = polylineCoz(p);
      if (coordinates.length < 2) continue;
      cizgiler.push({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates } });
      for (const n of yaziNoktalari(coordinates)) yazilar.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: n } });
    }
  }
  veri = {
    dil,
    cizgiler: { type: 'FeatureCollection', features: cizgiler },
    yazilar: { type: 'FeatureCollection', features: yazilar },
  };
  return veri;
}
