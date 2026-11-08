/**
 * Etkinliklerin sunucu tarafı. Fonksiyonlar supabase/migrations/20261109040000_etkinlikler.sql içinde.
 */
import type { ActivityType } from '@lykiva/shared';

import { oturumuSagla, supabase } from '@/lib/supabase';

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

const AY_KISA = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export const saatMetni = (d: Date) => d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

/** Tarih rozeti için: { ay: 'KAS', gun: '14' } */
export function tarihRozeti(iso: string) {
  const d = new Date(iso);
  return { ay: AY_KISA[d.getMonth()], gun: String(d.getDate()) };
}

/** "Cumartesi, 14 Kasım · 06:45" */
export function uzunTarih(iso: string) {
  const d = new Date(iso);
  return `${GUNLER[d.getDay()]}, ${d.getDate()} ${AYLAR[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''} · ${saatMetni(d)}`;
}

/** "Cmt 06:45" ya da "Bugün 06:45", "Yarın 06:45" */
export function kisaTarih(iso: string) {
  const d = new Date(iso);
  const g = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const fark = Math.round((g(d) - g(new Date())) / 86_400_000);
  const gun = fark === 0 ? 'Bugün' : fark === 1 ? 'Yarın' : fark > 1 && fark < 7 ? GUN_KISA[d.getDay()] : `${d.getDate()} ${AYLAR[d.getMonth()].slice(0, 3)}`;
  return `${gun} ${saatMetni(d)}`;
}

export const gunKisa = (d: Date) => GUN_KISA[d.getDay()];

export const ZORLUK_ADI: Record<Zorluk, string> = { easy: 'Kolay', moderate: 'Orta', hard: 'Zor' };

export const KATILIM_ADI: Record<Katilim, string> = { going: 'Katılıyor', waitlist: 'Bekleme listesinde', maybe: 'Belki', declined: 'Gelemiyor' };

/** Etkinlik bitti mi (başlangıçtan 12 saat sonra katılım kapanır) */
export const bittiMi = (iso: string) => Date.parse(iso) < Date.now() - 12 * 3600_000;

export function paylasimMetni(e: EtkinlikDetayi) {
  return [
    `${e.title}`,
    uzunTarih(e.starts_at),
    e.meeting_point_name ? `Buluşma: ${e.meeting_point_name}` : null,
    e.meeting_lat != null && e.meeting_lng != null ? `https://www.openstreetmap.org/?mlat=${e.meeting_lat.toFixed(5)}&mlon=${e.meeting_lng.toFixed(5)}#map=16/${e.meeting_lat.toFixed(5)}/${e.meeting_lng.toFixed(5)}` : null,
    e.group_name ? `${e.group_name} · Lykiva` : 'Lykiva',
  ]
    .filter(Boolean)
    .join('\n');
}
