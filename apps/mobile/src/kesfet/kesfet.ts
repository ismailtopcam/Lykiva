import { kmUnit, mUnit } from '@lykiva/shared';
/**
 * Keşfet: herkese açık rotalar ve yaklaşan etkinlikler (supabase/migrations/20261110050000_kesfet.sql),
 * topluluklar (kesfet_gruplar) ve kişiler (kisi_ara).
 */
import type { ActivityType, Difficulty } from '@lykiva/shared';
import * as Location from 'expo-location';

import type { LngLat } from '@/data/ornek';
import type { EtkinlikOzeti } from '@/etkinlik/etkinlikler';
import { oturumuSagla, supabase } from '@/lib/supabase';
import { yerel } from '@/i18n';

export type KesfetRotasi = {
  id: string;
  name: string;
  activity: ActivityType;
  distance_m: number;
  elevation_gain_m: number | null;
  difficulty: Difficulty | null;
  is_loop: boolean;
  owner_id: string;
  owner_name: string;
  created_at: string;
  uzaklik_m: number | null;
  preview: number[][] | null;
};

export type KesfetEtkinligi = EtkinlikOzeti & { uzaklik_m: number | null };

async function rpc<T>(ad: string, args: Record<string, unknown>): Promise<T> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc(ad, args);
  if (error) throw new Error(error.message);
  return data as T;
}

const konumArg = (arama: string, konum: LngLat | null) => ({ arama: arama.trim() || null, lng: konum?.[0] ?? null, lat: konum?.[1] ?? null });

export const kesfetRotalar = (arama: string, konum: LngLat | null) => rpc<KesfetRotasi[]>('kesfet_rotalar', konumArg(arama, konum));
export const kesfetEtkinlikler = (arama: string, konum: LngLat | null) => rpc<KesfetEtkinligi[]>('kesfet_etkinlikler', konumArg(arama, konum));

/** Konum izni zaten verilmişse son bilinen konum; izin istemez */
export async function izinliKonum(): Promise<LngLat | null> {
  const izin = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (izin?.status !== 'granted') return null;
  const son = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 }).catch(() => null);
  const k = son ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null));
  return k ? [k.coords.longitude, k.coords.latitude] : null;
}

/** "350 m", "4,2 km", "120 km" */
export function uzaklikMetni(m: number | null) {
  if (m == null) return null;
  if (m < 1000) return `${Math.max(50, Math.round(m / 50) * 50)} ${mUnit()}`;
  if (m < 10_000) return `${(m / 1000).toLocaleString(yerel(), { maximumFractionDigits: 1 })} ${kmUnit()}`;
  return `${Math.round(m / 1000)} ${kmUnit()}`;
}
