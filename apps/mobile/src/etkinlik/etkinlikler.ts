/**
 * Etkinliklerin sunucu tarafı. Fonksiyonlar supabase/migrations/20261109040000_etkinlikler.sql içinde.
 */
import type { ActivityType } from '@lykiva/shared';

import { oturumuSagla, supabase } from '@/lib/supabase';
import { $t, yerel } from '@/i18n';

export type Katilim = 'going' | 'waitlist' | 'maybe' | 'declined';
export type Zorluk = 'easy' | 'moderate' | 'hard';

export type EtkinlikOzeti = {
  id: string;
  title: string;
  activity: ActivityType;
  starts_at: string;
  group_id: string | null;
  group_name: string | null;
  meeting_point_name: string | null;
  capacity: number | null;
  difficulty: Zorluk | null;
  visibility: 'groups' | 'public' | 'private' | 'followers';
  going_count: number;
  my_status: Katilim | null;
};

export type EtkinlikDetayi = EtkinlikOzeti & {
  description: string | null;
  created_by: string;
  creator_name: string;
  meeting_lng: number | null;
  meeting_lat: number | null;
  maybe_count: number;
  waitlist_count: number;
  can_manage: boolean;
  is_member: boolean;
  attendees: { user_id: string; status: Katilim; display_name: string }[];
  route: { id: string; name: string; distance_m: number; elevation_gain_m: number | null; is_loop: boolean; coordinates: number[][] | null } | null;
};

export type YeniEtkinlik = {
  title: string;
  description?: string;
  activity: ActivityType;
  starts_at: string;
  group_id?: string | null;
  visibility?: 'groups' | 'public';
  route_id?: string | null;
  meeting_lng?: number | null;
  meeting_lat?: number | null;
  meeting_point_name?: string;
  difficulty?: Zorluk | null;
  capacity?: number | null;
};

async function rpc<T>(ad: string, args?: Record<string, unknown>): Promise<T> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc(ad, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const etkinlikOlustur = (p: YeniEtkinlik) => rpc<string>('etkinlik_olustur', { p });
export const etkinlikDetayi = (id: string) => rpc<EtkinlikDetayi | null>('etkinlik_detay', { e: id });
/** Dönen değer kaydedilen durum: kontenjan doluysa "going" isteği "waitlist" olur */
export const katilimBildir = (id: string, durum: Exclude<Katilim, 'waitlist'>) => rpc<Katilim>('katilim_bildir', { e: id, durum });
export const grupEtkinlikleri = (grup: string) => rpc<EtkinlikOzeti[]>('grup_etkinlikleri', { g: grup });
export const yaklasanEtkinlikler = () => rpc<EtkinlikOzeti[]>('yaklasan_etkinlikler');
export const etkinlikSil = (id: string) => rpc<void>('etkinlik_sil', { e: id });

/* ------------------------------------------------------------------ */
/* Biçimlendirme                                                       */
/* ------------------------------------------------------------------ */

export const saatMetni = (d: Date) => d.toLocaleTimeString(yerel(), { hour: '2-digit', minute: '2-digit' });

/** Tarih rozeti için: { ay: 'KAS', gun: '14' } */
export function tarihRozeti(iso: string) {
  const d = new Date(iso);
  return { ay: d.toLocaleDateString(yerel(), { month: 'short' }).replace('.', '').toLocaleUpperCase(yerel()), gun: String(d.getDate()) };
}

/** "14 Kasım Cumartesi · 06:45" (dilin tarih düzeniyle) */
export function uzunTarih(iso: string) {
  const d = new Date(iso);
  const yil = d.getFullYear() !== new Date().getFullYear();
  return `${d.toLocaleDateString(yerel(), { weekday: 'long', day: 'numeric', month: 'long', ...(yil ? { year: 'numeric' } : {}) })} · ${saatMetni(d)}`;
}

/** "Cmt 06:45" ya da "Bugün 06:45", "Yarın 06:45" */
export function kisaTarih(iso: string) {
  const d = new Date(iso);
  const g = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const fark = Math.round((g(d) - g(new Date())) / 86_400_000);
  const gun = fark === 0 ? $t('etkinlik_etkinlikler.bugun') : fark === 1 ? $t('etkinlik_etkinlikler.yarin') : fark > 1 && fark < 7 ? gunKisa(d) : d.toLocaleDateString(yerel(), { day: 'numeric', month: 'short' });
  return `${gun} ${saatMetni(d)}`;
}

export const gunKisa = (d: Date) => d.toLocaleDateString(yerel(), { weekday: 'short' });

export const ZORLUK_ADI = (): Record<Zorluk, string> => ({ easy: $t('etkinlik_etkinlikler.kolay'), moderate: $t('etkinlik_etkinlikler.orta'), hard: $t('etkinlik_etkinlikler.zor') });

export const KATILIM_ADI = (): Record<Katilim, string> => ({ going: $t('etkinlik_etkinlikler.katiliyor'), waitlist: $t('etkinlik_etkinlikler.bekleme_listesinde'), maybe: $t('etkinlik_etkinlikler.belki'), declined: $t('etkinlik_etkinlikler.gelemiyor') });

/** Etkinlik bitti mi (başlangıçtan 12 saat sonra katılım kapanır) */
export const bittiMi = (iso: string) => Date.parse(iso) < Date.now() - 12 * 3600_000;

export function paylasimMetni(e: EtkinlikDetayi) {
  return [
    `${e.title}`,
    uzunTarih(e.starts_at),
    e.meeting_point_name ? $t('etkinlik_etkinlikler.bulusma', { meeting_point_name: e.meeting_point_name }) : null,
    e.meeting_lat != null && e.meeting_lng != null ? `https://www.openstreetmap.org/?mlat=${e.meeting_lat.toFixed(5)}&mlon=${e.meeting_lng.toFixed(5)}#map=16/${e.meeting_lat.toFixed(5)}/${e.meeting_lng.toFixed(5)}` : null,
    e.group_name ? $t('etkinlik_etkinlikler.lykiva', { group_name: e.group_name }) : 'Lykiva',
  ]
    .filter(Boolean)
    .join('\n');
}
