/**
 * Kayıt sırasında canlı konum paylaşımı (isteğe bağlı): tek bir grupla ve / veya bağlantıyla.
 *
 * - Bağlantı: https://lykiva.app/c/<anahtar>; adresi bilen (uygulaması olmayan da) web'de canlı konumu, izi ve
 *   hareketsizlik uyarısını görür. Kayıt bitince ya da en geç 24 saatte kapanır
 *   (sunucu: 20261119000000_canli_baglanti.sql, web: apps/web/src/app/c/[anahtar]).
 *
 * - Yeni noktalar geldikçe en fazla 15 saniyede bir son konum sunucuya gider
 *   (arka plan konum görevi içinden de çalışır)
 * - Duraklatınca bir kez "molada" bildirilir; kayıt bitince ya da silinince sunucudaki konum silinir
 * - İnternet yoksa sessizce atlanır; 15 dakikadan eski konumu grup görmez
 */
import { computeSegmentedStats, currentSpeed, type ActivityType, type TrackPoint } from '@lykiva/shared';
import { Share } from 'react-native';

import { WEB_URL } from '@/lib/baglanti';
import { oturumuSagla, supabase, supabaseHazir } from '@/lib/supabase';
import { $t } from '@/i18n';

export type PaylasimGrubu = { id: string; ad: string };

export const GONDERIM_ARALIGI_MS = 15_000;

let sonGonderim = 0;
let gonderiyor = false;

type Durum = {
  grup: PaylasimGrubu | null;
  /** Bağlantıyla da paylaşılıyor (grup olmasa da konum gider) */
  baglanti: boolean;
  activity: ActivityType;
  segments: TrackPoint[][];
  baslangic: number;
  duraklatildi: boolean;
  sonKonum: TrackPoint | null;
};

async function gonder(d: Durum) {
  if ((!d.grup && !d.baglanti) || !supabaseHazir) return;
  const son = d.segments[d.segments.length - 1] ?? [];
  const nokta = son[son.length - 1] ?? d.sonKonum;
  if (!nokta) return;
  gonderiyor = true;
  try {
    await oturumuSagla();
    const istatistik = computeSegmentedStats(d.segments);
    await supabase.rpc('canli_konum_gonder', {
      p: {
        group_id: d.grup?.id ?? null,
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
  if ((!d.grup && !d.baglanti) || gonderiyor || Date.now() - sonGonderim < GONDERIM_ARALIGI_MS) return;
  void gonder(d);
}

/** Durum değişince (duraklat / devam) aralığı beklemeden gönderir */
export function hemenYayinla(d: Durum) {
  if (!d.grup && !d.baglanti) return;
  sonGonderim = 0;
  void gonder(d);
}

/** Canlı konum bağlantısı açar (açık bağlantı varsa aynısı döner); anahtar. İnternet yoksa hata verir */
export async function baglantiAc(): Promise<string> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc('canli_baglanti_ac');
  if (error || typeof data !== 'string') throw new Error(error?.message ?? $t('canli_baglanti.acilamadi'));
  return data;
}

export const baglantiAdresi = (anahtar: string) => `${WEB_URL}/c/${anahtar}`;

/** Telefonun paylaşım penceresi: mesaj, e-posta, WhatsApp… */
export async function baglantiyiPaylas(anahtar: string): Promise<void> {
  const adres = baglantiAdresi(anahtar);
  await Share.share({ message: $t('canli_baglanti.paylasim_metni', { adres }), url: adres }).catch(() => undefined);
}

/** Paylaşımı bitirir: sunucudaki son konumu siler, bağlantıyı kapatır */
export async function paylasimiBitir() {
  sonGonderim = 0;
  if (!supabaseHazir) return;
  try {
    await supabase.rpc('canli_konum_bitir');
  } catch {
    // internet yoksa konum 15 dakika sonra kendiliğinden görünmez olur
  }
}
