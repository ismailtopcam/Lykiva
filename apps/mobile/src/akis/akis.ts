/**
 * Akış ve takip: sunucu fonksiyonları supabase/migrations/20261110000000_akis_takip.sql içinde.
 * Takip etme / bırakma ve beğeni doğrudan tablo yazımıyla yapılır (veritabanı kuralları korur).
 */
import { ACTIVITY_LABELS, formatDuration, formatKm, formatSpeedKmh, type ActivityType, type HavaDurumu } from '@lykiva/shared';
import * as Location from 'expo-location';

import type { LngLat } from '@/data/ornek';
import { oturumuSagla, supabase } from '@/lib/supabase';
import { $t, yerel } from '@/i18n';

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
  /** Birlikte yapılanlar (ilk 3) ve toplam sayı; eski sunucuda gelmeyebilir */
  with?: { id: string; ad: string }[];
  with_count?: number;
  tagged_me?: boolean;
  weather?: HavaDurumu | null;
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
  /** Profilini gizlemiş (Gizlilik kontrolleri > Profil sayfası): ayrıntılar ve sayılar gelmez */
  kisitli?: boolean;
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

/* ------------------------------------------------------------------ */
/* Yorumlar (supabase/migrations/20261110010000_yorumlar.sql)          */
/* ------------------------------------------------------------------ */

export type Yorum = {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  body: string;
  created_at: string;
  mine: boolean;
};

export type Sosyal = { like_count: number; comment_count: number; liked: boolean };
export type YorumSayfasi = Sosyal & { i_own_activity: boolean; comments: Yorum[] };

export const YORUM_SINIRI = 1000;

/** Yalnızca sunucudaki aktivitelerin yorumu olur (örnek ve telefonda bekleyen kayıtların olmaz) */
export const sunucuAktivitesiMi = (id: string | undefined): id is string => !!id && /^[0-9a-f-]{36}$/i.test(id);

export const aktiviteSosyal = (id: string) => rpc<Sosyal | null>('aktivite_sosyal', { aktivite: id });
export const aktiviteYorumlari = (id: string) => rpc<YorumSayfasi | null>('aktivite_yorumlari', { aktivite: id });
export const yorumYaz = (id: string, metin: string) => rpc<Yorum>('yorum_yaz', { aktivite: id, metin });
export const yorumSil = (yorum: string) => rpc<boolean>('yorum_sil', { yorum });

/* ------------------------------------------------------------------ */
/* Ekranlar arası güncelleme: yorum / beğeni başka ekranda değişince   */
/* akış kartı yeniden yüklemeden güncellenir                           */
/* ------------------------------------------------------------------ */

/** Ekranlar arası değişiklik: beğeni/yorum sayısı, yeni başlık ya da silinme */
export type AktiviteDegisikligi = Partial<Sosyal> & { title?: string | null; silindi?: boolean };
const dinleyiciler = new Set<(id: string, d: AktiviteDegisikligi) => void>();

export function aktiviteDegisti(id: string, d: AktiviteDegisikligi) {
  dinleyiciler.forEach((f) => f(id, d));
}

export function aktiviteDegisikliginiDinle(f: (id: string, d: AktiviteDegisikligi) => void) {
  dinleyiciler.add(f);
  return () => {
    dinleyiciler.delete(f);
  };
}

/* ------------------------------------------------------------------ */
/* Birlikte yapılan aktivite (supabase/migrations/20261110040000_birlikte.sql) */
/* ------------------------------------------------------------------ */

export type BirlikteOnerisi = { user_id: string; display_name: string; username: string; activity_id: string; title: string | null; started_at: string };
export type BirlikteKisisi = { user_id: string; display_name: string; username: string; me: boolean };

export const birlikteKisileri = (id: string) => rpc<BirlikteKisisi[]>('birlikte_kisiler', { aktivite: id });
/** Aynı saatlerde aynı yoldan geçen tanıdıklar (yalnızca sahibine) */
export const birlikteOnerileri = (id: string) => rpc<BirlikteOnerisi[]>('birlikte_onerileri', { aktivite: id });
export const birlikteEkle = (id: string, kisiler: string[]) => rpc<number>('birlikte_ekle', { aktivite: id, kisiler });
export const birlikteCikar = (id: string, kisi: string) => rpc<boolean>('birlikte_cikar', { aktivite: id, kisi });

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
      stats: $t('akis_akis.km_m', { km: formatKm(o.distance_m), duration: formatDuration(o.moving_time_s), round: Math.round(o.elevation_gain_m ?? 0) }),
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

/** "Bugün 08:12", "Dün 18:40", "7 Kas 08:12", geçen yıldansa "7 Kas 2025" */
export function akisZamani(iso: string, simdi = new Date()) {
  const d = new Date(iso);
  const saat = d.toLocaleTimeString(yerel(), { hour: '2-digit', minute: '2-digit' });
  const gun = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const fark = Math.round((gun(simdi) - gun(d)) / 86_400_000);
  if (fark === 0) return $t('akis_akis.bugun', { saat });
  if (fark === 1) return $t('akis_akis.dun', { saat });
  if (d.getFullYear() !== simdi.getFullYear()) return d.toLocaleDateString(yerel(), { day: 'numeric', month: 'short', year: 'numeric' });
  return `${d.toLocaleDateString(yerel(), { day: 'numeric', month: 'short' })} ${saat}`;
}

/** Aktivite türüne göre simge */
export function turSimgesi(t: ActivityType): 'bike' | 'run' | 'walk' {
  if (t === 'bike' || t === 'mtb') return 'bike';
  if (t === 'run' || t === 'trail_run') return 'run';
  return 'walk';
}
