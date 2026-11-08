import { computeSegmentedStats, currentSpeed, etaSeconds, rotaUzunlugu, ROTADAN_SAPMA_M, type TrackStats } from '@lykiva/shared';
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

export type RotaDurumu = {
  ad: string;
  plan: LngLat[];
  totalM: number;
  doneM: number;
  remainingM: number;
  /** Rotaya uzaklık (m) */
  sapmaM: number;
  rotaDisinda: boolean;
  /** Hareket hâlindeki ortalama hızla kalan süre (s); henüz hız yoksa null */
  kalanS: number | null;
  /** 0..1 */
  oran: number;
};

export type CanliVeri = {
  kayit: Kayit;
  stats: TrackStats;
  anlikHiz: number;
  aktifS: number;
  iz: LngLat[];
  ben: LngLat | null;
  gpsDogruluk: number | null;
  simdi: number;
  rota: RotaDurumu | null;
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

  // İlerleme kaydedicide her yeni noktada hesaplanır (arka planda da); burada yalnızca gösterilir
  const plan = useMemo(() => (kayit.rota?.noktalar ?? []) as LngLat[], [kayit.rota]);
  const totalM = useMemo(() => rotaUzunlugu(plan.map(([lng, lat]) => ({ lng, lat }))), [plan]);
  let rota: RotaDurumu | null = null;
  if (kayit.rota && plan.length > 1) {
    const ilerleme = kayit.rotaIlerleme;
    const doneM = Math.min(totalM, ilerleme?.m ?? 0);
    const remainingM = Math.max(0, totalM - doneM);
    rota = {
      ad: kayit.rota.ad,
      plan,
      totalM,
      doneM,
      remainingM,
      sapmaM: ilerleme?.sapmaM ?? 0,
      rotaDisinda: !!ilerleme && ilerleme.sapmaM > ROTADAN_SAPMA_M,
      kalanS: stats.movingS > 60 ? etaSeconds(remainingM, stats.avgMovingSpeed) : null,
      oran: totalM > 0 ? doneM / totalM : 0,
    };
  }

  return {
    kayit,
    stats,
    anlikHiz,
    aktifS: aktifSure(kayit, simdi),
    iz,
    ben: sk ? [sk.lng, sk.lat] : null,
    gpsDogruluk: sk?.acc ?? null,
    simdi,
    rota,
  };
}
