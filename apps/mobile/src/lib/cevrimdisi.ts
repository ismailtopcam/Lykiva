/**
 * Çevrimdışı harita: bir rotanın çevresindeki harita karelerini ve rotanın kendisini telefona indirir.
 * İnternet yokken MapLibre indirilen kareleri kendiliğinden kullanır (aynı stil adresi); rota da
 * telefondaki kopyasından açılır (`data/rota.ts` > rotaGetir).
 *
 * Plan (kutular, kare sayısı) @lykiva/shared > cevrimdisi.ts'te. Paketler sırayla indirilir.
 * OpenFreeMap kuralları için bkz. DEV_NOTES > Kararlar.
 *
 * Yalnızca gerçek haritada (telefon derlemesi) çalışır; Expo Go ve web'de MapLibre'nin yerel modülü yok.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OFFLINE_MAX_TILE_BYTES, offlinePlan, type OfflinePlan } from '@lykiva/shared';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

import { gercekHarita, MAP_STYLE_URL } from '@/components/map/TopoMap';
import type { Rota } from '@/data/rota';

type ML = typeof import('@maplibre/maplibre-react-native');
// Yerel modül yalnızca gerçek haritada yüklenir
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ml = (): ML => require('@maplibre/maplibre-react-native') as ML;

export const cevrimdisiDestekleniyor = gercekHarita;

const DIZIN_ANAHTARI = 'lykiva.cevrimdisi.v1';
const rotaAnahtari = (id: string) => `lykiva.cevrimdisi.rota.${id}`;
/** Telefonda toplam kare sınırı (tüm rotalar); tek indirme bütçesi shared > OFFLINE_TILE_BUDGET */
const TOPLAM_KARE_SINIRI = 50_000;

export type IndirilenRota = {
  rotaId: string;
  ad: string;
  paketler: string[];
  /** İndirilen kaynakların toplam boyutu (bayt) */
  bayt: number;
  kare: number;
  tarih: number;
};

export type CevrimdisiDurum =
  | { durum: 'yok' }
  | { durum: 'iniyor'; yuzde: number }
  | { durum: 'hazir'; kayit: IndirilenRota }
  | { durum: 'hata'; mesaj: string };

// --- Durum deposu (bileşenler useCevrimdisi ile dinler) ---

let dizin: Record<string, IndirilenRota> = {};
const inenler: Record<string, number> = {};
const hatalar: Record<string, string> = {};
const iptaller = new Set<string>();
let yuklendi: Promise<void> | null = null;
const dinleyiciler = new Set<() => void>();
const haberVer = () => dinleyiciler.forEach((f) => f());

function yukle(): Promise<void> {
  yuklendi ??= AsyncStorage.getItem(DIZIN_ANAHTARI)
    .then((s) => {
      dizin = s ? (JSON.parse(s) as Record<string, IndirilenRota>) : {};
    })
    .catch(() => {
      dizin = {};
    })
    .then(haberVer);
  return yuklendi;
}

async function dizinYaz() {
  await AsyncStorage.setItem(DIZIN_ANAHTARI, JSON.stringify(dizin));
  haberVer();
}

export function rotaDurumu(rotaId: string): CevrimdisiDurum {
  if (rotaId in inenler) return { durum: 'iniyor', yuzde: inenler[rotaId] };
  if (hatalar[rotaId]) return { durum: 'hata', mesaj: hatalar[rotaId] };
  const k = dizin[rotaId];
  return k ? { durum: 'hazir', kayit: k } : { durum: 'yok' };
}

/** Bir rotanın çevrimdışı durumu (rotaId yoksa 'yok') */
export function useCevrimdisiRota(rotaId: string | undefined): CevrimdisiDurum {
  const [, yenile] = useState(0);
  useEffect(() => {
    const f = () => yenile((x) => x + 1);
    dinleyiciler.add(f);
    void yukle();
    return () => {
      dinleyiciler.delete(f);
    };
  }, []);
  return rotaId ? rotaDurumu(rotaId) : { durum: 'yok' };
}

