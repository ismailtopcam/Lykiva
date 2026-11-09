/**
 * Akış ve takip: sunucu fonksiyonları supabase/migrations/20261110000000_akis_takip.sql içinde.
 * Takip etme / bırakma ve beğeni doğrudan tablo yazımıyla yapılır (veritabanı kuralları korur).
 */
import { ACTIVITY_LABELS, formatDuration, formatKm, formatSpeedKmh, type ActivityType } from '@lykiva/shared';
import * as Location from 'expo-location';

import type { LngLat } from '@/data/ornek';
import { oturumuSagla, supabase } from '@/lib/supabase';

export type AkisFiltresi = 'takip' | 'gruplar' | 'yakin';

export type AkisOgesi = {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_username: string;
  owner_avatar: string | null;
  title: string | null;
  activity: ActivityType;
  started_at: string;
  moving_time_s: number;
  distance_m: number;
  elevation_gain_m: number | null;
  avg_speed_mps: number | null;
  visibility: 'private' | 'followers' | 'groups' | 'public';
  track: number[][] | null;
  like_count: number;
  comment_count: number;
  liked: boolean;
  stop_count: number;
  mine: boolean;
};

export type KisiOzeti = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  city: string | null;
  i_follow: boolean;
  follows_me: boolean;
  common_groups?: number;
  me?: boolean;
};

export type KisiProfili = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  created_at: string;
  me: boolean;
  temporary: boolean;
  follower_count: number;
  following_count: number;
  i_follow: boolean;
  follows_me: boolean;
  common_group: boolean;
  activity_count: number;
};

async function rpc<T>(ad: string, args?: Record<string, unknown>): Promise<T> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc(ad, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const SAYFA = 20;

/** Akışın bir sayfası; devamı için son öğe "once" olarak verilir */
export function akisGetir(filtre: AkisFiltresi, once?: AkisOgesi | null, konum?: LngLat | null) {
  return rpc<AkisOgesi[]>('akis', {
    filtre,
    once_zaman: once?.started_at ?? null,
    once_id: once?.id ?? null,
    lng: konum?.[0] ?? null,
    lat: konum?.[1] ?? null,
    adet: SAYFA,
  });
}

/** "Yakınımda" için şimdiki konum; izin yoksa null */
export async function simdikiKonum(): Promise<LngLat | null> {
  const izin = await Location.requestForegroundPermissionsAsync();
  if (izin.status !== 'granted') return null;
  const son = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }).catch(() => null);
  const k = son ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return [k.coords.longitude, k.coords.latitude];
}

export async function begen(aktivite: string, begeni: boolean) {
  const uid = await oturumuSagla();
  const { error } = begeni
    ? await supabase.from('activity_likes').insert({ activity_id: aktivite, user_id: uid })
    : await supabase.from('activity_likes').delete().eq('activity_id', aktivite).eq('user_id', uid);
  // Aynı beğeni zaten varsa (iki kez dokunma) sorun değil
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function takipEt(kisi: string, takip: boolean) {
  const uid = await oturumuSagla();
  const { error } = takip
    ? await supabase.from('follows').insert({ follower_id: uid, followee_id: kisi })
    : await supabase.from('follows').delete().eq('follower_id', uid).eq('followee_id', kisi);
  if (error && error.code !== '23505') throw new Error(error.message);
}

export const kisiProfili = (id: string) => rpc<KisiProfili | null>('kisi_profili', { kisi: id });
/** Arama boşsa öneriler (beni takip edenler, ortak gruptakiler) */
export const kisiAra = (arama?: string) => rpc<KisiOzeti[]>('kisi_ara', { arama: arama?.trim() || null });
export const takipListesi = (kisi: string, yon: 'takipci' | 'takip') => rpc<KisiOzeti[]>('takip_listesi', { kisi, yon });

export type KisiAktivitesi = {
  id: string;
  title: string;
  activity: ActivityType;
  started_at: string;
  stats: string;
  route: LngLat[];
};

/** Bir kişinin görebildiğim aktiviteleri (kurallar süzer) */
export async function kisininAktiviteleri(id: string): Promise<KisiAktivitesi[]> {
  await oturumuSagla();
  const { data, error } = await supabase
    .from('aktivite_ozetleri')
    .select('id,title,activity,started_at,moving_time_s,distance_m,elevation_gain_m,track_geojson')
    .eq('owner_id', id)
    .order('started_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map((o) => {
    const coords = (o.track_geojson?.coordinates ?? []) as number[][];
    return {
      id: o.id,
      title: o.title ?? ACTIVITY_LABELS[o.activity as ActivityType],
      activity: o.activity,
      started_at: o.started_at,
      stats: `${formatKm(o.distance_m)} km · ${formatDuration(o.moving_time_s)} · ${Math.round(o.elevation_gain_m ?? 0)} m`,
      route: coords.filter((_, i) => i % 5 === 0).map((c) => [c[0], c[1]] as LngLat),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Görünüm yardımcıları                                                */
/* ------------------------------------------------------------------ */

export const izi = (t: number[][] | null): LngLat[] => (t ?? []).map((c) => [c[0], c[1]] as LngLat);

export const baslik = (o: Pick<AkisOgesi, 'title' | 'activity'>) => o.title ?? ACTIVITY_LABELS[o.activity];

/** Kart istatistikleri: mesafe, tırmanış, süre, ortalama hız */
export function kartIstatistikleri(o: AkisOgesi) {
  return {
    km: formatKm(o.distance_m),
    tirmanis: String(Math.round(o.elevation_gain_m ?? 0)),
    sure: formatDuration(o.moving_time_s),
    hiz: formatSpeedKmh(o.avg_speed_mps ?? 0),
  };
}

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** "Bugün 08:12", "Dün 18:40", "7 Kas 08:12", geçen yıldansa "7 Kas 2025" */
export function akisZamani(iso: string, simdi = new Date()) {
  const d = new Date(iso);
  const saat = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const gun = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const fark = Math.round((gun(simdi) - gun(d)) / 86_400_000);
  if (fark === 0) return `Bugün ${saat}`;
  if (fark === 1) return `Dün ${saat}`;
  if (d.getFullYear() !== simdi.getFullYear()) return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${saat}`;
}

/** Aktivite türüne göre simge */
export function turSimgesi(t: ActivityType): 'bike' | 'run' | 'walk' {
  if (t === 'bike' || t === 'mtb') return 'bike';
  if (t === 'run' || t === 'trail_run') return 'run';
  return 'walk';
}
