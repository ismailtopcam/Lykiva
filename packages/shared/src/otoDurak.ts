/**
 * Otomatik duraklatma kararı: kayıt sürerken kullanıcı durunca kayıt kendiliğinden duraklar, yeniden hareket edince
 * kaldığı yerden sürer. Saf fonksiyon; kaydedici her kabul edilen konumda ve saniyede bir (konum gelmese de)
 * çağırır. Testleri otoDurak.test.ts içinde.
 *
 * - Durma, üç yoldan biriyle anlaşılır (hangisi önce):
 *   1. Cihaz hızı (uydu sinyalinin Doppler kaymasından; konumdan çok daha kararlı, GPS kıpırtısından etkilenmez)
 *      türün süresi boyunca art arda eşiğin altında. Asıl yol budur: bisiklette ~5 sn'de duraklatır.
 *   2. Cihaz hızı yoksa: eşik hızıyla yarıçapı geçecek kadar süre aynı yarıçapın içinde kalındı.
 *   3. Hiç konum gelmedi (konum ancak birkaç metre ilerleyince geliyorsa yerinde dururken gelmez).
 *   Duraklama geriye dönük, yavaşlanan / durulan andan başlar.
 * - Devam: cihaz hızı art arda iki konumda eşiğin 1,5 katını geçince (ilkinin anından) ya da durulan yerden
 *   yarıçaptan (ve GPS doğruluğundan) uzak bir konum gelince; cihaz hızı hâlâ "duruyor" diyorsa yarıçapın üç katı.
 * - Sinyal kaybı: duraklama boyunca hiç konum gelmediyse ve durulan yerden eşik hızından hızlı gidilmiş olacak kadar
 *   uzağa varıldıysa (tünel, GPS kesildi) bu bir mola değildi: süre geri alınır, yol kesintisiz sayılır.
 * - Sessiz mola: telefon arka planda uyurken (iOS) hiç çağrı gelmez; uzun bir boşluktan sonra gelen konum o boşlukta
 *   durulduğunu gösteriyorsa mola sonradan, tek seferde işlenir.
 */
import type { ActivityType } from './activity';
import { haversine, MAX_PLAUSIBLE_SPEED, staleAfterS } from './track';

export type OtoDurakAyari = {
  /** Cihaz hızı bu kadar süre (s) eşiğin altında kalınca duraklatılır */
  sureS: number;
  /** Durulan yerin yarıçapı (m) */
  yaricapM: number;
  /** Bu hızın (m/s) altı "duruyor" */
  hizEsik: number;
};

/**
 * Türe göre eşikler. Eşik hızı: bisiklet / araba 3,6 km/sa, koşu ve dağ bisikleti ~2,9, patika koşusu ~2,2,
 * yürüyüş 1,8, doğa yürüyüşü ~1,4 (dik yokuşta yavaş çıkarken duraklamasın).
 */
export const OTO_DURAK: Record<ActivityType | 'car', OtoDurakAyari> = {
  bike: { sureS: 5, yaricapM: 8, hizEsik: 1.0 },
  mtb: { sureS: 6, yaricapM: 8, hizEsik: 0.8 },
  run: { sureS: 5, yaricapM: 8, hizEsik: 0.8 },
  trail_run: { sureS: 6, yaricapM: 8, hizEsik: 0.6 },
  walk: { sureS: 6, yaricapM: 8, hizEsik: 0.5 },
  hike: { sureS: 8, yaricapM: 8, hizEsik: 0.4 },
  car: { sureS: 5, yaricapM: 8, hizEsik: 1.0 },
};

/** Devam için cihaz hızı eşiğin bu katını art arda bu kadar konumda geçmeli (tek tük sıçrama sürdürmesin) */
const DEVAM_KATSAYI = 1.5;
const DEVAM_NOKTA = 2;

type Yer = { t: number; lat: number; lng: number; speed?: number | null };

export type OtoDurakDurumu = {
  /** Hareketteyken: şu an içinde bulunulan yarıçapın ilk noktası. Duraklatılmışken: durulan yer */
  capa: Yer | null;
  /** Son kabul edilen konum */
  son: Yer | null;
  /** Otomatik duraklatıldı mı */
  durdu: boolean;
  /** Cihaz hızı art arda eşiğin altındaysa bu dizinin ilk konumu */
  yavas?: Yer | null;
  /** Duraklatılmışken art arda hızlı gelen konum sayısı ve ilkinin zamanı */
  hizli?: { n: number; t: number } | null;
};

export type OtoDurakOlayi =
  /** Duraklat; duraklama `baslangic`ta başladı (geriye dönük) */
  | { tur: 'duraklat'; baslangic: number }
  /** Sürdür; duraklama `bitis`te bitti. `sinyalKaybi` ise duraklama süresi geri alınır */
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

type Sonuc = { durum: OtoDurakDurumu; olay: OtoDurakOlayi };

const BOS: OtoDurakDurumu = { capa: null, son: null, durdu: false, yavas: null, hizli: null };

const yer = (p: Yer): Yer => ({ t: p.t, lat: p.lat, lng: p.lng, speed: p.speed ?? null });

/** Cihaz hızı (m/s); yoksa ya da geçersizse null */
const cihazHizi = (v: number | null | undefined): number | null => (v != null && v >= 0 && v <= MAX_PLAUSIBLE_SPEED ? v : null);

/** `a`'dan `b`'ye ortalama hız (m/s) */
function hiz(a: Yer, b: Yer): number {
  const dt = (b.t - a.t) / 1000;
  return dt > 0 ? haversine(a, b) / dt : Infinity;
}

