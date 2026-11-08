/**
 * Aktivite ekranlarının veri kaynağı.
 * - "ornek"           → tasarım örneği
 * - "yerel-<uuid>"    → telefonda bekleyen (henüz gönderilmemiş) kayıt; gönderildiyse sunucudakine geçer
 * - diğer (uuid)      → sunucudaki aktivite
 */
import { ACTIVITY_LABELS, formatDuration, formatKm, formatSpeedKmh, haversine, type ActivityType } from '@lykiva/shared';
import { useEffect, useState } from 'react';

import { kuyruguGonder, kuyruktakiler, sunucuIdsi, yereldekiPaket } from '@/kayit/kuyruk';
import { supabase, supabaseHazir } from '@/lib/supabase';
import { kasKalkan, type Activity, type LngLat, type Stop } from './ornek';

type ProfilNoktasi = { t: number; d: number; alt: number | null; speed: number | null };
type Mola = { start: number; end: number; distanceAt: number; lng: number; lat: number; note?: string | null };

type Ham = {
  id: string;
  title: string | null;
  activity: ActivityType;
  started: number;
  ended: number;
  movingS: number;
  elapsedS: number;
  distanceM: number;
  gainM: number;
  lossM: number;
  maxAltM: number | null;
  avg: number;
  max: number;
  min: number;
  route: LngLat[];
  profile: ProfilNoktasi[];
  stops: Mola[];
  ownerName?: string;
};

const saat = (ms: number) => new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** "Cumartesi, 7 Kasım · 08:12" */
function ne(ms: number) {
  const d = new Date(ms);
  return `${GUNLER[d.getDay()]}, ${d.getDate()} ${AYLAR[d.getMonth()]} · ${saat(ms)}`;
}

/** Değerleri n kutuya böler; boş kutu 0 olur (hız grafiğinde mola bandı) */
function kutula(xs: number[], ys: number[], from: number, to: number, n: number, bosDeger: number | null): number[] {
  const out: number[] = [];
  const span = to - from || 1;
  const toplam = new Array(n).fill(0);
  const sayi = new Array(n).fill(0);
  xs.forEach((x, i) => {
    const k = Math.min(n - 1, Math.max(0, Math.floor(((x - from) / span) * n)));
    toplam[k] += ys[i];
    sayi[k] += 1;
  });
  let son = bosDeger ?? 0;
  for (let k = 0; k < n; k++) {
    if (sayi[k]) son = toplam[k] / sayi[k];
    out.push(sayi[k] ? son : bosDeger ?? son);
  }
  return out;
}

function goruntuyeCevir(h: Ham): Activity {
  const p = h.profile;
  const altli = p.filter((x) => x.alt != null);
  const elevation = altli.length > 1 ? kutula(altli.map((x) => x.d), altli.map((x) => x.alt as number), 0, h.distanceM, 60, null) : [0, 0];
  const hizli = p.filter((x) => x.speed != null);
  const speed = hizli.length > 1 ? kutula(hizli.map((x) => x.t), hizli.map((x) => (x.speed as number) * 3.6), h.started, h.ended, 60, 0) : [0, 0];
  const stops: Stop[] = h.stops.map((s, i) => ({
    n: i + 1,
    title: `Mola ${i + 1}`,
    time: saat(s.start),
    km: formatKm(s.distanceAt),
    duration: formatDuration((s.end - s.start) / 1000),
    note: s.note ?? '',
    at: h.distanceM > 0 ? Math.min(1, s.distanceAt / h.distanceM) : 0,
    coord: [s.lng, s.lat],
  }));
  const molaS = h.stops.reduce((a, s) => a + (s.end - s.start) / 1000, 0);
  return {
    id: h.id,
    owner: h.ownerName ?? 'me',
    with: [],
    title: h.title ?? ACTIVITY_LABELS[h.activity],
    type: h.activity,
    place: '',
    when: ne(h.started),
    distanceKm: formatKm(h.distanceM),
    durationMoving: formatDuration(h.movingS),
    durationTotal: formatDuration(h.elapsedS),
    climbM: Math.round(h.gainM),
    descentM: Math.round(h.lossM),
    maxElevationM: h.maxAltM == null ? 0 : Math.round(h.maxAltM),
    avgSpeed: formatSpeedKmh(h.avg),
    maxSpeed: formatSpeedKmh(h.max),
    minSpeed: formatSpeedKmh(h.min),
    route: h.route,
    elevation,
    speed,
    stops,
    likes: 0,
    comments: 0,
    startClock: saat(h.started),
    endClock: saat(h.ended),
    stopTotal: formatDuration(molaS),
    hasElevation: altli.length > 1,
  };
}

