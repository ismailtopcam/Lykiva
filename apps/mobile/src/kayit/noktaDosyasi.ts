/**
 * Kaydın GPS noktalarının telefondaki dosyası (biçim ve fark hesabı: `@lykiva/shared` > kayitGunlugu).
 * Her yazmada yalnızca yeni noktalar dosyanın sonuna eklenir; yeni kayıtta dosya baştan yazılır.
 */
import { gunlukFarki, gunlukOzeti, gunluguOku, gunlukTamami, type GunlukOzeti, type TrackPoint } from '@lykiva/shared';
import { File, Paths } from 'expo-file-system';

const dosya = () => new File(Paths.document, 'lykiva-kayit-noktalari.jsonl');

/** Diskteki dosyanın hangi kayda ait olduğu ve özeti; bilinmiyorsa (açılışta, hata sonrası) dosya baştan yazılır */
let disk: { clientId: string; ozet: GunlukOzeti } | null = null;

export async function noktalariYaz(clientId: string, segments: TrackPoint[][]): Promise<void> {
  const f = dosya();
  const fark = disk?.clientId === clientId && f.exists ? gunlukFarki(disk.ozet, segments) : null;
  const ozet = gunlukOzeti(segments);
  try {
    if (fark == null) {
      disk = null;
      await f.write(gunlukTamami(clientId, segments));
    } else if (fark) {
      await f.write(fark, { append: true });
    }
    disk = { clientId, ozet };
  } catch (e) {
    // Yazılıp yazılmadığı belirsiz: sonraki yazma dosyayı baştan yazsın
    disk = null;
    throw e;
  }
}

/** Kaydın noktalarını okur; dosya yoksa ya da başka kayda aitse null */
export async function noktalariOku(clientId: string): Promise<TrackPoint[][] | null> {
  const f = dosya();
  if (!f.exists) return null;
  const segments = gunluguOku(await f.text(), clientId);
  if (segments) disk = { clientId, ozet: gunlukOzeti(segments) };
  return segments;
}

export function noktaDosyasiniSil() {
  disk = null;
  try {
    const f = dosya();
    if (f.exists) f.delete();
  } catch {
    // silinemedi; sonraki kayıt dosyayı baştan yazar
  }
}
