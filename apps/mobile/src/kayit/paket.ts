/**
 * Bitmiş bir kaydı sunucuya gidecek pakete çevirir (kaydet_aktivite fonksiyonunun beklediği biçim).
 */
import { computeSegmentedStats, detectStops, type ActivityType, type HavaDurumu, type TrackPoint, type TrackStop, haversine } from '@lykiva/shared';
import { $t } from '@/i18n';

export type KayitPaketi = {
  client_id: string;
  route_id?: string | null;
  title: string | null;
  activity: ActivityType;
  started_at: string;
  ended_at: string;
  moving_time_s: number;
  elapsed_time_s: number;
  distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_elevation_m: number | null;
  avg_speed_mps: number;
  max_speed_mps: number;
  min_moving_speed_mps: number;
  /** Verilmezse sunucu kişinin varsayılanını kullanır (Gizlilik kontrolleri > Aktiviteler) */
  visibility?: 'private' | 'followers' | 'public';
  hide_endpoints: boolean;
  points: TrackPoint[];
  stops: TrackStop[];
  /** Kayıt başındaki hava (sunucuda activities.weather) */
  weather?: HavaDurumu | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Ayrıntılı başlık: saat ve aktivite türüne göre */
export function varsayilanBaslik(type: ActivityType, start: Date): string {
  const h = start.getHours();
  const zaman = h < 6 ? $t('kayit_paket.gece') : h < 11 ? $t('kayit_paket.sabah') : h < 14 ? $t('kayit_paket.ogle') : h < 18 ? $t('kayit_paket.ogleden_sonra') : $t('kayit_paket.aksam');
  const ad: Record<ActivityType, string> = {
    bike: $t('kayit_paket.bisiklet_turu'),
    mtb: $t('kayit_paket.dag_bisikleti_turu'),
    run: $t('kayit_paket.kosusu'),
    walk: $t('kayit_paket.yuruyusu'),
    hike: $t('kayit_paket.doga_yuruyusu'),
    trail_run: $t('kayit_paket.patika_kosusu'),
  };
  // "Sabah koşusu", "Morning run", Almancada bitişik: "Morgenlauf"
  return $t('kayit_paket.baslik', { zaman, tur: ad[type] });
}

export function paketOlustur(opts: {
  clientId: string;
  activity: ActivityType;
  segments: TrackPoint[][];
  title?: string;
  routeId?: string | null;
  hava?: HavaDurumu | null;
}): KayitPaketi | null {
  const segments = opts.segments.filter((s) => s.length > 0);
  const points = segments.flat();
  if (points.length < 2) return null;

  const s = computeSegmentedStats(segments);

  // Molalar: her parçadaki duraklamalar + elle duraklatılan aralıklar
  const stops: TrackStop[] = [];
  let mesafe = 0;
  segments.forEach((seg, i) => {
    for (const st of detectStops(seg)) stops.push({ ...st, distanceAtM: r1(mesafe + st.distanceAtM) });
    for (let k = 1; k < seg.length; k++) mesafe += haversine(seg[k - 1], seg[k]);
    const next = segments[i + 1];
    if (next) {
      const son = seg[seg.length - 1];
      stops.push({ startT: son.t, endT: next[0].t, lat: son.lat, lng: son.lng, distanceAtM: r1(mesafe) });
    }
  });

  const start = new Date(points[0].t);
  return {
    client_id: opts.clientId,
    // Örnek rota sunucuda yok; yalnızca gerçek rota id'si gönderilir
    route_id: opts.routeId && opts.routeId !== 'ornek' ? opts.routeId : null,
    title: opts.title?.trim() || varsayilanBaslik(opts.activity, start),
    activity: opts.activity,
    started_at: start.toISOString(),
    ended_at: new Date(points[points.length - 1].t).toISOString(),
    moving_time_s: Math.round(s.movingS),
    elapsed_time_s: Math.round(s.elapsedS),
    distance_m: r1(s.distanceM),
    elevation_gain_m: r1(s.gainM),
    elevation_loss_m: r1(s.lossM),
    max_elevation_m: s.maxAltM == null ? null : r1(s.maxAltM),
    avg_speed_mps: r2(s.avgMovingSpeed),
    max_speed_mps: r2(s.maxSpeed),
    min_moving_speed_mps: r2(s.minMovingSpeed),
    hide_endpoints: true,
    points: points.map((p) => ({
      t: p.t,
      lat: Math.round(p.lat * 1e6) / 1e6,
      lng: Math.round(p.lng * 1e6) / 1e6,
      alt: p.alt == null ? null : r1(p.alt),
      speed: p.speed == null || p.speed < 0 ? null : r2(p.speed),
    })),
    stops: stops.sort((a, b) => a.startT - b.startT),
    weather: opts.hava ?? null,
  };
}
