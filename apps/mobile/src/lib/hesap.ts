/**
 * Hesabı kalıcı olarak silme (App Store ve Google Play bunu uygulama içinden ister).
 * Sunucu: supabase/migrations/20261111000000_hesap_silme_ayarlar.sql > hesabimi_sil()
 *
 * Sıra: telefon bildirim jetonu → depodaki fotoğraflar (Storage API; veritabanı satırını silmek dosyayı silmez)
 * → hesabimi_sil() (kurduğu gruplar devredilir, gerisi zincirleme silinir) → bu telefondaki oturum ve kayıtlar.
 */
import { yerelKayitlariTemizle } from '@/kayit/kuyruk';
import { yerelOturumuKapat } from '@/lib/giris';
import { pushKapat } from '@/lib/push';
import { oturumuSagla, supabase } from '@/lib/supabase';

/** Depodaki fotoğrafları siler; başarısız olursa hesap silmeyi engellemez */
async function fotograflariSil(uid: string) {
  try {
    const { data: profil } = await supabase.storage.from('profil').list(uid, { limit: 1000 });
    const yollar = (profil ?? []).map((d) => `${uid}/${d.name}`);
    if (yollar.length) await supabase.storage.from('profil').remove(yollar);
  } catch {
    // depo yoksa ya da erişilemezse geç
  }
  try {
    const { data: aktiviteler } = await supabase.from('activities').select('id').eq('owner_id', uid);
    const idler = (aktiviteler ?? []).map((a) => a.id as string);
    for (let i = 0; i < idler.length; i += 100) {
      const { data: molalar } = await supabase.from('activity_stops').select('photo_urls').in('activity_id', idler.slice(i, i + 100));
      const yollar = (molalar ?? []).flatMap((m) => (m.photo_urls ?? []) as string[]);
      for (let j = 0; j < yollar.length; j += 100) await supabase.storage.from('mola').remove(yollar.slice(j, j + 100));
    }
  } catch {
    // geç
  }
}

export async function hesabiSil() {
  const uid = await oturumuSagla();
  await pushKapat(false).catch(() => undefined);
  await fotograflariSil(uid);
  const { error } = await supabase.rpc('hesabimi_sil');
  if (error) throw new Error(error.message);
  await yerelOturumuKapat();
  await yerelKayitlariTemizle();
}
