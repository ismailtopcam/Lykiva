/**
 * Isı haritaları: küresel, haftalık, gece, kişisel. Harita türünün (standart, uydu…) üstüne katman olarak çizilir.
 *
 * Veri sunucudan, haritada görünen alan için gelir (isi_haritasi, migration 20261114000000): ızgara hücreleri
 * [boylam, enlem, aktivite sayısı]. Küresel / haftalık / gece yalnızca herkese açık aktivitelerden ve 8. yakınlaştırma
 * düzeyinden sonra; kişisel kendi bütün aktivitelerinden. Seçim telefonda saklanır, bütün haritalara uygulanır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { supabase, supabaseHazir } from '@/lib/supabase';

export type IsiTuru = 'kuresel' | 'haftalik' | 'gece' | 'kisisel';
export const ISI_TURLERI: IsiTuru[] = ['kuresel', 'haftalik', 'gece', 'kisisel'];

/** Sunucu bu düzeyden önce küresel / haftalık / gece için boş döner */
export const ISI_EN_AZ_ZOOM = 8;

/** Isı katmanının renk basamakları (soğuktan sıcağa) */
export const ISI_RENKLERI: Record<IsiTuru, [string, string, string, string, string]> = {
  kuresel: ['#3A0D3F', '#8E1B53', '#E0403A', '#FF9B3D', '#FFF1A8'],
  haftalik: ['#0B2A5B', '#1565C0', '#26A6D1', '#7FE3F0', '#F2FFFF'],
  gece: ['#1A1446', '#4B2BA0', '#8E4FE0', '#D08CFF', '#FFFFFF'],
  kisisel: ['#5A1E0B', '#B04E25', '#E07A4A', '#F5B184', '#FFF3E6'],
};

const SECIM_ANAHTARI = 'lykiva.isi_haritasi.v1';

// ---- Seçim deposu ----

let secim: IsiTuru | null = null;
let yuklendi = false;
const dinleyiciler = new Set<() => void>();
const haberVer = () => dinleyiciler.forEach((f) => f());

function turMu(s: unknown): s is IsiTuru {
  return typeof s === 'string' && (ISI_TURLERI as string[]).includes(s);
}

function abone(f: () => void) {
  if (!yuklendi) {
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
  dinleyiciler.add(f);
  return () => {
    dinleyiciler.delete(f);
  };
}

/** Seçili ısı haritası; null = kapalı */
export function useIsiTuru(): IsiTuru | null {
  return useSyncExternalStore(abone, () => secim, () => secim);
}

export function isiTuruSec(t: IsiTuru | null) {
  yuklendi = true;
  secim = t;
  haberVer();
  if (t) void AsyncStorage.setItem(SECIM_ANAHTARI, t).catch(() => undefined);
  else void AsyncStorage.removeItem(SECIM_ANAHTARI).catch(() => undefined);
}

// ---- Veri ----

export type Gorunum = { bounds: [number, number, number, number]; zoom: number };

type Hucre = [number, number, number];
type Nokta = { type: 'Feature'; properties: { w: number }; geometry: { type: 'Point'; coordinates: [number, number] } };
export type IsiVerisi = { type: 'FeatureCollection'; features: Nokta[] };

const onbellek = new Map<string, IsiVerisi>();
const ONBELLEK_EN_FAZLA = 40;

/** Görünen alanı biraz genişletip yuvarlar: küçük kaydırmalarda aynı istek (ve önbellek) kullanılır */
function istekKutusu(g: Gorunum): { kutu: [number, number, number, number]; zoom: number; anahtar: string } {
  const zoom = Math.max(0, Math.min(18, Math.floor(g.zoom)));
  const [b, gu, d, k] = g.bounds;
  const adim = Math.max(360 / Math.pow(2, zoom) / 4, 0.0005);
  const kutu: [number, number, number, number] = [
    Math.max(-180, Math.floor(b / adim - 1) * adim),
    Math.max(-85, Math.floor(gu / adim - 1) * adim),
    Math.min(180, Math.ceil(d / adim + 1) * adim),
    Math.min(85, Math.ceil(k / adim + 1) * adim),
  ];
  return { kutu, zoom, anahtar: `${zoom}|${kutu.map((x) => x.toFixed(4)).join(',')}` };
}

function geoJson(h: Hucre[]): IsiVerisi {
  const enCok = h.reduce((m, x) => Math.max(m, x[2]), 1);
  const l = Math.log(1 + enCok);
  return {
    type: 'FeatureCollection',
    features: h.map(([lng, lat, c]) => ({
      type: 'Feature',
      properties: { w: Math.max(0.15, Math.log(1 + c) / l) },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })),
  };
}

const BOS: IsiVerisi = { type: 'FeatureCollection', features: [] };

/** Seçili ısı haritasının görünen alandaki verisi (harita durunca, kısa bir beklemeden sonra istenir) */
export function useIsiVerisi(tur: IsiTuru | null, gorunum: Gorunum | null): IsiVerisi | null {
  // Son gelen veri; kaydırırken yenisi gelene kadar aynı türün eski verisi görünür
  const [son, setSon] = useState<{ tur: IsiTuru; anahtar: string; veri: IsiVerisi } | null>(null);

  const etkin = !!tur && !!gorunum && supabaseHazir;
  const uzak = etkin && tur !== 'kisisel' && gorunum.zoom < ISI_EN_AZ_ZOOM;
  const istek = etkin && !uzak ? istekKutusu(gorunum) : null;
  const tam = istek ? `${tur}|${istek.anahtar}` : null;
  const hazir = tam ? onbellek.get(tam) : undefined;

  useEffect(() => {
    if (!tur || !istek || !tam || onbellek.has(tam)) return;
    let iptal = false;
    const zamanlayici = setTimeout(async () => {
      const { data: oturum } = await supabase.auth.getSession();
      if (!oturum.session || iptal) return;
      const { data, error } = await supabase.rpc('isi_haritasi', {
        tur,
        bati: istek.kutu[0],
        guney: istek.kutu[1],
        dogu: istek.kutu[2],
        kuzey: istek.kutu[3],
        zoom: istek.zoom,
      });
      if (error || iptal) return;
      const v = geoJson((data as Hucre[] | null) ?? []);
      if (onbellek.size >= ONBELLEK_EN_FAZLA) onbellek.delete(onbellek.keys().next().value as string);
      onbellek.set(tam, v);
      setSon({ tur, anahtar: tam, veri: v });
    }, 350);
    return () => {
      iptal = true;
      clearTimeout(zamanlayici);
    };
    // istek nesnesi her çizimde yeni; değişikliği tam anahtarı belirler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tur, tam]);

  if (!etkin) return null;
  if (uzak) return BOS;
  if (hazir) return hazir;
  return son && son.tur === tur ? son.veri : null;
}

/** Kişisel ısı haritası yeni bir aktiviteden sonra tazelensin diye (kayıt kaydedilince çağrılabilir) */
export function isiOnbelleginiTemizle() {
  onbellek.clear();
}
