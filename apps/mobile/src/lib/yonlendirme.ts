/**
 * Rota çizimi için yol/patika bulma — BRouter (OpenStreetMap, rakımlı).
 *
 * Kendi sunucumuz (brouter.ismailtopcam.dev, Türkiye ve çevresi) ya da herkese açık brouter.de; adres ve anahtar `lib/altyapi.ts`'te.
 */
import type { ActivityType, RoutePoint } from '@lykiva/shared';

import type { LngLat } from '@/data/ornek';
import { $t } from '@/i18n';
import { BROUTER_URL as BROUTER, brouterBasliklari, KENDI_BROUTER_VAR } from '@/lib/altyapi';

export type CizimModu = 'patika' | 'yol' | 'serbest';

export const CIZIM_MODLARI = (): { id: CizimModu; label: string }[] => [
  { id: 'patika', label: $t('lib_yonlendirme.patikaya_yapis') },
  { id: 'yol', label: $t('lib_yonlendirme.yola_yapis') },
  { id: 'serbest', label: $t('lib_yonlendirme.serbest_ciz') },
];

/** Zemin payları (0..1) */
export type Zemin = { asphalt: number; gravel: number; trail: number };

export type HesaplananRota = { points: RoutePoint[]; surface: Zemin | null };

const bisikletMi = (activity: ActivityType) => activity === 'bike' || activity === 'mtb';

/** BRouter'ın hazır profili (her sunucuda var) */
function profil(mod: CizimModu, activity: ActivityType): string {
  if (mod === 'patika') return activity === 'mtb' ? 'mtb' : bisikletMi(activity) ? 'trekking' : 'hiking-mountain';
  return activity === 'bike' ? 'fastbike' : 'trekking';
}

/**
 * Kendi sunucumuzdaki profil (altyapi/brouter/profiller), varsa hazır profilin yerine denenir.
 *
 * Yol öncelikli yürüyüş / koşu: hazır `trekking` bisiklet profili; tek yönlere uyar ve `trunk` yolları 10 kat
 * cezalandırır, yaya için yol dolanıyordu (Ankamall'a 3,6 km yerine 6,1 km). `lykiva-yaya-yol` en kısa yola yakın
 * gider, tek yön saymaz, toprak yolu ve zor patikayı pahalı tutar.
 */
function kendiProfili(mod: CizimModu, activity: ActivityType): string | null {
  return KENDI_BROUTER_VAR && mod === 'yol' && !bisikletMi(activity) ? 'lykiva-yaya-yol' : null;
}

/**
 * Profile verilen ek parametreler (`&profile:ad=değer`; değer sayı olmalı, "true" yazılırsa sunucu 500 döner).
 *
 * fastbike Avrupa'ya göre ayarlı: `trunk` yolları bisiklete kapalı sayıp 10 kat cezalandırır. Türkiye'de şehir içi ana
 * bulvarlar ve bölünmüş devlet yolları `trunk` etiketli ve bisiklete açık; ceza yüzünden yol kilometrelerce dolanıyordu
 * (Ankamall'a en kısa yol 3,5 km iken 5,4 km; bu ayarla 3,7 km). Profilin kendi `allow_motorways` ayarı `trunk`'ı
 * ana yoldan biraz pahalı (1,5) yapar. Adına rağmen otoyolu açmaz: otoyol ve `motorroad=yes` erişim kuralından
 * yasak kalır (Ankara çevre yolunda denendi).
 */
function profilEkleri(brouterProfili: string): string {
  return brouterProfili === 'fastbike' ? '&profile:allow_motorways=1' : '';
}

/** OSM etiketlerinden zemin sınıfı */
function zeminSinifi(wayTags: string): keyof Zemin {
  const tags = Object.fromEntries(
    wayTags
      .split(' ')
      .filter(Boolean)
      .map((kv) => kv.split('=') as [string, string]),
  );
  const highway = tags.highway ?? '';
  const surface = tags.surface ?? '';
  if (['path', 'footway', 'bridleway', 'steps', 'via_ferrata'].includes(highway)) return 'trail';
  if (['asphalt', 'paved', 'concrete', 'paving_stones', 'sett', 'chipseal'].includes(surface)) return 'asphalt';
  if (highway === 'track' || ['gravel', 'fine_gravel', 'dirt', 'ground', 'compacted', 'unpaved', 'earth', 'grass', 'sand', 'rock'].includes(surface)) return 'gravel';
  return 'asphalt';
}

/**
 * Durak noktalarından rota hesaplar.
 * "serbest" modda noktalar düz çizgiyle birleşir (rakım yok).
 */
export async function rotaHesapla(duraklar: LngLat[], mod: CizimModu, activity: ActivityType, signal?: AbortSignal): Promise<HesaplananRota> {
  if (duraklar.length < 2 || mod === 'serbest') {
    return { points: duraklar.map(([lng, lat]) => ({ lng, lat, alt: null })), surface: null };
  }
  const lonlats = duraklar.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join('|');
  const iste = (p: string) =>
    fetch(`${BROUTER}?lonlats=${encodeURIComponent(lonlats)}&profile=${p}${profilEkleri(p)}&alternativeidx=0&format=geojson`, { signal, headers: brouterBasliklari() });
  const kendi = kendiProfili(mod, activity);
  let res = await iste(kendi ?? profil(mod, activity));
  // Sunucu profili tanımıyorsa boş gövdeli 500 döner (profil eklenmeden önce kurulmuş sunucu): hazır profille bir kez daha
  if (kendi && res.status === 500) res = await iste(profil(mod, activity));
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    // "datafile E0_N45.rd5 not found": nokta, sunucudaki harita karolarının dışında (kendi sunucumuz yalnızca Türkiye ve çevresi)
    if (t.includes('datafile')) throw new Error($t('lib_yonlendirme.yalnizca_turkiye'));
    throw new Error(t.includes('not mapped') || t.includes('target') ? $t('lib_yonlendirme.bu_noktalar_arasinda_yol') : $t('lib_yonlendirme.rota_hesaplanamadi'));
  }
  const j = await res.json();
  const f = j.features?.[0];
  const coords: number[][] = f?.geometry?.coordinates ?? [];
  const points: RoutePoint[] = coords.map((c) => ({ lng: c[0], lat: c[1], alt: c.length > 2 ? c[2] : null }));

  // messages: ilk satır başlık; Distance ve WayTags sütunlarından zemin payları
  let surface: Zemin | null = null;
  const msgs: string[][] | undefined = f?.properties?.messages;
  if (msgs && msgs.length > 1) {
    const h = msgs[0];
    const iD = h.indexOf('Distance');
    const iW = h.indexOf('WayTags');
    if (iD >= 0 && iW >= 0) {
      const toplam: Zemin = { asphalt: 0, gravel: 0, trail: 0 };
      for (const row of msgs.slice(1)) toplam[zeminSinifi(row[iW] ?? '')] += Number(row[iD]) || 0;
      const t = toplam.asphalt + toplam.gravel + toplam.trail;
      if (t > 0) surface = { asphalt: toplam.asphalt / t, gravel: toplam.gravel / t, trail: toplam.trail / t };
    }
  }
  return { points, surface };
}
