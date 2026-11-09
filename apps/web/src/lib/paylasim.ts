/**
 * Aktivite paylaşım sayfası (/a/<anahtar>) için veri ve çizim yardımcıları.
 * Veri: Supabase'deki paylasilan_aktivite(anahtar) fonksiyonu (supabase/migrations/20261110020000_paylasim_baglantisi.sql).
 *
 * Sunucuda (Coolify > web uygulaması > Environment Variables):
 *   SUPABASE_URL       (varsayılan https://api.lykiva.ismailtopcam.dev)
 *   SUPABASE_ANON_KEY  (lykiva-supabase servisindeki SERVICE_SUPABASEANON_KEY)
 */
import { ACTIVITY_LABELS, formatDuration, formatKm, formatMeters, formatPace, formatSpeedKmh, type ActivityType } from '@lykiva/shared';
import { cache } from 'react';

export type PaylasilanAktivite = {
  title: string | null;
  activity: ActivityType;
  started_at: string;
  moving_time_s: number;
  elapsed_time_s: number;
  distance_m: number;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  max_elevation_m: number | null;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  owner_name: string;
  endpoints_hidden: boolean;
  /** [boylam, enlem]; başlangıç/bitiş gizliyse kırpılmış */
  track: [number, number][] | null;
  /** [mesafe m, yükseklik m] */
  elevation: [number, number][];
  stop_count: number;
  like_count: number;
  comment_count: number;
};

export type Sonuc =
  | { durum: 'var'; a: PaylasilanAktivite }
  | { durum: 'yok' }
  | { durum: 'ayarsiz' }
  | { durum: 'hata' };

export const ANAHTAR_BICIMI = /^[0-9a-f]{32}$/;

/** Aynı istekte sayfa ve meta veri için tek sorgu (React cache). Her istekte taze: bağlantı kapatılınca hemen kapanır. */
export const paylasilanAktivite = cache(async (anahtar: string): Promise<Sonuc> => {
  if (!ANAHTAR_BICIMI.test(anahtar)) return { durum: 'yok' };
  const url = process.env.SUPABASE_URL || 'https://api.lykiva.ismailtopcam.dev';
  const anahtarKey = process.env.SUPABASE_ANON_KEY;
  if (!anahtarKey) return { durum: 'ayarsiz' };
  try {
    const r = await fetch(`${url}/rest/v1/rpc/paylasilan_aktivite`, {
      method: 'POST',
      headers: { apikey: anahtarKey, Authorization: `Bearer ${anahtarKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ anahtar }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { durum: 'hata' };
    const a = (await r.json()) as PaylasilanAktivite | null;
    return a ? { durum: 'var', a } : { durum: 'yok' };
  } catch {
    return { durum: 'hata' };
  }
});

/* ------------------------------------------------------------------ */
/* Metinler                                                            */
/* ------------------------------------------------------------------ */

const TEMPOLU: ActivityType[] = ['run', 'trail_run', 'walk', 'hike'];

export const baslik = (a: Pick<PaylasilanAktivite, 'title' | 'activity'>) => a.title?.trim() || ACTIVITY_LABELS[a.activity];

/** Sunucu UTC'de çalışır; tarih Türkiye saatiyle yazılır */
export function tarihMetni(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export type Istatistik = { etiket: string; deger: string; birim?: string };

export function istatistikler(a: PaylasilanAktivite): Istatistik[] {
  const tempolu = TEMPOLU.includes(a.activity);
  const ort = a.avg_speed_mps ?? 0;
  const liste: Istatistik[] = [
    { etiket: 'Mesafe', deger: formatKm(a.distance_m), birim: 'km' },
    { etiket: 'Hareket süresi', deger: formatDuration(a.moving_time_s) },
    { etiket: 'Tırmanış', deger: formatMeters(Math.round(a.elevation_gain_m ?? 0)), birim: 'm' },
    tempolu ? { etiket: 'Tempo', deger: formatPace(ort), birim: '/km' } : { etiket: 'Ort. hız', deger: formatSpeedKmh(ort), birim: 'km/sa' },
  ];
  if (!tempolu && a.max_speed_mps) liste.push({ etiket: 'Maks. hız', deger: formatSpeedKmh(a.max_speed_mps), birim: 'km/sa' });
  if (a.max_elevation_m != null) liste.push({ etiket: 'En yüksek', deger: formatMeters(Math.round(a.max_elevation_m)), birim: 'm' });
  return liste;
}

/** Paylaşım önizlemesinde (WhatsApp vb.) görünen kısa açıklama */
export function aciklama(a: PaylasilanAktivite) {
  return `${a.owner_name} · ${ACTIVITY_LABELS[a.activity]} · ${formatKm(a.distance_m)} km · ${formatDuration(a.moving_time_s)} · ↑ ${formatMeters(Math.round(a.elevation_gain_m ?? 0))} m`;
}

/* ------------------------------------------------------------------ */
/* Çizim (SVG)                                                         */
/* ------------------------------------------------------------------ */

/** İzi verilen kutuya sığdırır (boylam enleme göre düzeltilir); SVG yolu ve uç noktaları döner */
export function izCiz(track: [number, number][], w: number, h: number, pad: number) {
  const ortEnlem = track.reduce((t, p) => t + p[1], 0) / track.length;
  const k = Math.cos((ortEnlem * Math.PI) / 180);
  const xs = track.map((p) => p[0] * k);
  const ys = track.map((p) => -p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const olcek = Math.min((w - pad * 2) / (maxX - minX || 1e-9), (h - pad * 2) / (maxY - minY || 1e-9));
  const ox = (w - (maxX - minX) * olcek) / 2;
  const oy = (h - (maxY - minY) * olcek) / 2;
  const nokta = (i: number): [number, number] => [+(ox + (xs[i] - minX) * olcek).toFixed(1), +(oy + (ys[i] - minY) * olcek).toFixed(1)];
  const noktalar = track.map((_, i) => nokta(i));
  return {
    d: noktalar.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '),
    bas: noktalar[0],
    son: noktalar[noktalar.length - 1],
  };
}

/** Yükseklik profili: çizgi ve altı dolu alan */
export function profilCiz(profil: [number, number][], w: number, h: number) {
  const ds = profil.map((p) => p[0]);
  const zs = profil.map((p) => p[1]);
  const [dMax, zMin, zMax] = [Math.max(...ds) || 1, Math.min(...zs), Math.max(...zs)];
  const aralik = Math.max(zMax - zMin, 20); // düz parkurda çizgi abartılmasın
  const alt = zMin - (aralik - (zMax - zMin)) / 2;
  const nokta = (p: [number, number]) => `${((p[0] / dMax) * w).toFixed(1)} ${(h - 4 - ((p[1] - alt) / aralik) * (h - 8)).toFixed(1)}`;
  const cizgi = profil.map((p, i) => `${i ? 'L' : 'M'}${nokta(p)}`).join(' ');
  return { cizgi, alan: `${cizgi} L${w} ${h} L0 ${h} Z`, zMin: Math.round(zMin), zMax: Math.round(zMax), dMax };
}
