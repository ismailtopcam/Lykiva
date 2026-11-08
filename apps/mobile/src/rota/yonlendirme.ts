/**
 * Rota çiziminde iki nokta arasını patikaya / yola "yapıştırma": BRouter (OSM verisi, yükseklik dahil).
 *
 * Varsayılan sunucu brouter.de: gönüllülerin işlettiği ortak sunucu, geliştirme içindir; yoğun istekte
 * "Please, retry later!" (403) dönebilir. Gerçek kullanıcılardan önce kendi BRouter sunucumuz kurulmalı
 * ve EXPO_PUBLIC_BROUTER_URL ile gösterilmeli.
 */
import { haversine, zeminSinifi, type ActivityType, type ZeminDagilimi } from '@lykiva/shared';

export const BROUTER_URL = process.env.EXPO_PUBLIC_BROUTER_URL || 'https://brouter.de/brouter';

export type CizimModu = 'patika' | 'yol' | 'serbest';

/** [boylam, enlem, yükseklik | null] */
export type RotaKoordinati = [number, number, number | null];

export type Bacak = {
  koordinatlar: RotaKoordinati[];
  mesafeM: number;
  zemin: ZeminDagilimi;
  /** BRouter'ın kendi süre tahmini (s); serbest çizimde yok */
  sureS: number | null;
};

const BOS_ZEMIN: ZeminDagilimi = { asfalt: 0, toprak: 0, patika: 0 };

/** Aktivite ve moda göre BRouter profili */
export function profil(activity: ActivityType, mod: Exclude<CizimModu, 'serbest'>): string {
  const bisiklet = activity === 'bike' || activity === 'mtb';
  if (mod === 'patika') return bisiklet ? 'mtb' : 'hiking-mountain';
  if (activity === 'bike') return 'fastbike';
  return 'trekking';
}

export class YolBulunamadi extends Error {}

export function duzBacak(a: [number, number], b: [number, number]): Bacak {
  return {
    koordinatlar: [
      [a[0], a[1], null],
      [b[0], b[1], null],
    ],
    mesafeM: haversine({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] }),
    zemin: { ...BOS_ZEMIN },
    sureS: null,
  };
}

type BRouterCevap = {
  features?: {
    properties?: { 'track-length'?: string; 'total-time'?: string; messages?: string[][] };
    geometry?: { coordinates?: number[][] };
  }[];
};

export async function yolBul(a: [number, number], b: [number, number], profilAdi: string): Promise<Bacak> {
  const adres = `${BROUTER_URL}?lonlats=${a[0].toFixed(6)},${a[1].toFixed(6)}|${b[0].toFixed(6)},${b[1].toFixed(6)}&profile=${encodeURIComponent(profilAdi)}&alternativeidx=0&format=geojson`;
  const iptal = new AbortController();
  const zamanlayici = setTimeout(() => iptal.abort(), 20_000);
  let metin: string;
  let durum: number;
  try {
    const yanit = await fetch(adres, { signal: iptal.signal });
    durum = yanit.status;
    metin = await yanit.text();
  } catch {
    throw new YolBulunamadi('Yol servisine ulaşılamadı (internet?)');
  } finally {
    clearTimeout(zamanlayici);
  }
  if (durum !== 200) {
    // Ortak sunucu hem yoğunlukta hem de çözülemeyen isteklerde bu yanıtı veriyor
    if (/retry later/i.test(metin)) throw new YolBulunamadi('Yol bulunamadı (servis yoğun olabilir ya da bu iki nokta arasında yol yok)');
    throw new YolBulunamadi('Bu iki nokta arasında yol bulunamadı');
  }

  let veri: BRouterCevap;
  try {
    veri = JSON.parse(metin) as BRouterCevap;
  } catch {
    throw new YolBulunamadi('Yol servisinden anlaşılmayan yanıt');
  }
  const f = veri.features?.[0];
  const ham = f?.geometry?.coordinates ?? [];
  if (ham.length < 2) throw new YolBulunamadi('Bu iki nokta arasında yol bulunamadı');

  const koordinatlar: RotaKoordinati[] = ham.map((c) => [c[0], c[1], c.length > 2 && Number.isFinite(c[2]) ? c[2] : null]);

  // messages: ilk satır başlık; her satırdaki "Distance" o satırın yol parçasının uzunluğu (m)
  const zemin = { ...BOS_ZEMIN };
  const mesajlar = f?.properties?.messages ?? [];
  const baslik = mesajlar[0] ?? [];
  const iMesafe = baslik.indexOf('Distance');
  const iEtiket = baslik.indexOf('WayTags');
  if (iMesafe >= 0 && iEtiket >= 0) {
    for (const satir of mesajlar.slice(1)) {
      const sinif = zeminSinifi(satir[iEtiket] ?? '');
      const m = Number(satir[iMesafe]);
      if (sinif && Number.isFinite(m)) zemin[sinif] += m;
    }
  }

  const uzunluk = Number(f?.properties?.['track-length']);
  const sure = Number(f?.properties?.['total-time']);
  return {
    koordinatlar,
    mesafeM: Number.isFinite(uzunluk) && uzunluk > 0 ? uzunluk : koordinatlar.reduce((t, c, i) => (i ? t + haversine({ lng: koordinatlar[i - 1][0], lat: koordinatlar[i - 1][1] }, { lng: c[0], lat: c[1] }) : 0), 0),
    zemin,
    sureS: Number.isFinite(sure) && sure > 0 ? sure : null,
  };
}
