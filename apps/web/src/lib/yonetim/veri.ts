/**
 * Yönetim paneli verisi: supabase/migrations/20261110060000_yonetim.sql fonksiyonları.
 * Her çağrı oturumdaki kullanıcının jetonuyla yapılır; yönetici değilse ya da oturum geçersizse giriş sayfasına gider.
 */
import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { CEREZ, oturumuCoz, rpcCagir } from './oturum';

export class YonetimHatasi extends Error {}

export async function yonetimRpc<T>(ad: string, args: Record<string, unknown> = {}): Promise<T> {
  const oturum = oturumuCoz((await cookies()).get(CEREZ)?.value);
  if (!oturum) redirect('/admin/giris');
  const s = await rpcCagir(oturum.a, ad, args);
  if (s.ok) return s.veri as T;
  // Jeton geçersiz ya da yönetici değil
  if (s.durum === 401 || s.kod === '42501' || s.kod === 'PGRST301' || s.kod === 'PGRST303') redirect('/admin/giris?yetki=yok');
  throw new YonetimHatasi(s.mesaj);
}

export type Sayfa<T> = { toplam: number; satirlar: T[] };

export type Ozet = {
  kullanici: number;
  gecici: number;
  yeni_kullanici_7g: number;
  aktif_7g: number;
  aktivite: number;
  aktivite_7g: number;
  rota_acik: number;
  grup: number;
  topluluk: number;
  etkinlik_yaklasan: number;
  sikayet_acik: number;
  canli: number;
  gunluk: { gun: string; aktivite: number; kayit: number }[];
};

export type KullaniciSatiri = {
  id: string;
  display_name: string;
  username: string;
  email: string | null;
  city: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  /** Supabase Auth'ta engelli (giriş yapamaz); eski sunucu fonksiyonunda gelmez */
  engelli?: boolean;
  gecici: boolean;
  aktivite: number;
  takipci: number;
  sikayet: number;
};

export type AktiviteSatiri = {
  id: string;
  title: string | null;
  activity: string;
  started_at: string;
  distance_m: number;
  moving_time_s: number;
  visibility: string;
  owner_id: string;
  owner_name: string;
  owner_username: string;
  begeni: number;
  yorum: number;
  sikayet: number;
};

export type RotaSatiri = {
  id: string;
  name: string;
  activity: string;
  distance_m: number;
  elevation_gain_m: number | null;
  visibility: string;
  created_at: string;
  owner_id: string;
  owner_name: string;
  sikayet: number;
};

export type GrupSatiri = {
  id: string;
  name: string;
  is_community: boolean;
  is_private: boolean;
  requires_approval: boolean;
  city: string | null;
  created_at: string;
  kuran: string;
  uye: number;
  mesaj_7g: number;
  sikayet: number;
};

export type EtkinlikSatiri = {
  id: string;
  title: string;
  activity: string;
  starts_at: string;
  visibility: string;
  capacity: number | null;
  grup: string | null;
  olusturan: string;
  meeting_point_name: string | null;
  katilan: number;
  sikayet: number;
};

export type SikayetSatiri = {
  id: string;
  target_type: 'user' | 'activity' | 'route' | 'message' | 'group' | 'event' | 'comment';
  target_id: string;
  reason: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  admin_note: string | null;
  created_at: string;
  bildiren: string;
  hedef: { ad: string; alt: string } | null;
  ayni_hedef: number;
};

/** Sayfa parametreleri: ?q=…&sayfa=… */
export async function liste(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : '';
  const sayfa = Math.max(0, Number.parseInt(typeof sp.sayfa === 'string' ? sp.sayfa : '0', 10) || 0);
  return { q, sayfa, sp };
}
