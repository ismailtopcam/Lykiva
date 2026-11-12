/**
 * Kilit ekranında süren kaydın penceresi (yalnızca Android; yerel modül, yeni derleme gerekir).
 *
 * Kayıt bildirimini (expo-location'ın ön plan servisi bildirimi) süre, mesafe, anlık ve ortalama hız gösteren bir
 * pencereye çevirir. Süre telefonda kendi kendine sayar (Chronometer); mesafe ve hız her güncellemede yenilenir.
 * Servis çalışmıyorsa (duraklatıldı, arka plan izni yok) aynı pencere ayrı bir bildirim olarak gösterilir.
 *
 * iOS'ta, Expo Go'da ve web'de modül yoktur; fonksiyonlar hiçbir şey yapmaz.
 */
import { requireOptionalNativeModule } from 'expo';

export type KilitEkraniDurumu = {
  /** Kanal adı (Android ayarlarında görünür) */
  kanalAdi: string;
  /** Başlıkta: "Bisiklet · Kaydediyor" */
  baslik: string;
  /** Duraklatmalar hariç geçen süre (ms) */
  gecenMs: number;
  /** false: süre durur (duraklatıldı) */
  sayiyor: boolean;
  mesafe: string;
  mesafeBirim: string;
  /** Anlık hız ("—": bilinmiyor) */
  anlik: string;
  /** Ortalama hız (hareket hâlindeyken) */
  hiz: string;
  /** İki hızın da birimi */
  hizBirim: string;
  sureEtiket: string;
  mesafeEtiket: string;
  anlikEtiket: string;
  hizEtiket: string;
  /** Ön plan servisinin görev adı: servisin bildirimi bununla bulunur */
  gorev: string;
};

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
