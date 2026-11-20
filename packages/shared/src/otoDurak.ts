/**
 * Otomatik duraklatma kararı: kayıt sürerken kullanıcı durunca kayıt kendiliğinden duraklar, yeniden hareket edince
 * kaldığı yerden sürer. Saf fonksiyon; kaydedici her kabul edilen konumda ve birkaç saniyede bir (konum gelmese de)
 * çağırır. Testleri otoDurak.test.ts içinde.
 *
 * - Durma: türün süresi boyunca aynı yarıçapın içinde kalındıysa. Konum ancak birkaç metre ilerleyince geldiği için
 *   yerinde dururken hiç konum gelmeyebilir; zamanlayıcı da (konumsuz çağrı) aynı kuralla karar verir. Duraklatma
 *   geriye dönük, o yere ilk varılan andan başlar (bekleme süresi de mola sayılır).
 * - Devam: durulan yerden yarıçaptan (ve GPS doğruluğundan) uzak bir konum gelince.
 * - Sinyal kaybı: duraklama boyunca durulan yerden, türün "duruyor" hızından hızlı gidilmiş olacak kadar uzağa
 *   varıldıysa (tünel, GPS kesildi) bu bir mola değildi: süre geri alınır, yol kesintisiz sayılır.
 * - Sessiz mola: telefon arka planda uyurken (iOS) hiç çağrı gelmez; uzun bir boşluktan sonra gelen konum o boşlukta
 *   durulduğunu gösteriyorsa mola sonradan, tek seferde işlenir.
 */
import type { ActivityType } from './activity';
import { haversine } from './track';

export type OtoDurakAyari = {
  /** Bu kadar süre (s) yarıçapın içinde kalınca duraklatılır */
  sureS: number;
  /** Durulan yerin yarıçapı (m) */
  yaricapM: number;
};

/**
 * Türe göre eşikler. "Duruyor" hızı yarıçap / süre: bisiklet ~3,6 km/sa, koşu ~3 km/sa, yürüyüş ~2,4 km/sa,
 * doğa yürüyüşü ~1,8 km/sa (dik yokuşta yavaş çıkarken duraklamasın).
 */
export const OTO_DURAK: Record<ActivityType | 'car', OtoDurakAyari> = {
  bike: { sureS: 10, yaricapM: 10 },
  mtb: { sureS: 12, yaricapM: 10 },
  run: { sureS: 12, yaricapM: 10 },
  trail_run: { sureS: 15, yaricapM: 10 },
  walk: { sureS: 15, yaricapM: 10 },
  hike: { sureS: 20, yaricapM: 10 },
  car: { sureS: 10, yaricapM: 10 },
};

type Yer = { t: number; lat: number; lng: number };

export type OtoDurakDurumu = {
  /** Hareketteyken: şu an içinde bulunulan yarıçapın ilk noktası. Duraklatılmışken: durulan yer */
  capa: Yer | null;
  /** Son kabul edilen konum */
  son: Yer | null;
  /** Otomatik duraklatıldı mı */
  durdu: boolean;
};

export type OtoDurakOlayi =
  /** Duraklat; duraklama `baslangic`ta başladı (geriye dönük) */
  | { tur: 'duraklat'; baslangic: number }
  /** Sürdür; `sinyalKaybi` ise duraklama süresi geri alınır */
  | { tur: 'devam'; bitis: number; sinyalKaybi: boolean }
  /** Hiç çağrı gelmeyen bir boşlukta durulmuş: `baslangic`–`bitis` arası mola, kayıt sürüyor */
  | { tur: 'mola'; baslangic: number; bitis: number }
  | null;

export type OtoDurakGirdisi = {
  /** Şimdiki zaman (ms); konum varsa onun zamanı */
  t: number;
  /** Kabul edilmiş yeni konum; zamanlayıcı çağrısında yok */
  nokta?: Yer & { acc?: number | null };
};

const BOS: OtoDurakDurumu = { capa: null, son: null, durdu: false };

const yer = (p: Yer): Yer => ({ t: p.t, lat: p.lat, lng: p.lng });

/** `a`'dan `b`'ye ortalama hız (m/s) */
function hiz(a: Yer, b: Yer): number {
  const dt = (b.t - a.t) / 1000;
  return dt > 0 ? haversine(a, b) / dt : Infinity;
}

export function otoDurak(onceki: OtoDurakDurumu | null, girdi: OtoDurakGirdisi, ayar: OtoDurakAyari): { durum: OtoDurakDurumu; olay: OtoDurakOlayi } {
  const d = onceki ?? BOS;
  const sureMs = ayar.sureS * 1000;
  const durmaHizi = ayar.yaricapM / ayar.sureS;
  const p = girdi.nokta;

  // Duraklatılmışken yalnızca uzaklaşan bir konum kaydı sürdürür
  if (d.durdu) {
    if (!p || !d.capa) return { durum: p ? { ...d, son: yer(p) } : d, olay: null };
    const uzaklik = haversine(d.capa, p);
    if (uzaklik <= Math.max(ayar.yaricapM, p.acc ?? 0)) return { durum: { ...d, son: yer(p) }, olay: null };
    return {
      durum: { capa: yer(p), son: yer(p), durdu: false },
      olay: { tur: 'devam', bitis: p.t, sinyalKaybi: hiz(d.capa, p) >= durmaHizi },
    };
  }

  // Zamanlayıcı: hiç konum gelmeden süre doldu
  if (!p) {
    if (d.capa && girdi.t - d.capa.t >= sureMs) return { durum: { ...d, durdu: true }, olay: { tur: 'duraklat', baslangic: d.capa.t } };
    return { durum: d, olay: null };
  }

  if (!d.capa || !d.son) return { durum: { capa: yer(p), son: yer(p), durdu: false }, olay: null };

  if (haversine(d.capa, p) <= ayar.yaricapM) {
    if (p.t - d.capa.t >= sureMs) return { durum: { ...d, son: yer(p), durdu: true }, olay: { tur: 'duraklat', baslangic: d.capa.t } };
    return { durum: { ...d, son: yer(p) }, olay: null };
  }

  // Yarıçaptan çıkıldı. Önünde uzun bir boşluk varsa ve o boşlukta durma hızından yavaş gidildiyse orada durulmuş
  const yeni: OtoDurakDurumu = { capa: yer(p), son: yer(p), durdu: false };
  if (p.t - d.son.t >= sureMs && hiz(d.capa, p) < durmaHizi) return { durum: yeni, olay: { tur: 'mola', baslangic: d.capa.t, bitis: p.t } };
  return { durum: yeni, olay: null };
}
