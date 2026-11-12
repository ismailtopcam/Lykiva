/** Kilit ekranı penceresine giden kayıt durumu (Android ve iOS ortak) */
export type KilitEkraniDurumu = {
  /** Kanal adı (Android ayarlarında görünür) */
  kanalAdi: string;
  /** Başlıkta: "Bisiklet · Kaydediyor" */
  baslik: string;
  /** Etkinlik türü (bike, run, ...): iOS'ta simge seçilir */
  etkinlik: string;
  /** Duraklatmalar hariç geçen süre (ms) */
  gecenMs: number;
  /** false: süre durur (duraklatıldı) */
  sayiyor: boolean;
  mesafe: string;
  mesafeBirim: string;
  hiz: string;
  hizBirim: string;
  sureEtiket: string;
  mesafeEtiket: string;
  hizEtiket: string;
  /** Ön plan servisinin görev adı: Android'de servisin bildirimi bununla bulunur */
  gorev: string;
};
