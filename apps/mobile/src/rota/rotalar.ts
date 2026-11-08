/**
 * Rotaların sunucu tarafı: kaydet, listele, ayrıntı, aktiviteden rota, sil.
 * Fonksiyonlar supabase/migrations/20261110000000_rotalar.sql içinde.
 */
import { type ActivityType, type ZeminDagilimi } from '@lykiva/shared';
import { useCallback, useEffect, useState } from 'react';

import type { LngLat } from '@/data/ornek';
import { oturumuSagla, supabase, supabaseHazir } from '@/lib/supabase';
import type { RotaKoordinati } from './yonlendirme';

export type RotaOzeti = {
  id: string;
  ownerId: string;
  ad: string;
  activity: ActivityType;
  mesafeM: number;
  tirmanisM: number | null;
  dongu: boolean;
  onizleme: LngLat[];
  sahipAdi: string;
  olusturuldu: number;
};

export type RotaDetayi = RotaOzeti & {
  inisM: number | null;
  zemin: ZeminDagilimi | null;
  notlar: string | null;
  gorunurluk: 'private' | 'followers' | 'groups' | 'public';
  koordinatlar: RotaKoordinati[];
  yapilmaSayisi: number;
};

export type YeniRota = {
  name: string;
  activity: ActivityType;
  points: RotaKoordinati[];
  distance_m: number;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  is_loop: boolean;
  /** 0..1 oranlar */
  surface: ZeminDagilimi | null;
};

export async function rotaKaydet(r: YeniRota): Promise<string> {
  if (!supabaseHazir) throw new Error('Sunucu anahtarı girilmemiş (apps/mobile/.env)');
  await oturumuSagla();
  const p = {
    ...r,
    points: r.points.map(([x, y, z]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6, z == null ? null : Math.round(z * 10) / 10]),
    distance_m: Math.round(r.distance_m * 10) / 10,
  };
  const { data, error } = await supabase.rpc('rota_kaydet', { p });
  if (error || typeof data !== 'string') throw error ?? new Error('Rota kaydedilemedi');
  return data;
}

type OzetSatiri = {
  id: string;
  owner_id: string;
  name: string;
  activity: ActivityType;
  distance_m: number;
  elevation_gain_m: number | null;
  is_loop: boolean;
  created_at: string;
  preview_geojson: { coordinates?: number[][] } | null;
  owner_name: string;
};

function ozet(o: OzetSatiri): RotaOzeti {
  return {
    id: o.id,
    ownerId: o.owner_id,
    ad: o.name,
    activity: o.activity,
    mesafeM: o.distance_m,
    tirmanisM: o.elevation_gain_m,
    dongu: o.is_loop,
    onizleme: (o.preview_geojson?.coordinates ?? []).map((c) => [c[0], c[1]] as LngLat),
    sahipAdi: o.owner_name,
    olusturuldu: Date.parse(o.created_at),
  };
}

/** Kendi rotalarım (en yeni önce) */
export async function rotalarim(): Promise<RotaOzeti[]> {
  if (!supabaseHazir) return [];
  const uid = await oturumuSagla();
  const { data, error } = await supabase
    .from('rota_ozetleri')
    .select('id,owner_id,name,activity,distance_m,elevation_gain_m,is_loop,created_at,preview_geojson,owner_name')
    .eq('owner_id', uid)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as OzetSatiri[]).map(ozet);
}

export async function rotaDetayi(id: string): Promise<RotaDetayi | null> {
  if (!supabaseHazir) return null;
  await oturumuSagla();
  const { data, error } = await supabase.rpc('rota_detay', { rota: id });
  if (error) throw error;
  if (!data) return null;
  const d = data as {
    id: string;
    owner_id: string;
    owner_name: string;
    name: string;
    activity: ActivityType;
    distance_m: number;
    elevation_gain_m: number | null;
    elevation_loss_m: number | null;
    is_loop: boolean;
    surface: ZeminDagilimi | null;
    notes: string | null;
    visibility: RotaDetayi['gorunurluk'];
    created_at: string;
    coordinates: number[][] | null;
    done_count: number;
  };
  const koordinatlar = (d.coordinates ?? []).map((c) => [c[0], c[1], c.length > 2 ? c[2] : null] as RotaKoordinati);
  return {
    id: d.id,
    ownerId: d.owner_id,
    ad: d.name,
    activity: d.activity,
    mesafeM: d.distance_m,
    tirmanisM: d.elevation_gain_m,
    inisM: d.elevation_loss_m,
    dongu: d.is_loop,
    onizleme: koordinatlar.map((c) => [c[0], c[1]] as LngLat),
    sahipAdi: d.owner_name,
    olusturuldu: Date.parse(d.created_at),
    zemin: d.surface,
    notlar: d.notes,
    gorunurluk: d.visibility,
    koordinatlar,
    yapilmaSayisi: Number(d.done_count) || 0,
  };
}

export async function aktivitedenRota(aktiviteId: string, ad: string): Promise<string> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc('aktiviteden_rota', { aktivite: aktiviteId, ad });
  if (error || typeof data !== 'string') throw error ?? new Error('Rota oluşturulamadı');
  return data;
}

export async function rotaSil(id: string) {
  const { error } = await supabase.from('routes').delete().eq('id', id);
  if (error) throw error;
}

/** Rota uuid'si mi (yoksa tasarım örneği gibi bir ad mı) */
export const rotaIdsiMi = (id: string | undefined) => !!id && /^[0-9a-f-]{36}$/i.test(id);

export function useRota(id: string | undefined) {
  const [sonuc, setSonuc] = useState<{ id: string; rota: RotaDetayi | null; hata: string | null } | null>(null);
  useEffect(() => {
    if (!id || !rotaIdsiMi(id)) return;
    let acik = true;
    rotaDetayi(id)
      .then((rota) => acik && setSonuc({ id, rota, hata: rota ? null : 'Rota bulunamadı ya da görme iznin yok' }))
      .catch((e: unknown) => acik && setSonuc({ id, rota: null, hata: e instanceof Error ? e.message : 'Rota yüklenemedi' }));
    return () => {
      acik = false;
    };
  }, [id]);
  const guncel = sonuc && sonuc.id === id ? sonuc : null;
  return { rota: guncel?.rota ?? null, yukleniyor: rotaIdsiMi(id) && !guncel, hata: guncel?.hata ?? null };
}

export function useRotalarim() {
  const [liste, setListe] = useState<RotaOzeti[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const yenile = useCallback(async () => {
    try {
      setHata(null);
      setListe(await rotalarim());
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Rotalar yüklenemedi');
      setListe((l) => l ?? []);
    }
  }, []);
  return { liste, hata, yenile };
}
