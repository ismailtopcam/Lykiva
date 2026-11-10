/**
 * Profil düzenleme. Sunucu: supabase/migrations/20261110090000_profil.sql
 * Ad, kullanıcı adı, şehir ve "hakkında" yalnızca profil_guncelle() ile değişir (kullanıcı adı denetimi orada).
 */
import { oturumuSagla, supabase } from '@/lib/supabase';

export type ProfilBilgisi = { display_name: string; username: string; city: string | null; bio: string | null };
export type ProfilVerisi = ProfilBilgisi & { avatar_url: string | null };

export const KULLANICI_ADI_BICIMI = /^[a-z0-9_.]{3,30}$/;

/** Yazılan kullanıcı adını sunucunun beklediği biçime yaklaştırır (küçük harf, Türkçe harfler sadeleşir, boşluk yok) */
export function kullaniciAdiSadelestir(metin: string) {
  return metin
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30);
}

export async function profilBilgim(): Promise<ProfilVerisi | null> {
  const uid = await oturumuSagla();
  const { data, error } = await supabase.from('profiles').select('display_name,username,city,bio,avatar_url').eq('id', uid).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProfilVerisi | null;
}

export async function kullaniciAdiMusait(ad: string): Promise<boolean> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc('kullanici_adi_musait', { ad });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function profilGuncelle(p: ProfilBilgisi): Promise<ProfilBilgisi> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc('profil_guncelle', { p });
  if (error) throw new Error(error.message);
  return data as ProfilBilgisi;
}
