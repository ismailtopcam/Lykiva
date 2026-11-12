import { currentSpeed, MAX_ACCURACY_M } from '@lykiva/shared';

import type { Kayit } from './kaydedici';

/**
 * Anlık hız (m/s) — kayıt ekranı ve kilit ekranı için ortak.
 * null = sinyal zayıf ya da henüz konum yok, hız bilinmiyor. Duraklatılmışsa 0.
 *
 * Beklenen sürede yeni nokta gelmediyse currentSpeed 0 döner (durdu). Ama son konum zayıfsa
 * noktalar elendiği için de gelmiyor olabilir: o zaman "duruyorsun" demek yerine bilinmiyor (null).
 */
export function anlikHizi(k: Kayit, simdi = Date.now()): number | null {
  if (k.durum !== 'kayitta') return 0;
  const son = k.segments[k.segments.length - 1] ?? [];
  if (son.length === 0) return null;
  const sk = k.sonKonum;
  const zayif = sk?.acc == null || sk.acc > MAX_ACCURACY_M;
  const hiz = currentSpeed(son, simdi);
  return hiz === 0 && zayif ? null : hiz;
}
