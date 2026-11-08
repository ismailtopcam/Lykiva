/**
 * Kayıt sırasında canlı konum paylaşımı (isteğe bağlı, tek bir grupla).
 *
 * - Yeni noktalar geldikçe en fazla 15 saniyede bir son konum sunucuya gider
 *   (arka plan konum görevi içinden de çalışır)
 * - Duraklatınca bir kez "molada" bildirilir; kayıt bitince ya da silinince sunucudaki konum silinir
 * - İnternet yoksa sessizce atlanır; 15 dakikadan eski konumu grup görmez
 */
import { computeSegmentedStats, currentSpeed, type ActivityType, type TrackPoint } from '@lykiva/shared';

import { oturumuSagla, supabase, supabaseHazir } from '@/lib/supabase';

export type PaylasimGrubu = { id: string; ad: string };

export const GONDERIM_ARALIGI_MS = 15_000;

let sonGonderim = 0;
let gonderiyor = false;

type Durum = {
  grup: PaylasimGrubu | null;
  activity: ActivityType;
  segments: TrackPoint[][];
  baslangic: number;
  duraklatildi: boolean;
  sonKonum: TrackPoint | null;
};

async function gonder(d: Durum) {
  if (!d.grup || !supabaseHazir) return;
  const son = d.segments[d.segments.length - 1] ?? [];
  const nokta = son[son.length - 1] ?? d.sonKonum;
  if (!nokta) return;
  gonderiyor = true;
  try {
    await oturumuSagla();
    const istatistik = computeSegmentedStats(d.segments);
    await supabase.rpc('canli_konum_gonder', {
      p: {
        group_id: d.grup.id,
        lng: Math.round(nokta.lng * 1e6) / 1e6,
        lat: Math.round(nokta.lat * 1e6) / 1e6,
        activity: d.activity,
        speed_mps: d.duraklatildi ? 0 : Math.round(currentSpeed(son) * 100) / 100,
        is_paused: d.duraklatildi,
        distance_m: Math.round(istatistik.distanceM),
        started_at: new Date(d.baslangic).toISOString(),
      },
    });
    sonGonderim = Date.now();
  } catch {
    // internet yok ya da oturum açılamadı — bir sonraki noktada tekrar denenir
  } finally {
    gonderiyor = false;
  }
}

/** Yeni nokta geldikçe çağrılır; aralık dolmadıysa bir şey yapmaz */
export function konumYayinla(d: Durum) {
  if (!d.grup || gonderiyor || Date.now() - sonGonderim < GONDERIM_ARALIGI_MS) return;
  void gonder(d);
}

/** Durum değişince (duraklat / devam) aralığı beklemeden gönderir */
export function hemenYayinla(d: Durum) {
  if (!d.grup) return;
  sonGonderim = 0;
  void gonder(d);
}

/** Paylaşımı bitirir: sunucudaki son konumu siler */
export async function paylasimiBitir() {
  sonGonderim = 0;
  if (!supabaseHazir) return;
  try {
    await supabase.rpc('canli_konum_bitir');
  } catch {
    // internet yoksa konum 15 dakika sonra kendiliğinden görünmez olur
  }
}
