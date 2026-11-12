/**
 * Fotoğraf seçme, küçültme ve Supabase Storage'a yükleme.
 * Kovalar ve kurallar: supabase/migrations/20261110100000_fotograflar.sql
 *   profil  herkese açık, <kullanıcı id>/<uuid>.jpg
 *   mola    gizli (imzalı adresle okunur), <aktivite id>/<uuid>.jpg
 * Kulüpler: supabase/migrations/20261117000000_kulupler.sql
 *   grup          herkese açık, <grup id>/<uuid>.jpg (grup fotoğrafı; yalnızca grup yöneticisi)
 *   grup_gonderi  gizli (imzalı adresle okunur), <grup id>/<uuid>.jpg (gönderi fotoğrafları; üyeler)
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { oturumuSagla, supabase } from '@/lib/supabase';
import { $t } from '@/i18n';

export type Kaynak = 'galeri' | 'kamera';

function uuid() {
  // crypto.randomUUID her ortamda yok; dosya adı için yeterli rastgelelik
  const h = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[Math.floor(Math.random() * 4)]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Galeriden ya da kameradan bir fotoğraf; vazgeçilirse null. İzin verilmezse hata. */
export async function fotoSec(kaynak: Kaynak, kare = false): Promise<string | null> {
  const izin = kaynak === 'kamera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!izin.granted) throw new Error(kaynak === 'kamera' ? $t('lib_foto.kamera_izni_verilmedi_ayarlardan') : $t('lib_foto.fotograflara_erisim_izni_verilmedi'));
  const secenek: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: kare, aspect: kare ? [1, 1] : undefined, exif: false };
  const s = kaynak === 'kamera' ? await ImagePicker.launchCameraAsync(secenek) : await ImagePicker.launchImageLibraryAsync(secenek);
  if (s.canceled || !s.assets?.[0]) return null;
  return s.assets[0].uri;
}

/** Uzun kenarı en fazla `kenar` piksel JPEG'e çevirir (konum gibi EXIF bilgileri yeni dosyaya geçmez) */
async function kucult(uri: string, kenar: number): Promise<string> {
  const ham = await ImageManipulator.manipulate(uri).renderAsync();
  const yatay = ham.width >= ham.height;
  const buyuk = Math.max(ham.width, ham.height) > kenar;
  const ctx = ImageManipulator.manipulate(uri);
  if (buyuk) ctx.resize(yatay ? { width: kenar } : { height: kenar });
  const sonuc = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return sonuc.uri;
}

type Kova = 'profil' | 'mola' | 'grup' | 'grup_gonderi';

