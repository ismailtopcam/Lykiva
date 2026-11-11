/**
 * Rozetlerin adı, açıklaması, ikonu ve verisi. Hesap `packages/shared/src/rozet.ts`'te (telefonda);
 * veri: kendi aktivitelerim (data/rekor.ts) + tamamladığım meydan okumalar.
 */
import { formatKm, formatMeters, kmUnit, mUnit, rozetDurumlari, aktivitininRozetleri, type RozetDurumu, type RozetKademe, type RozetTanimi } from '@lykiva/shared';
import { useEffect, useState } from 'react';

import type { IconName } from '@/components/Icon';
import { tamamladigimMeydanOkumalar } from '@/data/meydanOkuma';
import { rekorAktiviteleri } from '@/data/rekor';
import { supabase, supabaseHazir } from '@/lib/supabase';
import { colors } from '@/theme';
import { $t, type Anahtar } from '@/i18n';

export async function rozetVerisi(userId: string | null): Promise<RozetDurumu[]> {
  const [liste, meydan] = await Promise.all([rekorAktiviteleri(userId), userId ? tamamladigimMeydanOkumalar() : Promise.resolve([])]);
  return rozetDurumlari(liste, meydan);
}

export function rozetAdi(t: RozetTanimi): string {
  return $t(`rozet.ad_${t.id}` as Anahtar);
}

/** "Toplam 500 km" gibi koşul */
export function rozetKosulu(t: RozetTanimi): string {
  const km = `${formatKm(t.esik).replace(/[.,]0$/, '')} ${kmUnit()}`;
  const m = `${formatMeters(t.esik)} ${mUnit()}`;
  switch (t.kural.tur) {
    case 'sayi':
      return $t('rozet.kosul_sayi', { n: t.esik });
    case 'mesafe':
      return $t('rozet.kosul_mesafe', { km });
    case 'tirmanis':
      return $t('rozet.kosul_tirmanis', { m });
    case 'sure':
      return $t('rozet.kosul_sure', { n: t.esik / 3600 });
    case 'tek_mesafe':
      return t.kural.turler.includes('bike')
        ? $t('rozet.kosul_tek_bisiklet', { km })
        : t.kural.turler.includes('run')
          ? $t('rozet.kosul_tek_kosu', { km })
          : $t('rozet.kosul_tek_yuruyus', { km });
    case 'tek_tirmanis':
      return $t('rozet.kosul_tek_tirmanis', { m });
    case 'seri':
      return $t('rozet.kosul_seri', { n: t.esik });
    case 'erken':
      return $t('rozet.kosul_erken');
    case 'cesit':
      return $t('rozet.kosul_cesit', { n: t.esik });
    case 'meydan':
      return $t('rozet.kosul_meydan', { n: t.esik });
  }
}

/** İlerleme metni ("312 / 500 km"); kazanıldıysa ya da anlamsızsa null */
export function rozetIlerlemesi(d: RozetDurumu): string | null {
  if (d.kazanildi) return null;
  const t = d.tanim;
  switch (t.kural.tur) {
    case 'mesafe':
    case 'tek_mesafe':
      return `${formatKm(d.deger)} / ${formatKm(t.esik).replace(/[.,]0$/, '')} ${kmUnit()}`;
    case 'tirmanis':
    case 'tek_tirmanis':
      return `${formatMeters(d.deger)} / ${formatMeters(t.esik)} ${mUnit()}`;
    case 'sure':
      return `${Math.floor(d.deger / 3600)} / ${t.esik / 3600} ${$t('ortak.birim_sa')}`;
    case 'erken':
      return null;
    default:
      return `${d.deger} / ${t.esik}`;
  }
}

export function rozetIkonu(t: RozetTanimi): IconName {
  switch (t.kural.tur) {
    case 'sayi':
      return t.id === 'ilk_adim' ? 'star' : 'flag';
    case 'mesafe':
      return 'route';
    case 'tirmanis':
    case 'tek_tirmanis':
      return 'mountain';
    case 'sure':
      return 'clock';
    case 'tek_mesafe':
      return t.kural.turler.includes('bike') ? 'bike' : t.kural.turler.includes('run') ? 'run' : 'walk';
    case 'seri':
      return 'flame';
    case 'erken':
      return 'sunrise';
    case 'cesit':
      return 'layers';
    case 'meydan':
      return 'medal';
  }
}

/** Kademeye göre renk: 1 kiremit, 2 deniz, 3 hardal, 4 koyu */
export function kademeRengi(k: RozetKademe): { bg: string; fg: string } {
  switch (k) {
    case 1:
      return { bg: colors.terraSoft, fg: colors.terraInk };
    case 2:
      return { bg: colors.seaSoft, fg: colors.seaInk };
    case 3:
      return { bg: '#F1E1BE', fg: '#6A4A12' };
    case 4:
      return { bg: colors.ink, fg: colors.ground };
  }
}

/**
 * Aktivite sayfası için: bu aktivitenin kazandırdığı rozetler. Yalnızca kendi aktivitende (başkasınınkinde boş).
 * Yüklenemezse sessizce boş kalır.
 */
export function useAktiviteRozetleri(id: string | undefined, ownerId: string | null, benim: boolean): RozetDurumu[] {
  const [sonuc, setSonuc] = useState<{ id: string; rozetler: RozetDurumu[] } | null>(null);
  useEffect(() => {
    if (!id || !benim) return;
    let acik = true;
    (async () => {
      const uid = ownerId ?? (supabaseHazir ? ((await supabase.auth.getSession()).data.session?.user.id ?? null) : null);
      const liste = await rekorAktiviteleri(uid);
      // Meydan okuma rozetlerinin aktivitesi yok; burada gerekmez
      if (acik) setSonuc({ id, rozetler: aktivitininRozetleri(rozetDurumlari(liste), id) });
    })().catch(() => undefined);
    return () => {
      acik = false;
    };
  }, [id, ownerId, benim]);
  return sonuc && sonuc.id === id ? sonuc.rozetler : [];
}
