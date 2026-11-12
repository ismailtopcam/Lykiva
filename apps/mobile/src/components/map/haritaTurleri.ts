/**
 * Harita türleri: standart, uydu, hibrit, kış. Seçim telefonda saklanır ve bütün haritalara uygulanır.
 *
 * - standart: MAP_STYLE_URL (varsayılan OpenFreeMap Liberty), patikalar belirgin (stilRenkleri.ts > acikStil).
 *   Karanlık temada aynı ayrıntıda gece haritası (stilRenkleri.ts > koyuStil).
 * - uydu: Esri World Imagery döşemeleri (anahtarsız).
 * - hibrit: uydu görüntüsü + standart stilin yolları, sınırları ve yazıları.
 * - kış: standart stil karlı renklerle + OpenSnowMap kayak pistleri / kızak, kar ayakkabısı yolları.
 *
 * Standart harita gündüz açık, gün batımından sonra ve karanlık temada koyu (bkz. gunduzGece.ts).
 * Uydu, hibrit ve kış hep aynıdır.
 *
 * Standart, gece, hibrit ve kış, standart stilin JSON'undan türetilir. JSON telefonda saklanır (açılışta hemen
 * hazır, çevrimdışında da çalışır) ve her açılışta bir kez sunucudan yenilenir. Hiç inmemişse standart
 * MAP_STYLE_URL'e, gece OpenFreeMap Dark'a, hibrit uyduya, kış standarda düşer. Stil nesneleri önbellekte
 * tutulur: her çizimde yeni nesne verilirse harita stili baştan yükler.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-react-native';
import { useSyncExternalStore } from 'react';

import { acikStil, koyuStil } from './stilRenkleri';

export type HaritaTuru = 'standart' | 'uydu' | 'hibrit' | 'kis';
export const HARITA_TURLERI: HaritaTuru[] = ['standart', 'uydu', 'hibrit', 'kis'];

export const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/** Standart stil henüz inmemişken karanlık temada (aynı döşemeler, daha az ayrıntı) */
export const GECE_STIL_URL = 'https://tiles.openfreemap.org/styles/dark';

const SECIM_ANAHTARI = 'lykiva.harita_turu.v1';
const TEMEL_ANAHTARI = 'lykiva.harita_temel_stil.v1';

// Kaynak metni Esri'nin hizmet bilgisinden (MapServer?f=json > copyrightText)
const UYDU_KAYNAK = {
  type: 'raster' as const,
  tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  tileSize: 256,
  maxzoom: 19,
  attribution: 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
};

const PIST_KAYNAK = {
  type: 'raster' as const,
  tiles: ['https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png'],
  tileSize: 256,
  maxzoom: 18,
  attribution: '© OpenSnowMap.org',
};

/** Uydu stilinde yazı tipi kaynağı (işaret numaraları "Noto Sans Bold" ister); diğerlerinde standart stilinki */
const VARSAYILAN_YAZI_TIPLERI = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

// ---- Seçim deposu ----

let secim: HaritaTuru = 'standart';
let yuklendi = false;
const dinleyiciler = new Set<() => void>();
const haberVer = () => dinleyiciler.forEach((f) => f());

function turMu(s: unknown): s is HaritaTuru {
  return typeof s === 'string' && (HARITA_TURLERI as string[]).includes(s);
}

function secimiYukle() {
  if (yuklendi) return;
  yuklendi = true;
  AsyncStorage.getItem(SECIM_ANAHTARI)
    .then((s) => {
      if (turMu(s) && s !== secim) {
        secim = s;
        haberVer();
      }
    })
    .catch(() => undefined);
}

export function haritaTuruSec(t: HaritaTuru) {
  yuklendi = true;
  secim = t;
  haberVer();
  void AsyncStorage.setItem(SECIM_ANAHTARI, t).catch(() => undefined);
}

function abone(f: () => void) {
  secimiYukle();
  dinleyiciler.add(f);
  return () => {
    dinleyiciler.delete(f);
  };
}

/** Seçili harita türü; değişince bileşeni yeniden çizer */
export function useHaritaTuru(): HaritaTuru {
  return useSyncExternalStore(abone, () => secim, () => secim);
}

// ---- Stiller ----

type Katman = LayerSpecification;

type Turetilen = 'standart' | 'gece' | 'hibrit' | 'kis';

let temel: StyleSpecification | null = null;
/** temel'in metni: sunucudan gelen aynıysa stil değiştirilmez (haritalar boşuna baştan yüklenmesin) */
let temelMetni: string | null = null;
let temelBasladi = false;
const onbellek = new Map<Turetilen, StyleSpecification>();

function temeliKoy(metin: string): boolean {
  if (metin === temelMetni) return false;
  try {
    const s = JSON.parse(metin) as StyleSpecification;
    if (s?.version !== 8 || !Array.isArray(s.layers)) return false;
    temel = s;
    temelMetni = metin;
    onbellek.clear();
    haberVer();
    return true;
  } catch {
    return false;
  }
}