/** `bas` yerinde, onun anından başlayarak duraklatır */
function durdur(d: OtoDurakDurumu, bas: Yer): Sonuc {
  return { durum: { ...d, capa: bas, durdu: true, yavas: null, hizli: null }, olay: { tur: 'duraklat', baslangic: bas.t } };
}

/** Yarıçap kuralı için gereken süre (ms): eşik hızıyla yarıçapı geçecek kadar */
const yaricapSuresi = (a: OtoDurakAyari) => Math.max(a.sureS, a.yaricapM / a.hizEsik) * 1000;

export function otoDurak(onceki: OtoDurakDurumu | null, girdi: OtoDurakGirdisi, ayar: OtoDurakAyari): Sonuc {
  // Eski sürümden kalan durumda yeni alanlar olmayabilir
  const d: OtoDurakDurumu = { ...BOS, ...onceki };
  const p = girdi.nokta;
  if (d.durdu) return durmusken(d, p, ayar);
  return p ? hareketteNokta(d, p, ayar) : hareketteZaman(d, girdi.t, ayar);
}

function durmusken(d: OtoDurakDurumu, p: OtoDurakGirdisi['nokta'], ayar: OtoDurakAyari): Sonuc {
  if (!p) return { durum: d, olay: null };
  if (!d.capa) return { durum: { ...d, capa: yer(p), son: yer(p) }, olay: null };
  const v = cihazHizi(p.speed);
  const hizli = v != null && v >= ayar.hizEsik * DEVAM_KATSAYI ? { n: (d.hizli?.n ?? 0) + 1, t: d.hizli?.t ?? p.t } : null;
  // Cihaz hızı hâlâ "duruyor" diyorsa konum kıpırtısı (yarıçapı aşabilir) sürdürmesin: üç katı uzaklık gerekir
  const sinir = v != null && v < ayar.hizEsik ? 3 * ayar.yaricapM : ayar.yaricapM;
  const uzak = haversine(d.capa, p) > Math.max(sinir, p.acc ?? 0);
  if (!uzak && (!hizli || hizli.n < DEVAM_NOKTA)) return { durum: { ...d, son: yer(p), hizli }, olay: null };
  // Duraklama boyunca konum gelmediyse ve gelen konum durulan yerden hızla gidilmiş kadar uzaktaysa sinyal kaybıydı
  const sessiz = !d.son || p.t - d.son.t >= ayar.sureS * 1000;
  return {
    durum: { capa: yer(p), son: yer(p), durdu: false, yavas: null, hizli: null },
    olay: { tur: 'devam', bitis: hizli?.t ?? p.t, sinyalKaybi: sessiz && hiz(d.capa, p) >= ayar.hizEsik },
  };
}

function hareketteNokta(d: OtoDurakDurumu, p: NonNullable<OtoDurakGirdisi['nokta']>, ayar: OtoDurakAyari): Sonuc {
  const v = cihazHizi(p.speed);
  const yavasNokta = v != null && v < ayar.hizEsik;
  if (!d.capa || !d.son) return { durum: { capa: yer(p), son: yer(p), durdu: false, yavas: yavasNokta ? yer(p) : null, hizli: null }, olay: null };

  // Önünde uzun bir boşluk var ve o boşlukta eşikten yavaş gidilmiş: orada durulmuş (uygulama uyurken ya da konum
  // yalnızca ilerleyince geldiği için)
  if (p.t - d.son.t >= ayar.sureS * 1000 && hiz(d.son, p) < ayar.hizEsik) {
    const hareketli = v != null ? v >= ayar.hizEsik : haversine(d.son, p) > ayar.yaricapM;
    if (hareketli) return { durum: { capa: yer(p), son: yer(p), durdu: false, yavas: null, hizli: null }, olay: { tur: 'mola', baslangic: d.son.t, bitis: p.t } };
    return durdur({ ...d, son: yer(p) }, d.son);
  }

  const icerde = haversine(d.capa, p) <= ayar.yaricapM;
  const capa = icerde ? d.capa : yer(p);
  let yavas = yavasNokta ? (d.yavas ?? yer(p)) : null;
  // Cihaz hızı "yavaş" dese de konum belirgin ilerlediyse yavaşlama yeniden sayılır
  if (yavas && haversine(yavas, p) > 2 * ayar.yaricapM) yavas = yer(p);
  const yeni: OtoDurakDurumu = { capa, son: yer(p), durdu: false, yavas, hizli: null };

  if (yavas && p.t - yavas.t >= ayar.sureS * 1000) return durdur(yeni, yavas);
  // Cihaz hızı yoksa konuma bakılır (hız "hızlı" diyorsa yarıçapta dolaşıyor olabilir, duraklatılmaz)
  if (v == null && icerde && p.t - capa.t >= yaricapSuresi(ayar)) return durdur(yeni, capa);
  return { durum: yeni, olay: null };
}

function hareketteZaman(d: OtoDurakDurumu, t: number, ayar: OtoDurakAyari): Sonuc {
  if (!d.son) return { durum: d, olay: null };
  if (d.yavas && t - d.yavas.t >= ayar.sureS * 1000) return durdur(d, d.yavas);
  // Konum gelmiyor: son hızla bir sonraki konumun gelmesi beklenen süre de geçtiyse son konumda durulmuş
  const sonHiz = cihazHizi(d.son.speed) ?? 0;
  if (t - d.son.t >= Math.max(ayar.sureS, staleAfterS(sonHiz)) * 1000) return durdur(d, d.son);
  return { durum: d, olay: null };
}
