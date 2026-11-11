/**
 * Rozetler: kullanıcının kendi aktivitelerinden (kişisel rekorlarla aynı veri) telefonda hesaplanır; sunucuda tablo yok.
 *
 * - Toplam rozetleri (aktivite sayısı, mesafe, tırmanış, süre): eşiği geçiren aktivite rozeti "kazandırır", tarihi onun tarihi.
 * - Tek aktivite rozetleri (ör. 100 km sürüş, yarı maraton): ilk uyan aktivite. Ortalama hızı türüne göre gerçek olamayacak
 *   kadar yüksek olan aktivite (araçta unutulan kayıt) sayılmaz.
 * - Seri: üst üste en az bir aktiviteli hafta sayısı (pazartesi başlar, yerel saat).
 * - Meydan okuma rozetleri: tamamlanan meydan okumalar (sunucudan gelir).
 * - Rozet kimlikleri kalıcıdır (ileride sunucuya taşınırsa aynı kalsın); adları ve ikonları uygulamada.
 */
import type { ActivityType } from './activity';
import { donemAraligi } from './hedef';
import type { RekorAktivitesi } from './rekor';

export type RozetKategori = 'toplam' | 'tek' | 'seri' | 'ozel' | 'meydan';
/** Görünüm için kademe: 1 bronz … 4 en zor */
export type RozetKademe = 1 | 2 | 3 | 4;

type Kural =
  | { tur: 'sayi' }
  | { tur: 'mesafe' }
  | { tur: 'tirmanis' }
  | { tur: 'sure' }
  | { tur: 'tek_mesafe'; turler: readonly ActivityType[] }
  | { tur: 'tek_tirmanis' }
  | { tur: 'seri' }
  | { tur: 'erken' }
  | { tur: 'cesit' }
  | { tur: 'meydan' };

export type RozetTanimi = { id: string; kategori: RozetKategori; kademe: RozetKademe; esik: number; kural: Kural };

const BISIKLET = ['bike', 'mtb'] as const;
const KOSU = ['run', 'trail_run'] as const;
const YURUYUS = ['walk', 'hike'] as const;

/** Ekranda bu sırayla görünür */
export const ROZETLER: readonly RozetTanimi[] = [
  { id: 'ilk_adim', kategori: 'toplam', kademe: 1, esik: 1, kural: { tur: 'sayi' } },
  { id: 'aktivite_10', kategori: 'toplam', kademe: 1, esik: 10, kural: { tur: 'sayi' } },
  { id: 'aktivite_50', kategori: 'toplam', kademe: 2, esik: 50, kural: { tur: 'sayi' } },
  { id: 'aktivite_100', kategori: 'toplam', kademe: 3, esik: 100, kural: { tur: 'sayi' } },
  { id: 'aktivite_365', kategori: 'toplam', kademe: 4, esik: 365, kural: { tur: 'sayi' } },
  { id: 'mesafe_100', kategori: 'toplam', kademe: 1, esik: 100_000, kural: { tur: 'mesafe' } },
  { id: 'mesafe_500', kategori: 'toplam', kademe: 2, esik: 500_000, kural: { tur: 'mesafe' } },
  { id: 'mesafe_1000', kategori: 'toplam', kademe: 3, esik: 1_000_000, kural: { tur: 'mesafe' } },
  { id: 'mesafe_5000', kategori: 'toplam', kademe: 4, esik: 5_000_000, kural: { tur: 'mesafe' } },
  { id: 'tirmanis_1000', kategori: 'toplam', kademe: 1, esik: 1_000, kural: { tur: 'tirmanis' } },
  { id: 'tirmanis_everest', kategori: 'toplam', kademe: 3, esik: 8_849, kural: { tur: 'tirmanis' } },
  { id: 'tirmanis_30000', kategori: 'toplam', kademe: 4, esik: 30_000, kural: { tur: 'tirmanis' } },
  { id: 'sure_24', kategori: 'toplam', kademe: 2, esik: 24 * 3600, kural: { tur: 'sure' } },
  { id: 'sure_100', kategori: 'toplam', kademe: 3, esik: 100 * 3600, kural: { tur: 'sure' } },
  { id: 'bisiklet_50', kategori: 'tek', kademe: 1, esik: 50_000, kural: { tur: 'tek_mesafe', turler: BISIKLET } },
  { id: 'bisiklet_100', kategori: 'tek', kademe: 3, esik: 100_000, kural: { tur: 'tek_mesafe', turler: BISIKLET } },
  { id: 'kosu_10', kategori: 'tek', kademe: 1, esik: 10_000, kural: { tur: 'tek_mesafe', turler: KOSU } },
  { id: 'yari_maraton', kategori: 'tek', kademe: 2, esik: 21_097, kural: { tur: 'tek_mesafe', turler: KOSU } },
  { id: 'maraton', kategori: 'tek', kademe: 4, esik: 42_195, kural: { tur: 'tek_mesafe', turler: KOSU } },
  { id: 'yuruyus_20', kategori: 'tek', kademe: 2, esik: 20_000, kural: { tur: 'tek_mesafe', turler: YURUYUS } },
  { id: 'tek_tirmanis_1000', kategori: 'tek', kademe: 3, esik: 1_000, kural: { tur: 'tek_tirmanis' } },
  { id: 'seri_4', kategori: 'seri', kademe: 1, esik: 4, kural: { tur: 'seri' } },
  { id: 'seri_12', kategori: 'seri', kademe: 2, esik: 12, kural: { tur: 'seri' } },
  { id: 'seri_52', kategori: 'seri', kademe: 4, esik: 52, kural: { tur: 'seri' } },
  { id: 'erken_kus', kategori: 'ozel', kademe: 1, esik: 1, kural: { tur: 'erken' } },
  { id: 'cok_yonlu', kategori: 'ozel', kademe: 2, esik: 3, kural: { tur: 'cesit' } },
  { id: 'meydan_1', kategori: 'meydan', kademe: 1, esik: 1, kural: { tur: 'meydan' } },
  { id: 'meydan_5', kategori: 'meydan', kademe: 3, esik: 5, kural: { tur: 'meydan' } },
];