/** Önce telefondaki kopya, ardından sunucudan güncel stil (açılışta bir kez) */
function temeliYukle() {
  if (temelBasladi) return;
  temelBasladi = true;
  AsyncStorage.getItem(TEMEL_ANAHTARI)
    .then((k) => {
      const kayit = k ? (JSON.parse(k) as { adres?: string; stil?: string }) : null;
      if (kayit && kayit.adres === MAP_STYLE_URL && kayit.stil) temeliKoy(kayit.stil);
    })
    .catch(() => undefined)
    .then(() => fetch(MAP_STYLE_URL))
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((metin) => {
      if (temeliKoy(metin)) {
        void AsyncStorage.setItem(TEMEL_ANAHTARI, JSON.stringify({ adres: MAP_STYLE_URL, stil: metin })).catch(() => undefined);
      }
    })
    .catch(() => undefined);
}

// Uygulama açılırken başlar: ilk harita çizildiğinde stil çoğunlukla hazır olur
temeliYukle();

/** Temel stile bağlı değil: hemen kullanılır ve hep aynı nesnedir */
const UYDU_STILI: StyleSpecification = {
  version: 8,
  glyphs: VARSAYILAN_YAZI_TIPLERI,
  sources: { uydu: UYDU_KAYNAK },
  layers: [{ id: 'uydu', type: 'raster', source: 'uydu' }],
};

function kaynakKatmani(k: Katman): string | undefined {
  return 'source-layer' in k ? (k['source-layer'] as string | undefined) : undefined;
}

/** Uydu görüntüsünün üstüne standart stilin yolları, sınırları ve yazıları */
function hibritStili(s: StyleSpecification): StyleSpecification {
  const ust: Katman[] = [];
  for (const k of s.layers) {
    const kk = kaynakKatmani(k);
    if (k.type === 'line' && (kk === 'transportation' || kk === 'boundary') && !k.id.startsWith('tunnel')) {
      ust.push({ ...k, paint: { ...k.paint, 'line-opacity': 0.75 } } as Katman);
    } else if (k.type === 'symbol') {
      const yazili = !!k.layout?.['text-field'] && !k.id.includes('shield');
      ust.push(
        yazili
          ? ({ ...k, paint: { ...k.paint, 'text-color': '#FFFFFF', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.3 } } as Katman)
          : k,
      );
    }
  }
  return {
    ...s,
    sources: { ...s.sources, uydu: UYDU_KAYNAK },
    layers: [{ id: 'uydu', type: 'raster', source: 'uydu' }, ...ust],
  };
}

const KAR = {
  zemin: '#F3F6F9',
  orman: '#D3DEDB',
  park: '#E2EAE8',
  buz: '#FFFFFF',
  diger: '#EAEFF3',
  su: '#B7D0E3',
};

/** Standart stil karlı renklerle; yazıların altına kayak pistleri */
function kisStili(s: StyleSpecification): StyleSpecification {
  const katmanlar: Katman[] = s.layers.map((k) => {
    const kk = kaynakKatmani(k);
    if (k.type === 'background') return { ...k, paint: { ...k.paint, 'background-color': KAR.zemin } };
    if (k.type !== 'fill') return k;
    let renk: string | null = null;
    if (kk === 'water') renk = KAR.su;
    else if (k.id.includes('wood') || k.id.includes('forest')) renk = KAR.orman;
    else if (kk === 'park') renk = KAR.park;
    else if (k.id.includes('ice') || k.id.includes('glacier')) renk = KAR.buz;
    else if (kk === 'landcover' || kk === 'landuse') renk = KAR.diger;
    return renk ? ({ ...k, paint: { ...k.paint, 'fill-color': renk } } as Katman) : k;
  });
  const ilkYazi = katmanlar.findIndex((k) => k.type === 'symbol');
  const pist: Katman = { id: 'kayak-pistleri', type: 'raster', source: 'pistler' };
  if (ilkYazi < 0) katmanlar.push(pist);
  else katmanlar.splice(ilkYazi, 0, pist);
  return { ...s, sources: { ...s.sources, pistler: PIST_KAYNAK }, layers: katmanlar };
}

const TURETICI: Record<Turetilen, (s: StyleSpecification) => StyleSpecification> = {
  standart: acikStil,
  gece: koyuStil,
  hibrit: hibritStili,
  kis: kisStili,
};

/** Temel stil gelmeden kullanılan */
const YEDEK: Record<Turetilen, string | StyleSpecification> = {
  standart: MAP_STYLE_URL,
  gece: GECE_STIL_URL,
  hibrit: UYDU_STILI,
  kis: MAP_STYLE_URL,
};

function stilOf(t: HaritaTuru, koyu: boolean): string | StyleSpecification {
  if (t === 'uydu') return UYDU_STILI;
  const tt: Turetilen = t === 'standart' && koyu ? 'gece' : t;
  if (!temel) return YEDEK[tt];
  let s = onbellek.get(tt);
  if (!s) {
    s = TURETICI[tt](temel);
    onbellek.set(tt, s);
  }
  return s;
}

/**
 * Seçili türün MapLibre stili (adres ya da stil nesnesi; aynı tür için hep aynı nesne).
 * koyu: gece ya da karanlık tema (useKoyuHarita); standart tür gece haritasıyla çizilir.
 * koyuZemin: harita koyu mu (rota çizgisi ve işaret renkleri buna göre); kış iki temada da açık.
 */
export function useHaritaStili(koyu: boolean): { stil: string | StyleSpecification; koyuZemin: boolean } {
  const t = useHaritaTuru();
  // Temel stil değişince yeniden çizilsin diye aynı depoya bağlı
  useSyncExternalStore(abone, () => temel, () => temel);
  return { stil: stilOf(t, koyu), koyuZemin: koyu && t !== 'kis' };
}