async function sunucudan(id: string): Promise<Activity> {
  const [{ data: o, error }, { data: d, error: e2 }] = await Promise.all([
    supabase.from('aktivite_ozetleri').select('*').eq('id', id).maybeSingle(),
    supabase.rpc('aktivite_detay', { aktivite: id }),
  ]);
  if (error || e2) throw error ?? e2;
  if (!o) throw new Error('Aktivite bulunamadı ya da görme iznin yok');
  const detay = (d ?? { stops: [], profile: [] }) as {
    stops: { started_at: string; ended_at: string; distance_at_m: number; lng: number; lat: number; note: string | null }[];
    profile: ProfilNoktasi[];
  };
  const coords = (o.track_geojson?.coordinates ?? []) as number[][];
  return goruntuyeCevir({
    id: o.id,
    title: o.title,
    activity: o.activity,
    started: Date.parse(o.started_at),
    ended: Date.parse(o.ended_at),
    movingS: o.moving_time_s,
    elapsedS: o.elapsed_time_s,
    distanceM: o.distance_m,
    gainM: o.elevation_gain_m ?? 0,
    lossM: o.elevation_loss_m ?? 0,
    maxAltM: o.max_elevation_m,
    avg: o.avg_speed_mps ?? 0,
    max: o.max_speed_mps ?? 0,
    min: o.min_moving_speed_mps ?? 0,
    route: coords.map((c) => [c[0], c[1]] as LngLat),
    profile: detay.profile,
    stops: detay.stops.map((s) => ({ start: Date.parse(s.started_at), end: Date.parse(s.ended_at), distanceAt: s.distance_at_m, lng: s.lng, lat: s.lat, note: s.note })),
    ownerName: o.owner_name,
  });
}

async function yerelden(clientId: string): Promise<Activity | null> {
  const p = await yereldekiPaket(clientId);
  if (!p) return null;
  let d = 0;
  const profile: ProfilNoktasi[] = p.points.map((pt, i) => {
    if (i > 0) d += haversine(p.points[i - 1], pt);
    return { t: pt.t, d, alt: pt.alt ?? null, speed: pt.speed ?? null };
  });
  return goruntuyeCevir({
    id: `yerel-${clientId}`,
    title: p.title,
    activity: p.activity,
    started: Date.parse(p.started_at),
    ended: Date.parse(p.ended_at),
    movingS: p.moving_time_s,
    elapsedS: p.elapsed_time_s,
    distanceM: p.distance_m,
    gainM: p.elevation_gain_m,
    lossM: p.elevation_loss_m,
    maxAltM: p.max_elevation_m,
    avg: p.avg_speed_mps,
    max: p.max_speed_mps,
    min: p.min_moving_speed_mps,
    route: p.points.map((pt) => [pt.lng, pt.lat] as LngLat),
    profile,
    stops: p.stops.map((s) => ({ start: s.startT, end: s.endT, distanceAt: s.distanceAtM, lng: s.lng, lat: s.lat })),
  });
}

export type AktiviteDurumu = {
  a: Activity | null;
  yukleniyor: boolean;
  hata: string | null;
  /** Telefonda bekliyor (henüz sunucuya gitmedi) */
  bekliyor: boolean;
};

export function useAktivite(id: string | undefined): AktiviteDurumu {
  const ornek = !id || id === 'ornek';
  const [durum, setDurum] = useState<AktiviteDurumu & { id?: string }>({ a: null, yukleniyor: true, hata: null, bekliyor: false });

  useEffect(() => {
    if (!id || id === 'ornek') return;
    let iptal = false;
    (async () => {
      try {
        if (id.startsWith('yerel-')) {
          const cid = id.slice(6);
          // Önce göndermeyi dene; olduysa sunucudakini göster
          await kuyruguGonder().catch(() => undefined);
          const sid = await sunucuIdsi(cid);
          if (sid && supabaseHazir) {
            const a = await sunucudan(sid);
            if (!iptal) setDurum({ a, yukleniyor: false, hata: null, bekliyor: false });
            return;
          }
          const a = await yerelden(cid);
          if (!iptal) setDurum({ a, yukleniyor: false, hata: a ? null : 'Kayıt bulunamadı', bekliyor: !!a });
          return;
        }
        const a = await sunucudan(id);
        if (!iptal) setDurum({ a, yukleniyor: false, hata: null, bekliyor: false });
      } catch (e) {
        if (!iptal) setDurum({ a: null, yukleniyor: false, hata: e instanceof Error ? e.message : 'Yüklenemedi', bekliyor: false });
      }
    })();
    return () => {
      iptal = true;
    };
  }, [id]);

  if (ornek) return { a: kasKalkan, yukleniyor: false, hata: null, bekliyor: false };
  // Başka bir aktiviteye geçildiyse eski veriyi gösterme
  if (durum.a && durum.a.id !== id && !(id?.startsWith('yerel-') && durum.a)) return { a: null, yukleniyor: true, hata: null, bekliyor: false };
  return durum;
}