async function yukle(kova: Kova, klasor: string, uri: string, kenar: number): Promise<string> {
  await oturumuSagla();
  const kucuk = await kucult(uri, kenar);
  const govde = await (await fetch(kucuk)).arrayBuffer();
  const yol = `${klasor}/${uuid()}.jpg`;
  const { error } = await supabase.storage.from(kova).upload(yol, govde, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return yol;
}

/* ------------------------------------------------------------------ */
/* Profil fotoğrafı                                                    */
/* ------------------------------------------------------------------ */

/** Kendi kovamızdaki profil fotoğrafının yolu (Google/Apple fotoğrafı ise null) */
function profilYolu(adres: string | null | undefined) {
  const m = adres?.match(/\/storage\/v1\/object\/public\/profil\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Yeni profil fotoğrafını yükler, profile yazar, eskisini siler; yeni adresi döner */
export async function profilFotografiYukle(uri: string, eskiAdres: string | null): Promise<string> {
  const uid = await oturumuSagla();
  const yol = await yukle('profil', uid, uri, 512);
  const adres = supabase.storage.from('profil').getPublicUrl(yol).data.publicUrl;
  const { error } = await supabase.from('profiles').update({ avatar_url: adres }).eq('id', uid);
  if (error) {
    await supabase.storage.from('profil').remove([yol]);
    throw new Error(error.message);
  }
  const eski = profilYolu(eskiAdres);
  if (eski) await supabase.storage.from('profil').remove([eski]).catch(() => undefined);
  return adres;
}

export async function profilFotografiniKaldir(eskiAdres: string | null) {
  const uid = await oturumuSagla();
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', uid);
  if (error) throw new Error(error.message);
  const eski = profilYolu(eskiAdres);
  if (eski) await supabase.storage.from('profil').remove([eski]).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Mola fotoğrafları                                                   */
/* ------------------------------------------------------------------ */

export const MOLA_FOTO_SINIRI = 6;

/** Molaya fotoğraf ekler; molanın yeni fotoğraf listesini döner */
export async function molaFotografiEkle(aktiviteId: string, molaId: string, mevcut: string[], uri: string): Promise<string[]> {
  if (mevcut.length >= MOLA_FOTO_SINIRI) throw new Error($t('lib_foto.bir_molaya_en_fazla', { mOLA_FOTO_SINIRI: MOLA_FOTO_SINIRI }));
  const yol = await yukle('mola', aktiviteId, uri, 1600);
  const yeni = [...mevcut, yol];
  const { error } = await supabase.from('activity_stops').update({ photo_urls: yeni }).eq('id', molaId);
  if (error) {
    await supabase.storage.from('mola').remove([yol]);
    throw new Error(error.message);
  }
  return yeni;
}

export async function molaFotografiSil(molaId: string, mevcut: string[], yol: string): Promise<string[]> {
  const yeni = mevcut.filter((y) => y !== yol);
  const { error } = await supabase.from('activity_stops').update({ photo_urls: yeni }).eq('id', molaId);
  if (error) throw new Error(error.message);
  await supabase.storage.from('mola').remove([yol]).catch(() => undefined);
  return yeni;
}

/** Gizli kovadaki fotoğraflar için bir saatlik adresler (yol → adres) */
export async function molaFotoAdresleri(yollar: string[]): Promise<Record<string, string>> {
  if (!yollar.length) return {};
  await oturumuSagla();
  const { data, error } = await supabase.storage.from('mola').createSignedUrls(yollar, 3600);
  if (error) throw new Error(error.message);
  const sonuc: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) sonuc[d.path] = d.signedUrl;
  return sonuc;
}

/** Aktivite silinmeden önce mola fotoğraflarını depodan temizler (başarısız olursa silmeyi engellemez) */
export async function aktiviteFotograflariniSil(aktiviteId: string) {
  const { data } = await supabase.from('activity_stops').select('photo_urls').eq('activity_id', aktiviteId);
  const yollar = (data ?? []).flatMap((s) => (s.photo_urls ?? []) as string[]);
  if (yollar.length) await supabase.storage.from('mola').remove(yollar).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Kulüpler: grup fotoğrafı ve gönderi fotoğrafları                     */
/* ------------------------------------------------------------------ */

/** Kendi kovamızdaki grup fotoğrafının yolu */
function grupYolu(adres: string | null | undefined) {
  const m = adres?.match(/\/storage\/v1\/object\/public\/grup\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Yeni grup fotoğrafını yükler (yalnızca grup yöneticisi), gruba yazar, eskisini siler; yeni adresi döner */
export async function grupFotografiYukle(grupId: string, uri: string, eskiAdres: string | null): Promise<string> {
  const yol = await yukle('grup', grupId, uri, 768);
  const adres = supabase.storage.from('grup').getPublicUrl(yol).data.publicUrl;
  const { error } = await supabase.from('groups').update({ avatar_url: adres }).eq('id', grupId);
  if (error) {
    await supabase.storage.from('grup').remove([yol]);
    throw new Error(error.message);
  }
  const eski = grupYolu(eskiAdres);
  if (eski) await supabase.storage.from('grup').remove([eski]).catch(() => undefined);
  return adres;
}

export async function grupFotografiniKaldir(grupId: string, eskiAdres: string | null) {
  await oturumuSagla();
  const { error } = await supabase.from('groups').update({ avatar_url: null }).eq('id', grupId);
  if (error) throw new Error(error.message);
  const eski = grupYolu(eskiAdres);
  if (eski) await supabase.storage.from('grup').remove([eski]).catch(() => undefined);
}

export const GONDERI_FOTO_SINIRI = 4;

/** Gönderi fotoğrafını gizli kovaya yükler; yolunu döner (gönderi paylaşılmazsa gonderiFotograflariniSil ile silinmeli) */
export const gonderiFotografiYukle = (grupId: string, uri: string) => yukle('grup_gonderi', grupId, uri, 1600);

export async function gonderiFotograflariniSil(yollar: string[]) {
  if (yollar.length) await supabase.storage.from('grup_gonderi').remove(yollar).catch(() => undefined);
}

/** Gönderi fotoğrafları için bir saatlik adresler (yol → adres) */
export async function gonderiFotoAdresleri(yollar: string[]): Promise<Record<string, string>> {
  if (!yollar.length) return {};
  await oturumuSagla();
  const { data, error } = await supabase.storage.from('grup_gonderi').createSignedUrls(yollar, 3600);
  if (error) throw new Error(error.message);
  const sonuc: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) sonuc[d.path] = d.signedUrl;
  return sonuc;
}
