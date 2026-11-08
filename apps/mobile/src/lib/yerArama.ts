/**
 * Yer arama — Photon (OpenStreetMap). Anahtarsız, adil kullanım.
 * Adres EXPO_PUBLIC_PHOTON_URL ile değiştirilebilir.
 */
import type { LngLat } from '@/data/ornek';

const PHOTON = process.env.EXPO_PUBLIC_PHOTON_URL || 'https://photon.komoot.io/api/';

export type YerSonucu = { id: string; ad: string; ayrinti: string; coord: LngLat };

const TUR: Record<string, string> = {
  peak: 'Zirve',
  village: 'Köy',
  town: 'Kasaba',
  city: 'Şehir',
  hamlet: 'Mahalle',
  beach: 'Plaj',
  bay: 'Koy',
  camp_site: 'Kamp alanı',
  spring: 'Kaynak',
  viewpoint: 'Seyir noktası',
  waterfall: 'Şelale',
  path: 'Patika',
  track: 'Toprak yol',
};

export async function yerAra(q: string, yakin?: LngLat | null, signal?: AbortSignal): Promise<YerSonucu[]> {
  const metin = q.trim();
  if (metin.length < 2) return [];
  const yer = yakin ? `&lon=${yakin[0].toFixed(4)}&lat=${yakin[1].toFixed(4)}` : '';
  const res = await fetch(`${PHOTON}?q=${encodeURIComponent(metin)}&limit=6${yer}`, { signal });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.features ?? []).map((f: { properties: Record<string, string>; geometry: { coordinates: number[] } }, i: number) => {
    const p = f.properties;
    const ayrinti = [TUR[p.osm_value] ?? null, p.district ?? p.county ?? p.city, p.state].filter(Boolean).join(' · ');
    return { id: `${p.osm_id ?? i}-${i}`, ad: p.name ?? p.street ?? metin, ayrinti, coord: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as LngLat };
  });
}
