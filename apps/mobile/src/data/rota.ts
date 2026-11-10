/**
 * Rotalar: sunucudan okuma, kaydetme, aktiviteden rota.
 * "ornek" id'si tasarım örneğini (Faralya – Kabak) gösterir.
 */
import { routeStats, type ActivityType, type Difficulty, type RoutePoint } from '@lykiva/shared';
import { useEffect, useState } from 'react';

import type { Zemin } from '@/lib/yonlendirme';
import { oturumuSagla, supabase, supabaseHazir } from '@/lib/supabase';
import { faralyaKabak, faralyaKabakRoute } from './ornek';

export type Rota = {
  id: string;
  ownerId: string | null;
  ownerName: string;
  name: string;
  activity: ActivityType;
  distanceM: number;
  gainM: number;
  lossM: number;
  difficulty: Difficulty | null;
  isLoop: boolean;
  surface: Zemin | null;
  notes: string | null;
  visibility: 'private' | 'followers' | 'groups' | 'public';
  points: RoutePoint[];
};

/** Tasarım örneği — rakımı örnek profilden dağıtılmış; mesafe/tırmanış çizgiden hesaplanır */
const ornekNoktalar: RoutePoint[] = faralyaKabakRoute.map(([lng, lat], i) => ({
  lng,
  lat,
  alt: faralyaKabak.elevation[Math.round((i / (faralyaKabakRoute.length - 1)) * (faralyaKabak.elevation.length - 1))],
}));
const ornekIstatistik = routeStats(ornekNoktalar);
const ornekRota: Rota = {
  id: 'ornek',
  ownerId: null,
  ownerName: 'Likya Yolu Yürüyüşçüleri',
  name: faralyaKabak.title,
  activity: 'hike',
  distanceM: ornekIstatistik.distanceM,
  gainM: ornekIstatistik.gainM,
  lossM: ornekIstatistik.lossM,
  difficulty: 'moderate',
  isLoop: false,
  surface: { asphalt: 0.18, gravel: 0.34, trail: 0.48 },
  notes: faralyaKabak.notes,
  visibility: 'public',
  points: ornekNoktalar,
};

type Satir = {
  id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  activity: ActivityType;
  distance_m: number;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  difficulty: Difficulty | null;
  is_loop: boolean;
  surface: Zemin | null;
  notes: string | null;
  visibility: Rota['visibility'];
  path_geojson: { coordinates: number[][] } | null;
};

function cevir(s: Satir): Rota {
  return {
    id: s.id,
    ownerId: s.owner_id,
    ownerName: s.owner_name,
    name: s.name,
    activity: s.activity,
    distanceM: s.distance_m,
    gainM: s.elevation_gain_m ?? 0,
    lossM: s.elevation_loss_m ?? 0,
    difficulty: s.difficulty,
    isLoop: s.is_loop,
    surface: s.surface,
    notes: s.notes,
    visibility: s.visibility,
    // Serbest çizimde rakım 0 olarak saklanır; 0'ları "yok" say
    points: (s.path_geojson?.coordinates ?? []).map((c) => ({ lng: c[0], lat: c[1], alt: c.length > 2 && c[2] !== 0 ? c[2] : null })),
  };
}

export async function rotaGetir(id: string): Promise<Rota> {
  if (id === 'ornek') return ornekRota;
  const { data, error } = await supabase.from('rota_ozetleri').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Rota bulunamadı ya da görme iznin yok');
  return cevir(data as Satir);
}

/** Kendi rotalarım (yeniden eskiye) */
export async function rotalarim(): Promise<Rota[]> {
  if (!supabaseHazir) return [ornekRota];
  const uid = await oturumuSagla();
  const { data, error } = await supabase.from('rota_ozetleri').select('*').eq('owner_id', uid).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data as Satir[]).map(cevir);
}