/** İndirilmiş bütün rotalar (yeniden eskiye) */
export function useIndirilenRotalar(): IndirilenRota[] {
  const [, yenile] = useState(0);
  useEffect(() => {
    const f = () => yenile((x) => x + 1);
    dinleyiciler.add(f);
    void yukle();
    return () => {
      dinleyiciler.delete(f);
    };
  }, []);
  return Object.values(dizin).sort((a, b) => b.tarih - a.tarih);
}

// --- Harita istekleri ---

let ayarlandi = false;
/**
 * Harita isteklerini ayarlar: OpenFreeMap uygulamayı tanıtan bir User-Agent istiyor; telefondaki toplam kare sınırı.
 * Uygulama açılırken bir kez çağrılır (_layout); birden çok çağrı zararsız.
 */
export function haritaIstekleriniAyarla() {
  if (!gercekHarita || ayarlandi) return;
  ayarlandi = true;
  try {
    const { TransformRequestManager, OfflineManager } = ml();
    const surum = Constants.expoConfig?.version ?? '0';
    TransformRequestManager.addHeader({ id: 'lykiva-ua', name: 'User-Agent', value: `Lykiva/${surum} (+https://lykiva.app)`, match: 'openfreemap\\.org' });
    OfflineManager.setTileCountLimit(TOPLAM_KARE_SINIRI);
  } catch {
    // Yerel modül beklenmedik biçimde yoksa harita yine çalışır; yalnızca çevrimdışı indirme olmaz
    ayarlandi = false;
  }
}

// --- İndirme ---

class Iptal extends Error {}

/** Bir rotanın planı (kare sayısı, bütçeye sığıyor mu) — indirmeden önce göstermek için */
export function rotaPlani(rota: Rota): OfflinePlan {
  return offlinePlan(rota.points);
}

/**
 * Rotanın çevresini ve rotanın kendisini indirir. Paketler sırayla iner; ilerleme useCevrimdisiRota ile izlenir.
 * Hata ya da iptalde o ana kadar inen paketler silinir.
 */
export async function rotayiIndir(rota: Rota): Promise<void> {
  if (!gercekHarita) throw new Error('Çevrimdışı harita için uygulamanın telefon derlemesi gerekir.');
  if (rota.id in inenler) return;
  await yukle();
  const plan = rotaPlani(rota);
  if (!plan.boxes.length) throw new Error('Rotada nokta yok.');
  if (!plan.fits) throw new Error('Rota çevrimdışı indirme için çok uzun; daha kısa parçalara bölüp kaydet.');
  haritaIstekleriniAyarla();

  const { OfflineManager } = ml();
  delete hatalar[rota.id];
  iptaller.delete(rota.id);
  inenler[rota.id] = 0;
  haberVer();

  // Eskiden kalan paketler varsa önce sil (yeniden indirme)
  if (dizin[rota.id]) {
    await paketleriSil(dizin[rota.id].paketler);
    delete dizin[rota.id];
    await dizinYaz();
  }

  const paketler: string[] = [];
  let bayt = 0;
  let kareBayt = 0;
  const n = plan.boxes.length;
  try {
    for (let i = 0; i < n; i++) {
      if (iptaller.has(rota.id)) throw new Iptal();
      const sonuc = await new Promise<{ id: string; bayt: number; kareBayt: number }>((resolve, reject) => {
        let bitti = false;
        let paketId: string | null = null;
        const bitir = (hata: Error | null, v?: { id: string; bayt: number; kareBayt: number }) => {
          if (bitti) return;
          bitti = true;
          if (paketId) OfflineManager.removeListener(paketId);
          if (hata || !v) reject(hata ?? new Error('Harita indirilemedi'));
          else resolve(v);
        };
        OfflineManager.createPack(
          {
            mapStyle: MAP_STYLE_URL,
            bounds: plan.boxes[i],
            minZoom: plan.minZoom,
            maxZoom: plan.maxZoom,
            metadata: { lykiva: 'rota', rotaId: rota.id, parca: i, toplam: n },
          },
          (pack, s) => {
            paketId = pack.id;
            if (!paketler.includes(pack.id)) paketler.push(pack.id);
            inenler[rota.id] = Math.min(99, Math.round(((i + s.percentage / 100) / n) * 100));
            haberVer();
            if (iptaller.has(rota.id)) {
              void pack.pause().catch(() => undefined);
              bitir(new Iptal());
            } else if (kareBayt + s.completedTileSize > OFFLINE_MAX_TILE_BYTES) {
              void pack.pause().catch(() => undefined);
              bitir(new Error('İndirme 50 MB sınırını aşıyor; rotayı daha kısa parçalara böl.'));
            } else if (s.state === 'complete') {
              bitir(null, { id: pack.id, bayt: s.completedResourceSize, kareBayt: s.completedTileSize });
            }
          },
          (_pack, e) => bitir(new Error(e.message || 'Harita indirilemedi')),
        )
          .then(async (pack) => {
            paketId = pack.id;
            if (!paketler.includes(pack.id)) paketler.push(pack.id);
            // Her şey önceden indirilmişse ilerleme olayı gelmeyebilir: durumu bir kez sor
            const s = await pack.status().catch(() => null);
            if (s?.state === 'complete') bitir(null, { id: pack.id, bayt: s.completedResourceSize, kareBayt: s.completedTileSize });
          })
          .catch((e: unknown) => bitir(e instanceof Error ? e : new Error('Harita indirilemedi')));
      });
      bayt += sonuc.bayt;
      kareBayt += sonuc.kareBayt;
    }

    await AsyncStorage.setItem(rotaAnahtari(rota.id), JSON.stringify(rota));
    dizin[rota.id] = { rotaId: rota.id, ad: rota.name, paketler, bayt, kare: plan.tileCount, tarih: Date.now() };
    delete inenler[rota.id];
    await dizinYaz();
  } catch (e) {
    await paketleriSil(paketler);
    delete inenler[rota.id];
    if (!(e instanceof Iptal)) hatalar[rota.id] = e instanceof Error ? e.message : 'Harita indirilemedi';
    haberVer();
    if (!(e instanceof Iptal)) throw e;
  } finally {
    iptaller.delete(rota.id);
  }
}

