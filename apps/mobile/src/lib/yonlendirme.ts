/**
 * Rota çizimi için yol/patika bulma — BRouter (OpenStreetMap, rakımlı).
 *
 * Kendi sunucumuz (brouter.ismailtopcam.dev, Türkiye ve çevresi) ya da herkese açık brouter.de; adres ve anahtar `lib/altyapi.ts`'te.
 */
import type { ActivityType, RoutePoint } from '@lykiva/shared';

import type { LngLat } from '@/data/ornek';
import { $t } from '@/i18n';
import { BROUTER_URL as BROUTER, brouterBasliklari } from '@/lib/altyapi';

export type CizimModu = 'patika' | 'yol' | 'serbest';

export const CIZIM_MODLARI = (): { id: CizimModu; label: string }[] => [
  { id: 'patika', label: $t('lib_yonlendirme.patikaya_yapis') },
  { id: 'yol', label: $t('lib_yonlendirme.yola_yapis') },
  { id: 'serbest', label: $t('lib_yonlendirme.serbest_ciz') },
];

/** Zemin payları (0..1) */
export type Zemin = { asphalt: number; gravel: number; trail: number };

export type HesaplananRota = { points: RoutePoint[]; surface: Zemin | null };

function profil(mod: CizimModu, activity: ActivityType): string {
  const bisiklet = activity === 'bike' || activity === 'mtb';
  if (mod === 'patika') return activity === 'mtb' ? 'mtb' : bisiklet ? 'trekking' : 'hiking-mountain';
  return activity === 'bike' ? 'fastbike' : 'trekking';
}

/** OSM etiketlerinden zemin sınıfı */
function zeminSinifi(wayTags: string): keyof Zemin {
  const tags = Object.fromEntries(
    wayTags
      .split(' ')
      .filter(Boolean)
      .map((kv) => kv.split('=') as [string, string]),
  );
  const highway = tags.highway ?? '';
  const surface = tags.surface ?? '';
  if (['path', 'footway', 'bridleway', 'steps', 'via_ferrata'].includes(highway)) return 'trail';
  if (['asphalt', 'paved', 'concrete', 'paving_stones', 'sett', 'chipseal'].includes(surface)) return 'asphalt';
  if (highway === 'track' || ['gravel', 'fine_gravel', 'dirt', 'ground', 'compacted', 'unpaved', 'earth', 'grass', 'sand', 'rock'].includes(surface)) return 'gravel';
  return 'asphalt';
}

/**
 * Durak noktalarından rota hesaplar.
 * "serbest" modda noktalar düz çizgiyle birleşir (rakım yok).
 */
export async function rotaHesapla(duraklar: LngLat[], mod: CizimModu, activity: ActivityType, signal?: AbortSignal): Promise<HesaplananRota> {
  if (duraklar.length < 2 || mod === 'serbest') {
    return { points: duraklar.map(([lng, lat]) => ({ lng, lat, alt: null })), surface: null };
  }
  const lonlats = duraklar.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join('|');
  const url = `${BROUTER}?lonlats=${encodeURIComponent(lonlats)}&profile=${profil(mod, activity)}&alternativeidx=0&format=geojson`;
  const res = await fetch(url, { signal, headers: brouterBasliklari() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    // "datafile E0_N45.rd5 not found": nokta, sunucudaki harita karolarının dışında (kendi sunucumuz yalnızca Türkiye ve çevresi)
    if (t.includes('datafile')) throw new Error($t('lib_yonlendirme.yalnizca_turkiye'));
    throw new Error(t.includes('not mapped') || t.includes('target') ? $t('lib_yonlendirme.bu_noktalar_arasinda_yol') : $t('lib_yonlendirme.rota_hesaplanamadi'));
  }
  const j = await res.json();
  const f = j.features?.[0];
  const coords: number[][] = f?.geometry?.coordinates ?? [];
  const points: RoutePoint[] = coords.map((c) => ({ lng: c[0], lat: c[1], alt: c.length > 2 ? c[2] : null }));

  // messages: ilk satır başlık; Distance ve WayTags sütunlarından zemin payları
  let surface: Zemin | null = null;
  const msgs: string[][] | undefined = f?.properties?.messages;
  if (msgs && msgs.length > 1) {
    const h = msgs[0];
    const iD = h.indexOf('Distance');
    const iW = h.indexOf('WayTags');
    if (iD >= 0 && iW >= 0) {
      const toplam: Zemin = { asphalt: 0, gravel: 0, trail: 0 };
      for (const row of msgs.slice(1)) toplam[zeminSinifi(row[iW] ?? '')] += Number(row[iD]) || 0;
      const t = toplam.asphalt + toplam.gravel + toplam.trail;
      if (t > 0) surface = { asphalt: toplam.asphalt / t, gravel: toplam.gravel / t, trail: toplam.trail / t };
    }
  }
  return { points, surface };
}
