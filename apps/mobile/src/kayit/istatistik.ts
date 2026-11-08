import { computeSegmentedStats, currentSpeed, type TrackStats } from '@lykiva/shared';
import { useEffect, useMemo, useState } from 'react';

import type { LngLat } from '@/data/ornek';
import { aktifSure, useKayit, type Kayit } from './kaydedici';

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
  anlikHiz: number;
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
  const son = kayit.segments[kayit.segments.length - 1] ?? [];
  // 10 sn'den eski son nokta varsa hız 0 kabul edilir (sinyal yok ya da duruyor)
  const taze = son.length > 0 && simdi - son[son.length - 1].t < 10_000;
  const anlikHiz = kayit.durum === 'kayitta' && taze ? currentSpeed(son) : 0;
  const iz = useMemo(() => kayit.segments.flat().map((p) => [p.lng, p.lat] as LngLat), [kayit.segments]);
  const sk = kayit.sonKonum;
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
