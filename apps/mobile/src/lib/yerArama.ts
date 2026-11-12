/**
 * Yer arama — Photon (OpenStreetMap). Kendi sunucumuz (photon.ismailtopcam.dev, yalnızca Türkiye) ya da herkese açık
 * photon.komoot.io; adres ve anahtar `lib/altyapi.ts`'te.
 */
import type { LngLat } from '@/data/ornek';
import { $t } from '@/i18n';
import { PHOTON_URL as PHOTON, photonBasliklari } from '@/lib/altyapi';

export type YerSonucu = { id: string; ad: string; ayrinti: string; coord: LngLat };

const TUR = (): Record<string, string> => ({
  peak: $t('lib_yerArama.zirve'),
  village: $t('lib_yerArama.koy'),
  town: $t('lib_yerArama.kasaba'),
  city: $t('ortak.sehir'),
  hamlet: $t('lib_yerArama.mahalle'),
  beach: $t('lib_yerArama.plaj'),
  bay: $t('lib_yerArama.koy_2'),
  camp_site: $t('lib_yerArama.kamp_alani'),
  spring: $t('lib_yerArama.kaynak'),
  viewpoint: $t('lib_yerArama.seyir_noktasi'),
  waterfall: $t('lib_yerArama.selale'),
  path: $t('lib_yerArama.patika'),
  track: $t('lib_yerArama.toprak_yol'),
});

export async function yerAra(q: string, yakin?: LngLat | null, signal?: AbortSignal): Promise<YerSonucu[]> {
  const metin = q.trim();
  if (metin.length < 2) return [];
  const yer = yakin ? `&lon=${yakin[0].toFixed(4)}&lat=${yakin[1].toFixed(4)}` : '';
  const res = await fetch(`${PHOTON}?q=${encodeURIComponent(metin)}&limit=6${yer}`, { signal, headers: photonBasliklari() });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.features ?? []).map((f: { properties: Record<string, string>; geometry: { coordinates: number[] } }, i: number) => {
    const p = f.properties;
    const ayrinti = [TUR()[p.osm_value] ?? null, p.district ?? p.county ?? p.city, p.state].filter(Boolean).join(' · ');
    return { id: `${p.osm_id ?? i}-${i}`, ad: p.name ?? p.street ?? metin, ayrinti, coord: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as LngLat };
  });
}
