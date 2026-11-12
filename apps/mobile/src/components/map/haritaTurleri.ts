/**
 * Harita türleri: standart, uydu, hibrit, kış. Seçim telefonda saklanır ve bütün haritalara uygulanır.
 *
 * - standart: MAP_STYLE_URL (varsayılan OpenFreeMap Liberty).
 * - uydu: Esri World Imagery döşemeleri (anahtarsız).
 * - hibrit: uydu görüntüsü + standart stilin yolları, sınırları ve yazıları.
 * - kış: standart stil karlı renklerle + OpenSnowMap kayak pistleri / kızak, kar ayakkabısı yolları.
 * - gece (yalnızca koyu ekranlarda, ör. kayıt sırasında): standart yerine siyah zeminli OpenFreeMap Dark.
 *   Kullanıcı başka bir tür seçtiyse o kullanılır.
 *
 * Hibrit ve kış, standart stilin JSON'undan türetilir (bir kez indirilir). İnemezse (çevrimdışı) hibrit uyduya,
 * kış standarda düşer. Stil nesneleri önbellekte tutulur: her çizimde yeni nesne verilirse harita stili
 * baştan yükler.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-react-native';
import { useEffect, useSyncExternalStore } from 'react';

export type HaritaTuru = 'standart' | 'uydu' | 'hibrit' | 'kis';
export const HARITA_TURLERI: HaritaTuru[] = ['standart', 'uydu', 'hibrit', 'kis'];

export const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/** Koyu ekranlarda standart türün yerine (siyah zemin) */
export const GECE_STIL_URL = 'https://tiles.openfreemap.org/styles/dark';

const SECIM_ANAHTARI ='lykiva.harita_turu.v1';

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

let temel: StyleSpecification | null = null;
let temelIstegi: Promise<void> | null = null;
const onbellek = new Map<'hibrit' | 'kis', StyleSpecification>();

function temeliIndir() {
  if (temel || temelIstegi) return;
  temelIstegi = fetch(MAP_STYLE_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((s: StyleSpecification) => {
      temel = s;
      onbellek.clear();
      haberVer();
    })
    .catch(() => undefined)
    .finally(() => {
      temelIstegi = null;
    });
}

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

function stilOf(t: HaritaTuru): string | StyleSpecification {
  if (t === 'standart') return MAP_STYLE_URL;
  if (t === 'uydu') return UYDU_STILI;
  // Temel stil gelmeden: hibrit → yalnızca uydu, kış → standart
  if (!temel) return t === 'kis' ? MAP_STYLE_URL : UYDU_STILI;
  let s = onbellek.get(t);
  if (!s) {
    s = t === 'hibrit' ? hibritStili(temel) : kisStili(temel);
    onbellek.set(t, s);
  }
  return s;
}

/**
 * Seçili türün MapLibre stili (adres ya da stil nesnesi; aynı tür için hep aynı nesne).
 * karanlik: standart tür siyah zeminli gece stiliyle çizilir.
 */
export function useHaritaStili(karanlik = false): string | StyleSpecification {
  const t = useHaritaTuru();
  // Temel stil değişince yeniden çizilsin diye aynı depoya bağlı
  useSyncExternalStore(abone, () => temel, () => temel);
  useEffect(() => {
    if (t === 'hibrit' || t === 'kis') temeliIndir();
  }, [t]);
  if (karanlik && t === 'standart') return GECE_STIL_URL;
  return stilOf(t);
}
