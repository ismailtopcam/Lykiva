/**
 * Kişisel rekorların verisi: sunucudaki kendi aktivitelerim (izsiz, yalnızca özet sütunları) + telefonda bekleyenler.
 * Hesap `packages/shared/src/rekor.ts`'te; sunucuda yeni tablo ya da fonksiyon yok.
 */
import { aktivitininRekorlari, type ActivityType, type RekorAktivitesi, type RekorTuru } from '@lykiva/shared';
import { useEffect, useState } from 'react';

import { kuyruktakiler } from '@/kayit/kuyruk';
import { supabase, supabaseHazir } from '@/lib/supabase';
import { $t } from '@/i18n';

/** Rekor türünün adı ("En uzun mesafe") */
export function rekorAdi(tur: RekorTuru): string {
  switch (tur) {
    case 'mesafe':
      return $t('rekorlar.en_uzun_mesafe');
    case 'sure':
      return $t('rekorlar.en_uzun_sure');
    case 'hiz':
      return $t('rekorlar.en_yuksek_hiz');
    case 'tirmanis':
      return $t('rekorlar.en_cok_tirmanis');
  }
}

/**
 * Aktivite sayfası için: bu aktivite kendi türünde hangi rekorları tutuyor.
 * Yalnızca kendi aktivitende sorulur (başkasınınkinde boş). Yüklenemezse sessizce boş kalır.
 */
export function useAktiviteRekorlari(id: string | undefined, ownerId: string | null, benim: boolean): RekorTuru[] {
  const [sonuc, setSonuc] = useState<{ id: string; rekorlar: RekorTuru[] } | null>(null);
  useEffect(() => {
    if (!id || !benim) return;
    let acik = true;
    (async () => {
      const uid = ownerId ?? (supabaseHazir ? ((await supabase.auth.getSession()).data.session?.user.id ?? null) : null);
      const liste = await rekorAktiviteleri(uid);
      if (acik) setSonuc({ id, rekorlar: aktivitininRekorlari(liste, id) });
    })().catch(() => undefined);
    return () => {
      acik = false;
    };
  }, [id, ownerId, benim]);
  return sonuc && sonuc.id === id ? sonuc.rekorlar : [];
}

const SAYFA = 1000;
/** Çok uzun geçmişte telefonu yormamak için üst sınır */
const EN_FAZLA = 10_000;

/**
 * Aynı anda birden fazla ekran / kanca isterse (aktivite sayfasında rekor + rozet) tek istek atılsın:
 * aynı kullanıcı için 10 sn içindeki çağrılar aynı sonucu paylaşır.
 */
let sonIstek: { userId: string | null; zaman: number; sonuc: Promise<RekorAktivitesi[]> } | null = null;

export function rekorAktiviteleri(userId: string | null): Promise<RekorAktivitesi[]> {
  if (sonIstek && sonIstek.userId === userId && Date.now() - sonIstek.zaman < 10_000) return sonIstek.sonuc;
  const sonuc = rekorAktiviteleriniYukle(userId);
  sonIstek = { userId, zaman: Date.now(), sonuc };
  sonuc.catch(() => {
    if (sonIstek?.sonuc === sonuc) sonIstek = null;
  });
  return sonuc;
}

async function rekorAktiviteleriniYukle(userId: string | null): Promise<RekorAktivitesi[]> {
  const bekleyen = await kuyruktakiler().catch(() => []);
  const liste: RekorAktivitesi[] = bekleyen.map((p) => ({
    id: `yerel-${p.client_id}`,
    activity: p.activity,
    startedAt: Date.parse(p.started_at),
    distanceM: p.distance_m,
    movingS: p.moving_time_s,
    maxSpeedMps: p.max_speed_mps,
    gainM: p.elevation_gain_m,
    title: p.title,
  }));
  if (!userId || !supabaseHazir) return liste;
  for (let bas = 0; bas < EN_FAZLA; bas += SAYFA) {
    const { data, error } = await supabase
      .from('aktivite_ozetleri')
      .select('id,title,activity,started_at,moving_time_s,distance_m,elevation_gain_m,max_speed_mps')
      .eq('owner_id', userId)
      .order('started_at', { ascending: false })
      .range(bas, bas + SAYFA - 1);
    if (error) throw new Error(error.message);
    for (const o of data ?? []) {
      liste.push({
        id: o.id,
        activity: o.activity as ActivityType,
        startedAt: Date.parse(o.started_at),
        distanceM: o.distance_m ?? 0,
        movingS: o.moving_time_s ?? 0,
        maxSpeedMps: o.max_speed_mps,
        gainM: o.elevation_gain_m,
        title: o.title,
      });
    }
    if ((data ?? []).length < SAYFA) break;
  }
  return liste;
}