export type RotaPaketi = {
  id?: string;
  name: string;
  activity: ActivityType;
  points: RoutePoint[];
  difficulty: Difficulty;
  surface: Zemin | null;
  notes?: string;
  visibility: Rota['visibility'];
};

export async function rotaKaydet(p: RotaPaketi): Promise<string> {
  if (!supabaseHazir) throw new Error('Sunucu anahtarı girilmemiş (apps/mobile/.env)');
  await oturumuSagla();
  const s = routeStats(p.points);
  const { data, error } = await supabase.rpc('kaydet_rota', {
    p: {
      ...(p.id ? { id: p.id } : {}),
      name: p.name,
      activity: p.activity,
      distance_m: Math.round(s.distanceM),
      elevation_gain_m: Math.round(s.gainM),
      elevation_loss_m: Math.round(s.lossM),
      difficulty: p.difficulty,
      is_loop: s.isLoop,
      surface: p.surface,
      notes: p.notes ?? '',
      visibility: p.visibility,
      points: p.points.map((pt) => ({ lat: Math.round(pt.lat * 1e6) / 1e6, lng: Math.round(pt.lng * 1e6) / 1e6, alt: pt.alt == null ? null : Math.round(pt.alt) })),
    },
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function aktivitedenRota(aktiviteId: string, ad: string): Promise<string> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc('aktiviteden_rota', { aktivite: aktiviteId, ad });
  if (error) throw new Error(error.message);
  return data as string;
}

export type RotaAyari = { name: string; notes: string | null; visibility: Rota['visibility'] };

const rotaDinleyicileri = new Set<(id: string, d: Partial<RotaAyari> | null) => void>();
const rotaDegisti = (id: string, d: Partial<RotaAyari> | null) => rotaDinleyicileri.forEach((f) => f(id, d));
/** Rota düzenlenince (d) ya da silinince (null) haber verir */
export function rotaDegisikliginiDinle(f: (id: string, d: Partial<RotaAyari> | null) => void) {
  rotaDinleyicileri.add(f);
  return () => {
    rotaDinleyicileri.delete(f);
  };
}

/** Sahibi için: ad, not ve görünürlük */
export async function rotaGuncelle(id: string, ayar: RotaAyari) {
  const yeni = { name: ayar.name.trim().slice(0, 80), notes: ayar.notes?.trim() || null, visibility: ayar.visibility };
  if (yeni.name.length < 1) throw new Error('Rotaya bir ad ver.');
  const { error } = await supabase.from('routes').update(yeni).eq('id', id);
  if (error) throw new Error(error.message);
  rotaDegisti(id, yeni);
}

/** Sahibi için: rotayı kalıcı olarak siler (grup paylaşımları da gider; etkinlikler rotasız kalır) */
export async function rotaSil(id: string) {
  const { error, count } = await supabase.from('routes').delete({ count: 'exact' }).eq('id', id);
  if (error) throw new Error(error.message);
  if (!count) throw new Error('Rota silinemedi');
  rotaDegisti(id, null);
}

export function useRota(id: string | undefined) {
  const [durum, setDurum] = useState<{ r: Rota | null; hata: string | null; id?: string }>({ r: null, hata: null });
  useEffect(
    () =>
      rotaDegisikliginiDinle((degisen, d) => {
        if (d) setDurum((x) => (x.r && x.r.id === degisen ? { ...x, r: { ...x.r, ...d } } : x));
      }),
    [],
  );
  useEffect(() => {
    if (!id) return;
    let iptal = false;
    rotaGetir(id)
      .then((r) => !iptal && setDurum({ r, hata: null, id }))
      .catch((e) => !iptal && setDurum({ r: null, hata: e instanceof Error ? e.message : 'Yüklenemedi', id }));
    return () => {
      iptal = true;
    };
  }, [id]);
  if (durum.id !== id) return { r: null, hata: null, yukleniyor: true };
  return { ...durum, yukleniyor: false };
}
