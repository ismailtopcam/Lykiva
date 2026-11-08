/**
 * Kayıt başlatılmadan önce seçilen rota (rota seç ekranı / rota detayı → kayıt başlat ekranı).
 * Kayıt başlayınca rota kaydın içine kopyalanır ve telefonda saklanır; böylece dağda internet
 * olmasa da "kalan km" hesaplanır.
 */
import { rotaSeyrelt, rotaUzunlugu } from '@lykiva/shared';
import { useSyncExternalStore } from 'react';

import type { RotaDetayi } from './rotalar';

export type KayitRotasi = {
  id: string;
  ad: string;
  /** [boylam, enlem] — seyreltilmiş (≥ 10 m aralık) */
  noktalar: [number, number][];
  toplamM: number;
};

let secilen: KayitRotasi | null = null;
const dinleyiciler = new Set<() => void>();

export function kayitRotasiOlustur(r: RotaDetayi): KayitRotasi {
  const nokta = r.koordinatlar.map((c) => ({ lng: c[0], lat: c[1] }));
  const seyrek = rotaSeyrelt(nokta, 10);
  return {
    id: r.id,
    ad: r.ad,
    noktalar: seyrek.map((p) => [Math.round(p.lng * 1e6) / 1e6, Math.round(p.lat * 1e6) / 1e6]),
    toplamM: rotaUzunlugu(seyrek),
  };
}

export function rotaSec(r: KayitRotasi | null) {
  secilen = r;
  dinleyiciler.forEach((f) => f());
}

export function seciliRota() {
  return secilen;
}

export function useSeciliRota(): KayitRotasi | null {
  return useSyncExternalStore(
    (f) => {
      dinleyiciler.add(f);
      return () => {
        dinleyiciler.delete(f);
      };
    },
    () => secilen,
    () => secilen,
  );
}
