/**
 * Kilit ekranında süren kaydın penceresi — Android (yerel modül `android/`, yeni derleme gerekir).
 * iOS karşılığı `index.ios.tsx` (Live Activity); Metro platforma göre seçer.
 *
 * Kayıt bildirimini (expo-location'ın ön plan servisi bildirimi) süre, mesafe, anlık ve ortalama hız gösteren bir
 * pencereye çevirir. Süre telefonda kendi kendine sayar (Chronometer); mesafe ve hız her güncellemede yenilenir.
 * Servis çalışmıyorsa (duraklatıldı, arka plan izni yok) aynı pencere ayrı bir bildirim olarak gösterilir.
 *
 * Expo Go'da, web'de ve modülsüz eski derlemelerde modül yoktur; fonksiyonlar hiçbir şey yapmaz.
 */
import { requireOptionalNativeModule } from 'expo';

import type { KilitEkraniDurumu } from './tipler';

export type { KilitEkraniDurumu } from './tipler';

type Modul = {
  guncelle(durum: KilitEkraniDurumu): void;
  kapat(): void;
};

const modul = requireOptionalNativeModule<Modul>('KilitEkrani');

export const kilitEkraniVar = modul != null;

export function kilitEkraniGuncelle(durum: KilitEkraniDurumu): void {
  try {
    modul?.guncelle(durum);
  } catch {
    // Bildirim gösterilemedi (izin yok vb.); kayıt etkilenmez
  }
}

export function kilitEkraniKapat(): void {
  try {
    modul?.kapat();
  } catch {
    // yok sayılır
  }
}