/** Tek aktivite rozetlerinde güvenilir sayılan en yüksek ortalama hız (km/sa); üstü araçta unutulmuş kayıt sayılır */
export const ROZET_ORT_HIZ_SINIRI: Record<ActivityType, number> = { bike: 60, mtb: 45, run: 25, trail_run: 25, walk: 10, hike: 10 };

/** Sabah 4:00–6:59 arasında başlayan aktivite "erken kuş" */
const ERKEN_BAS = 4;
const ERKEN_SON = 7;

export type TamamlananMeydanOkuma = { id: string; /** Bitiş ya da tamamlanma anı (ms); bilinmiyorsa null */ tarih: number | null };

export type RozetDurumu = {
  tanim: RozetTanimi;
  kazanildi: boolean;
  /** Kazanıldığı an (ms) */
  tarih: number | null;
  /** Rozeti kazandıran aktivite */
  aktiviteId: string | null;
  /** İlerleme: toplam, en iyi tek değer, en uzun seri, tür sayısı… (eşikle aynı birimde) */
  deger: number;
};

function ortHizUygun(a: RekorAktivitesi): boolean {
  if (!a.movingS || a.movingS <= 0) return true;
  return (a.distanceM / a.movingS) * 3.6 <= ROZET_ORT_HIZ_SINIRI[a.activity];
}

/** Haftanın başlangıcı (yerel pazartesi 00:00) */
const haftaBasi = (t: number) => donemAraligi('hafta', t).bas;
const sonrakiHafta = (bas: number) => donemAraligi('hafta', bas).son;

export function rozetDurumlari(liste: RekorAktivitesi[], meydanOkumalar: TamamlananMeydanOkuma[] = []): RozetDurumu[] {
  const sirali = [...liste].filter((a) => Number.isFinite(a.startedAt)).sort((x, y) => x.startedAt - y.startedAt || x.id.localeCompare(y.id));

  return ROZETLER.map((tanim): RozetDurumu => {
    const k = tanim.kural;
    let deger = 0;
    // Kapanış (closure) içinde atandığı için TypeScript daraltmasın
    let kazanan = null as RekorAktivitesi | null;
    let tarih = null as number | null;

    const esikGecti = (a: RekorAktivitesi) => {
      if (!kazanan && deger >= tanim.esik) {
        kazanan = a;
        tarih = a.startedAt;
      }
    };

    switch (k.tur) {
      case 'sayi':
      case 'mesafe':
      case 'tirmanis':
      case 'sure':
        for (const a of sirali) {
          deger += k.tur === 'sayi' ? 1 : k.tur === 'mesafe' ? a.distanceM || 0 : k.tur === 'tirmanis' ? a.gainM || 0 : a.movingS || 0;
          esikGecti(a);
        }
        break;
      case 'tek_mesafe':
      case 'tek_tirmanis':
        for (const a of sirali) {
          if (k.tur === 'tek_mesafe' && (!k.turler.includes(a.activity) || !ortHizUygun(a))) continue;
          const v = k.tur === 'tek_mesafe' ? a.distanceM || 0 : a.gainM || 0;
          if (v > deger) deger = v;
          if (!kazanan && v >= tanim.esik) {
            kazanan = a;
            tarih = a.startedAt;
          }
        }
        break;
      case 'seri': {
        let simdikiHafta: number | null = null;
        let seri = 0;
        for (const a of sirali) {
          const h = haftaBasi(a.startedAt);
          if (h === simdikiHafta) continue;
          seri = simdikiHafta != null && sonrakiHafta(simdikiHafta) === h ? seri + 1 : 1;
          simdikiHafta = h;
          if (seri > deger) deger = seri;
          esikGecti(a);
        }
        break;
      }
      case 'erken':
        for (const a of sirali) {
          const saat = new Date(a.startedAt).getHours();
          if (saat >= ERKEN_BAS && saat < ERKEN_SON) {
            deger += 1;
            esikGecti(a);
          }
        }
        break;
      case 'cesit': {
        const gorulen = new Set<ActivityType>();
        for (const a of sirali) {
          if (gorulen.has(a.activity)) continue;
          gorulen.add(a.activity);
          deger = gorulen.size;
          esikGecti(a);
        }
        break;
      }
      case 'meydan': {
        const s = [...meydanOkumalar].sort((x, y) => (x.tarih ?? Infinity) - (y.tarih ?? Infinity));
        deger = s.length;
        const kazanildi = deger >= tanim.esik;
        return { tanim, kazanildi, tarih: kazanildi ? (s[tanim.esik - 1].tarih ?? null) : null, aktiviteId: null, deger };
      }
    }
    return { tanim, kazanildi: kazanan != null, tarih, aktiviteId: kazanan?.id ?? null, deger };
  });
}

/** Bu aktivitenin kazandırdığı rozetler (aktivite sayfası için) */
export function aktivitininRozetleri(durumlar: RozetDurumu[], aktiviteId: string): RozetDurumu[] {
  return durumlar.filter((d) => d.kazanildi && d.aktiviteId === aktiviteId);
}

/** Kazanılanlar, en yeni önce */
export function sonKazanilanlar(durumlar: RozetDurumu[]): RozetDurumu[] {
  return durumlar.filter((d) => d.kazanildi).sort((a, b) => (b.tarih ?? 0) - (a.tarih ?? 0));
}
