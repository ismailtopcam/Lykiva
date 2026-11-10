'use server';

import { revalidatePath } from 'next/cache';

import { YonetimHatasi, yonetimRpc } from '@/lib/yonetim/veri';

const kimlik = (f: FormData, ad = 'id') => {
  const v = String(f.get(ad) ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(v)) throw new Error('Geçersiz kimlik');
  return v;
};

export async function sikayetGuncelle(f: FormData) {
  await yonetimRpc('yonetim_sikayet_guncelle', { sikayet: kimlik(f), durum: String(f.get('durum')), notu: String(f.get('notu') ?? '') });
  revalidatePath('/admin', 'layout');
}

export async function aktiviteSil(f: FormData) {
  await yonetimRpc('yonetim_aktivite_sil', { aktivite: kimlik(f) });
  revalidatePath('/admin', 'layout');
}

export async function rotaGizle(f: FormData) {
  await yonetimRpc('yonetim_rota_gizle', { rota: kimlik(f) });
  revalidatePath('/admin', 'layout');
}

export async function grupSil(f: FormData) {
  await yonetimRpc('yonetim_grup_sil', { g: kimlik(f) });
  revalidatePath('/admin', 'layout');
}

export async function etkinlikSil(f: FormData) {
  await yonetimRpc('yonetim_etkinlik_sil', { e: kimlik(f) });
  revalidatePath('/admin', 'layout');
}

export async function yorumSil(f: FormData) {
  await yonetimRpc('yonetim_yorum_sil', { yorum: kimlik(f) });
  revalidatePath('/admin', 'layout');
}

export async function mesajSil(f: FormData) {
  await yonetimRpc('yonetim_mesaj_sil', { mesaj: kimlik(f) });
  revalidatePath('/admin', 'layout');
}

export async function engelDegistir(f: FormData) {
  await yonetimRpc('yonetim_engelle', { kisi: kimlik(f), engelli: f.get('engelli') === 'true' });
  revalidatePath('/admin', 'layout');
}

export async function yetkiDegistir(f: FormData) {
  await yonetimRpc('yonetim_yetki', { kisi: kimlik(f), yonetici: f.get('yonetici') === 'true' });
  revalidatePath('/admin', 'layout');
}

export type AyarDurumu = { mesaj: string | null; hata: string | null };

export async function siteAyarlariKaydet(_onceki: AyarDurumu, f: FormData): Promise<AyarDurumu> {
  const p = {
    iletisim_eposta: String(f.get('iletisim_eposta') ?? '').trim(),
    veri_sorumlusu: String(f.get('veri_sorumlusu') ?? '').trim(),
    veri_sorumlusu_adres: String(f.get('veri_sorumlusu_adres') ?? '').trim(),
  };
  try {
    await yonetimRpc('yonetim_site_ayarlari_guncelle', { p });
  } catch (e) {
    // Oturum düşmüşse yonetimRpc girişe yönlendirir (o hata yakalanmamalı)
    if (e instanceof YonetimHatasi) return { mesaj: null, hata: e.message };
    throw e;
  }
  revalidatePath('/admin', 'layout');
  return { mesaj: 'Kaydedildi. Gizlilik, koşullar ve hesap silme sayfaları yeni bilgilerle görünür.', hata: null };
}
