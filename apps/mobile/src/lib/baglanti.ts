/**
 * Aktivite paylaşım bağlantısı: https://lykiva.app/a/<anahtar>
 * Bağlantısı olan herkes giriş yapmadan web'de görür; sahibi kapatınca açılmaz.
 * Sunucu: supabase/migrations/20261110020000_paylasim_baglantisi.sql · Web: apps/web/src/app/a/[anahtar]
 */
import { Platform, Share } from 'react-native';

import { oturumuSagla, supabase } from '@/lib/supabase';

/** Web sitesinin adresi (.env ile değişir) */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || 'https://lykiva.app').replace(/\/$/, '');

async function rpc<T>(ad: string, args: Record<string, unknown>): Promise<T> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc(ad, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const baglantiAdresi = (anahtar: string) => `${WEB_URL}/a/${anahtar}`;
/** Herkese açık web profili (apps/web /u/<kullanıcı adı>) */
export const profilAdresi = (kullaniciAdi: string) => `${WEB_URL}/u/${encodeURIComponent(kullaniciAdi)}`;

/** Açık bağlantının anahtarı (yalnızca sahibi); yoksa null */
export const baglantiDurumu = (aktivite: string) => rpc<string | null>('paylasim_baglantisi', { aktivite });
/** Bağlantı açar (zaten açıksa aynısını döner) */
export const baglantiAc = (aktivite: string) => rpc<string>('paylasim_baglantisi_ac', { aktivite });
/** Bağlantıyı kapatır; eski adres artık açılmaz */
export const baglantiKapat = (aktivite: string) => rpc<void>('paylasim_baglantisi_kapat', { aktivite });

/** Telefonun paylaşım menüsü. iOS'ta adres ayrı alan olarak gider (önizleme kartı çıkar). */
export async function baglantiPaylas(baslik: string, adres: string) {
  if (Platform.OS === 'ios') return Share.share({ url: adres, message: baslik });
  return Share.share({ message: `${baslik}\n${adres}`, title: baslik });
}
