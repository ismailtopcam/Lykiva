/**
 * Kendi rota (BRouter) ve yer arama (Photon) sunucularımızın adresleri ve uygulama anahtarı.
 *
 * Sunucuların önündeki kapı (altyapi/kapi) X-Lykiva-Anahtar başlığı olmayan isteği reddeder (403)
 * ve IP başına istek sınırı uygular (429). Anahtar yalnızca kendi adresimiz verilmişse gönderilir;
 * adres yoksa herkese açık brouter.de / photon.komoot.io kullanılır ve anahtar onlara gitmez.
 */
const KENDI_BROUTER = process.env.EXPO_PUBLIC_BROUTER_URL;
const KENDI_PHOTON = process.env.EXPO_PUBLIC_PHOTON_URL;
const ANAHTAR = process.env.EXPO_PUBLIC_ALTYAPI_ANAHTARI;

export const BROUTER_URL = KENDI_BROUTER || 'https://brouter.de/brouter';
export const PHOTON_URL = KENDI_PHOTON || 'https://photon.komoot.io/api/';

function basliklar(kendi: string | undefined): Record<string, string> {
  return kendi && ANAHTAR ? { 'X-Lykiva-Anahtar': ANAHTAR } : {};
}

export const brouterBasliklari = (): Record<string, string> => basliklar(KENDI_BROUTER);
export const photonBasliklari = (): Record<string, string> => basliklar(KENDI_PHOTON);
