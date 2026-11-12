import { computeSegmentedStats, haversine, type RoutePoint, type TrackStats } from '@lykiva/shared';
import { useEffect, useMemo, useState } from 'react';

import type { LngLat } from '@/data/ornek';
import { anlikHizi } from './anlikHiz';
import { aktifSure, useKayit, type Kayit } from './kaydedici';
import { $t, yerel } from '@/i18n';

/** Saniyede bir yeniden çizim için */
export function useSaat(aralikMs = 1000) {
  const [simdi, setSimdi] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setSimdi(Date.now()), aralikMs);
    return () => clearInterval(id);
  }, [aralikMs]);
  return simdi;
}

export type CanliVeri = {
  kayit: Kayit;
  stats: TrackStats;
  /** m/s; null = sinyal zayıf ya da henüz konum yok, hız bilinmiyor */
  anlikHiz: number | null;
  aktifS: number;
  iz: LngLat[];
  ben: LngLat | null;
  gpsDogruluk: number | null;
  simdi: number;
};

export function useCanliVeri(): CanliVeri {
  const kayit = useKayit();
  const simdi = useSaat();
  const stats = useMemo(() => computeSegmentedStats(kayit.segments), [kayit.segments]);
  const sk = kayit.sonKonum;
  const anlikHiz = anlikHizi(kayit, simdi);
  const iz = useMemo(() => kayit.segments.flat().map((p) => [p.lng, p.lat] as LngLat), [kayit.segments]);
  return {
    kayit,
    stats,
    anlikHiz,
    aktifS: aktifSure(kayit, simdi),
    iz,
    ben: sk ? [sk.lng, sk.lat] : null,
    gpsDogruluk: sk?.acc ?? null,
    simdi,
  };
}

export type RotaBilgisi = {
  ad: string;
  kesir: number;
  kalanM: number;
  /** Ortalama hıza göre kalan süre (sn); ortalama yoksa null */
  varisS: number | null;
  /** Tahmini varış saati "13:52" */
  varisSaati: string | null;
  sapmaM: number;
};

/** Rota takibi: ilerleme, kalan, varış (şu ana kadarki ortalama hareket hızına göre) */
export function rotaBilgisi(v: CanliVeri): RotaBilgisi | null {
  const { kayit, stats, simdi } = v;
  if (!kayit.rota) return null;
  const ilerleme = kayit.rotaIlerleme;
  // İlk GPS noktası gelene kadar ilerleme yok: kalan = rotanın tamamı
  const kalan = ilerleme ? ilerleme.remainingM : rotaUzunlugu(kayit.rota.points);
  // Ortalama hız çok düşükken (yeni başladı / hep durdu) varış tahmini anlamsız
  const varisS = stats.avgMovingSpeed > 0.3 ? kalan / stats.avgMovingSpeed : null;
  return {
    ad: kayit.rota.name,
    kesir: ilerleme?.fraction ?? 0,
    kalanM: kalan,
    varisS,
    varisSaati: varisS != null ? new Date(simdi + varisS * 1000).toLocaleTimeString(yerel(), { hour: '2-digit', minute: '2-digit' }) : null,
    sapmaM: ilerleme?.offRouteM ?? 0,
  };
}

/** "58 dk" / "1:05" */
export function kisaSure(s: number | null): { value: string; unit?: string } {
  if (s == null) return { value: '–' };
  const dk = Math.round(s / 60);
  if (dk < 60) return { value: String(dk), unit: $t('ortak.birim_dk') };
  return { value: `${Math.floor(dk / 60)}:${String(dk % 60).padStart(2, '0')}`, unit: $t('ortak.birim_sa') };
}

function rotaUzunlugu(pts: RoutePoint[]) {
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += haversine(pts[i - 1], pts[i]);
  return m;
}