/** Süren indirmeyi durdurur; inen paketler silinir */
export function indirmeyiIptalEt(rotaId: string) {
  if (rotaId in inenler) iptaller.add(rotaId);
}

async function paketleriSil(ids: string[]) {
  if (!gercekHarita) return;
  const { OfflineManager } = ml();
  for (const id of ids) await OfflineManager.deletePack(id).catch(() => undefined);
}

/** Rotanın çevrimdışı kopyasını (harita + rota) siler */
export async function cevrimdisiSil(rotaId: string): Promise<void> {
  await yukle();
  const k = dizin[rotaId];
  delete hatalar[rotaId];
  if (!k) {
    haberVer();
    return;
  }
  await paketleriSil(k.paketler);
  delete dizin[rotaId];
  await AsyncStorage.removeItem(rotaAnahtari(rotaId)).catch(() => undefined);
  await dizinYaz();
}

// --- Rota kopyası (data/rota.ts kullanır) ---

/** İndirilmiş rotanın telefondaki kopyası; yoksa null */
export async function kayitliRota(rotaId: string): Promise<Rota | null> {
  try {
    const s = await AsyncStorage.getItem(rotaAnahtari(rotaId));
    return s ? (JSON.parse(s) as Rota) : null;
  } catch {
    return null;
  }
}

/** İndirilmiş bütün rotaların kopyası (internet yokken rota seçimi için) */
export async function kayitliRotalar(): Promise<Rota[]> {
  await yukle();
  const out: Rota[] = [];
  for (const k of Object.values(dizin).sort((a, b) => b.tarih - a.tarih)) {
    const r = await kayitliRota(k.rotaId);
    if (r) out.push(r);
  }
  return out;
}

/** Sunucudan güncel rota gelince, indirilmişse telefondaki kopyayı da güncelle (ad, not değişmiş olabilir) */
export async function kayitliRotayiTazele(rota: Rota): Promise<void> {
  await yukle();
  if (!dizin[rota.id]) return;
  await AsyncStorage.setItem(rotaAnahtari(rota.id), JSON.stringify(rota)).catch(() => undefined);
  if (dizin[rota.id].ad !== rota.name) {
    dizin[rota.id] = { ...dizin[rota.id], ad: rota.name };
    await dizinYaz();
  }
}