export type AktiviteSatiri = {
  id: string;
  title: string;
  meta: string;
  stats: string;
  route: LngLat[];
  bekliyor?: boolean;
  startedAt?: number;
  distanceM?: number;
  movingS?: number;
  gainM?: number;
};

/** Profil listesi: sunucudaki kendi aktivitelerim + telefonda bekleyenler */
export async function aktivitelerim(userId: string | null): Promise<AktiviteSatiri[]> {
  const bekleyen = await kuyruktakiler();
  const satirlar: AktiviteSatiri[] = bekleyen.map((p) => ({
    id: `yerel-${p.client_id}`,
    title: p.title ?? ACTIVITY_LABELS[p.activity],
    meta: `${ne(Date.parse(p.started_at))} · gönderilmeyi bekliyor`,
    stats: `${formatKm(p.distance_m)} km · ${formatDuration(p.moving_time_s)} · ${Math.round(p.elevation_gain_m)} m`,
    route: p.points.filter((_, i) => i % 10 === 0).map((pt) => [pt.lng, pt.lat] as LngLat),
    bekliyor: true,
    startedAt: Date.parse(p.started_at),
    distanceM: p.distance_m,
    movingS: p.moving_time_s,
    gainM: p.elevation_gain_m,
  }));
  if (userId && supabaseHazir) {
    const { data } = await supabase
      .from('aktivite_ozetleri')
      .select('id,title,activity,started_at,moving_time_s,distance_m,elevation_gain_m,track_geojson')
      .eq('owner_id', userId)
      .order('started_at', { ascending: false })
      .limit(50);
    for (const o of data ?? []) {
      const coords = (o.track_geojson?.coordinates ?? []) as number[][];
      satirlar.push({
        id: o.id,
        title: o.title ?? ACTIVITY_LABELS[o.activity as ActivityType],
        meta: `${ne(Date.parse(o.started_at))} · ${ACTIVITY_LABELS[o.activity as ActivityType]}`,
        stats: `${formatKm(o.distance_m)} km · ${formatDuration(o.moving_time_s)} · ${Math.round(o.elevation_gain_m ?? 0)} m`,
        route: coords.filter((_, i) => i % 5 === 0).map((c) => [c[0], c[1]] as LngLat),
        startedAt: Date.parse(o.started_at),
        distanceM: o.distance_m,
        movingS: o.moving_time_s,
        gainM: o.elevation_gain_m ?? 0,
      });
    }
  }
  return satirlar;
}

export type Profilim = { displayName: string; username: string; city: string | null; takipci: number; takip: number };

export async function profilim(userId: string): Promise<Profilim | null> {
  const [{ data: p }, { count: takipci }, { count: takip }] = await Promise.all([
    supabase.from('profiles').select('display_name,username,city').eq('id', userId).maybeSingle(),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  if (!p) return null;
  return { displayName: p.display_name, username: p.username, city: p.city, takipci: takipci ?? 0, takip: takip ?? 0 };
}

/** Bu haftanın (Pzt–Paz) günlük km'si ve toplamları */
export function haftaOzeti(satirlar: AktiviteSatiri[], simdi = new Date()) {
  const bas = new Date(simdi);
  bas.setHours(0, 0, 0, 0);
  bas.setDate(bas.getDate() - ((bas.getDay() + 6) % 7));
  const bit = new Date(bas);
  bit.setDate(bit.getDate() + 7);
  const gunler = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => ({ day, km: 0 }));
  let km = 0;
  let sn = 0;
  let m = 0;
  for (const s of satirlar) {
    if (s.startedAt == null || s.startedAt < bas.getTime() || s.startedAt >= bit.getTime()) continue;
    const g = (new Date(s.startedAt).getDay() + 6) % 7;
    gunler[g].km += (s.distanceM ?? 0) / 1000;
    km += (s.distanceM ?? 0) / 1000;
    sn += s.movingS ?? 0;
    m += s.gainM ?? 0;
  }
  const son = new Date(bit.getTime() - 86400000);
  const aralik = `${bas.getDate()} ${bas.getMonth() !== son.getMonth() ? AYLAR[bas.getMonth()] + ' ' : ''}– ${son.getDate()} ${AYLAR[son.getMonth()]}`;
  return { gunler, km, sn, m, aralik };
}
