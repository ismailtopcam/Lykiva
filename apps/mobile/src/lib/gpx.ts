/**
 * GPX dışa aktarımı: Garmin, Komoot, Strava, Wikiloc vb. hepsi okur.
 */
import type { ActivityType } from '@lykiva/shared';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { GpxNoktasi } from '@/data/aktivite';
import { $t } from '@/i18n';

const TUR: Record<ActivityType, string> = { bike: 'cycling', mtb: 'mountain_biking', run: 'running', walk: 'walking', hike: 'hiking', trail_run: 'trail_running' };

const kac = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function gpxOlustur(baslik: string, tur: ActivityType, noktalar: GpxNoktasi[]): string {
  const pts = noktalar
    .map((p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">${p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : ''}<time>${new Date(p.t).toISOString()}</time></trkpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Lykiva" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${kac(baslik)}</name>${noktalar.length ? `<time>${new Date(noktalar[0].t).toISOString()}</time>` : ''}</metadata>
  <trk>
    <name>${kac(baslik)}</name>
    <type>${TUR[tur]}</type>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** Dosya adı için güvenli metin */
export function dosyaAdi(s: string) {
  const tr: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };
  return (
    s
      .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => tr[c] ?? c)
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'lykiva'
  );
}

export async function gpxPaylas(baslik: string, tur: ActivityType, noktalar: GpxNoktasi[]) {
  if (noktalar.length < 2) throw new Error($t('lib_gpx.bu_aktivitenin_gps_noktalari'));
  const f = new File(Paths.cache, `${dosyaAdi(baslik)}.gpx`);
  if (f.exists) f.delete();
  f.create();
  f.write(gpxOlustur(baslik, tur, noktalar));
  await Sharing.shareAsync(f.uri, { mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx', dialogTitle: $t('lib_gpx.gpx_dosyasini_paylas') });
}
