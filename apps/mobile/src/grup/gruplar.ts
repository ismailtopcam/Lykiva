/**
 * Grupların sunucu tarafı. Fonksiyonlar supabase/migrations/20261109030000_gruplar.sql içinde;
 * üyelik değişiklikleri yalnızca bu fonksiyonlarla yapılır.
 */
import { ACTIVITY_LABELS, type ActivityType } from '@lykiva/shared';

import type { AvatarTone, LngLat } from '@/data/ornek';
import { oturumuSagla, supabase } from '@/lib/supabase';

export type Rol = 'owner' | 'admin' | 'member';

export type GrupOzeti = {
  id: string;
  name: string;
  is_community: boolean;
  is_private: boolean;
  primary_activity: ActivityType | null;
  city: string | null;
  my_role: Rol;
  member_count: number;
  last_message: string | null;
  last_message_type: string | null;
  last_message_at: string | null;
  last_sender: string | null;
  unread: number;
};

export type KesfetGrubu = {
  id: string;
  name: string;
  description: string | null;
  is_community: boolean;
  requires_approval: boolean;
  primary_activity: ActivityType | null;
  city: string | null;
  member_count: number;
  requested: boolean;
};

export type GrupDetayi = {
  id: string;
  name: string;
  description: string | null;
  is_community: boolean;
  is_private: boolean;
  requires_approval: boolean;
  primary_activity: ActivityType | null;
  city: string | null;
  created_at: string;
  member_count: number;
  my_role: Rol | null;
  requested: boolean;
  invite_code: string | null;
  pending_count: number;
};

export type Uye = { user_id: string; role: Rol; joined_at: string; display_name: string; username: string; avatar_url: string | null };
export type Istek = { user_id: string; display_name: string; username: string; avatar_url: string | null; created_at: string };
export type GrupRotasi = {
  id: string;
  name: string;
  activity: ActivityType;
  distance_m: number;
  elevation_gain_m: number | null;
  is_loop: boolean;
  owner_name: string;
  shared_at: string;
  preview: number[][] | null;
};

async function rpc<T>(ad: string, args?: Record<string, unknown>): Promise<T> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc(ad, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const gruplarim = () => rpc<GrupOzeti[]>('gruplarim');
export const kesfetGruplar = (arama?: string) => rpc<KesfetGrubu[]>('kesfet_gruplar', { arama: arama?.trim() || null });
export const grupDetayi = (id: string) => rpc<GrupDetayi | null>('grup_detay', { g: id });
export const grupUyeleri = (id: string) => rpc<Uye[]>('grup_uyeleri', { g: id });
export const bekleyenIstekler = (id: string) => rpc<Istek[]>('bekleyen_istekler', { g: id });
export const grupRotalari = (id: string) => rpc<GrupRotasi[]>('grup_rotalari', { g: id });

export type YeniGrup = {
  name: string;
  description?: string;
  primary_activity?: ActivityType | null;
  city?: string;
  is_private: boolean;
  is_community: boolean;
  requires_approval: boolean;
};
export const grupOlustur = (p: YeniGrup) => rpc<string>('grup_olustur', { p });

/** 'uye': katıldın; 'istek': onay bekliyor */
export const grubaKatil = (id: string) => rpc<'uye' | 'istek'>('gruba_katil', { g: id });
export const istegiGeriAl = (id: string) => rpc<void>('istegi_geri_al', { g: id });
export const davetleKatil = (kod: string) => rpc<string>('davetle_katil', { kod });
export const istegiYanitla = (id: string, kullanici: string, kabul: boolean) => rpc<void>('istegi_yanitla', { g: id, kullanici, kabul });
export const gruptanAyril = (id: string) => rpc<void>('gruptan_ayril', { g: id });
export const uyeCikar = (id: string, kullanici: string) => rpc<void>('uye_cikar', { g: id, kullanici });
export const uyeRoluDegistir = (id: string, kullanici: string, yonetici: boolean) => rpc<void>('uye_rolu_degistir', { g: id, kullanici, yonetici });
export const davetKoduYenile = (id: string) => rpc<string>('davet_kodu_yenile', { g: id });
/** Grubun şu an canlı konum paylaşan üye sayısı */
export const grupCanliSayisi = (id: string) => rpc<number>('grup_canli_sayisi', { g: id });
export const okunduIsaretle = (id: string) => rpc<void>('okundu_isaretle', { g: id });
export const rotayiGrubaPaylas = (rota: string, grup: string, notu?: string) => rpc<string>('rotayi_gruba_paylas', { rota, g: grup, notu: notu ?? null });

/* ------------------------------------------------------------------ */
/* Görünüm yardımcıları                                                */
/* ------------------------------------------------------------------ */

export const ROL_ADI: Record<Rol, string> = { owner: 'Sahip', admin: 'Yönetici', member: 'Üye' };

/** "PK" gibi baş harfler */
export function basHarfler(ad: string) {
  return (
    ad
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 2)
      .toLocaleUpperCase('tr-TR') || '?'
  );
}

/** Ada göre sabit renk */
export function grupRengi(id: string): AvatarTone {
  const tonlar: AvatarTone[] = ['sea', 'terra', 'ink', 'green', 'sand'];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return tonlar[h % tonlar.length];
}

export function uyeSayisi(n: number) {
  return n >= 1000 ? `${(n / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} B üye` : `${n} üye`;
}

/** "Bisiklet grubu · Kaş" / "Topluluk · Antalya" */
export function grupEtiketi(g: { is_community: boolean; primary_activity: ActivityType | null; city: string | null }) {
  const tur = g.is_community ? 'Topluluk' : g.primary_activity ? `${ACTIVITY_LABELS[g.primary_activity]} grubu` : 'Grup';
  return [tur, g.city].filter(Boolean).join(' · ');
}

export const onizleme = (p: number[][] | null): LngLat[] => (p ?? []).map((c) => [c[0], c[1]] as LngLat);

/** Paylaşılacak davet metni */
export function davetMetni(ad: string, kod: string) {
  return `Lykiva'da "${ad}" grubuna katıl.\nDavet kodu: ${kod}\nlykiva://davet/${kod}`;
}

/** "14:05", "Dün", "12 Kas" */
export function kisaZaman(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const simdi = new Date();
  const gun = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const fark = Math.round((gun(simdi) - gun(d)) / 86_400_000);
  if (fark === 0) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (fark === 1) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}
