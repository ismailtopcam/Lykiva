/**
 * Hava durumu: MET Norway locationforecast 2.0 (anahtarsız; ticari kullanım dahil ücretsiz, CC BY 4.0).
 * Kullanım koşulları: tanıtıcı User-Agent, koordinatlar en fazla 4 ondalık, gereksiz sık istek yok.
 * Adres .env ile değişir: EXPO_PUBLIC_HAVA_URL (kendi önbellek sunucumuz kurulursa).
 * Çözümleme ve yorumlama: packages/shared/src/hava.ts
 */
import { metYanitindanHava, TAHMIN_UFKU_GUN, type HavaDurumu, type MetYaniti } from '@lykiva/shared';
import { Platform } from 'react-native';
import { $t } from '@/i18n';

const HAVA_URL = process.env.EXPO_PUBLIC_HAVA_URL || 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
// MET kimliği bilinmeyen istemcileri engeller; uygulama adı ve web adresi (kişisel bilgi yok)
const KIMLIK = 'Lykiva/0.1 (+https://lykiva.app)';

// Aynı yer için yarım saat içinde yeniden istek atma
const onbellek = new Map<string, { zaman: number; yanit: MetYaniti }>();

async function tahminAl(lat: number, lng: number): Promise<MetYaniti> {
  // ~100 m hassasiyet yeter; MET 4 ondalıktan fazlasını kabul etmez
  const la = lat.toFixed(3);
  const lo = lng.toFixed(3);
  const anahtar = `${la},${lo}`;
  const k = onbellek.get(anahtar);
  if (k && Date.now() - k.zaman < 30 * 60_000) return k.yanit;
  const kontrol = new AbortController();
  const zaman = setTimeout(() => kontrol.abort(), 8000);
  try {
    const r = await fetch(`${HAVA_URL}?lat=${la}&lon=${lo}`, {
      // Tarayıcı User-Agent başlığını değiştirmeye izin vermez; web'de gönderilmez
      headers: Platform.OS === 'web' ? {} : { 'User-Agent': KIMLIK },
      signal: kontrol.signal,
    });
    if (!r.ok) throw new Error($t('lib_hava.hava_servisi_yanit_vermedi', { status: r.status }));
    const yanit = (await r.json()) as MetYaniti;
    onbellek.set(anahtar, { zaman: Date.now(), yanit });
    return yanit;
  } finally {
    clearTimeout(zaman);
  }
}

/** Şu anki hava (kayıt başlarken) */
export async function simdikiHava(lat: number, lng: number): Promise<HavaDurumu | null> {
  return metYanitindanHava(await tahminAl(lat, lng), new Date());
}

/** Gelecekteki bir zaman için tahmin (etkinlik); ufkun dışındaysa ya da geçmişse null */
export async function tahmin(lat: number, lng: number, zaman: Date): Promise<HavaDurumu | null> {
  const fark = zaman.getTime() - Date.now();
  if (fark < -3 * 3600_000 || fark > TAHMIN_UFKU_GUN * 86_400_000) return null;
  return metYanitindanHava(await tahminAl(lat, lng), zaman);
}
