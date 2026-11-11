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

export async function meydanOkumaSil(f: FormData) {
  await yonetimRpc('meydan_okuma_sil', { p_id: kimlik(f) });
  revalidatePath('/admin', 'layout');
}

const OLCULER = ['mesafe', 'sure', 'sayi', 'tirmanis'] as const;
const TURLER = ['bike', 'mtb', 'run', 'walk', 'hike', 'trail_run'] as const;

/** "2026-11-01" → Türkiye saatiyle (UTC+3, yaz saati yok) o günün başı; `gunEkle` gün sonrası */
function gunBasi(s: string, gunEkle = 0): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00+03:00`);
  if (!Number.isFinite(t)) return null;
  return new Date(t + gunEkle * 86_400_000).toISOString();
}

export async function meydanOkumaOlustur(_onceki: AyarDurumu, f: FormData): Promise<AyarDurumu> {
  const olcu = String(f.get('olcu') ?? '');
  const girdi = Number(String(f.get('hedef') ?? '').replace(',', '.'));
  const baslangic = gunBasi(String(f.get('baslangic') ?? ''));
  // Bitiş günü dahil: ertesi günün başı
  const bitis = gunBasi(String(f.get('bitis') ?? ''), 1);
  const turler = f.getAll('turler').map(String).filter((t) => (TURLER as readonly string[]).includes(t));
  if (!(OLCULER as readonly string[]).includes(olcu)) return { mesaj: null, hata: 'Ölçü seçilmeli.' };
  if (!Number.isFinite(girdi) || girdi <= 0) return { mesaj: null, hata: 'Hedef sıfırdan büyük bir sayı olmalı.' };
  if (!baslangic || !bitis) return { mesaj: null, hata: 'Başlangıç ve bitiş tarihi gerekli.' };
  // Paneldeki birimden veritabanı birimine: km → m, saat → sn
  const hedef = olcu === 'mesafe' ? Math.round(girdi * 1000) : olcu === 'sure' ? Math.round(girdi * 3600) : Math.round(girdi);
  try {
    await yonetimRpc('meydan_okuma_olustur', {
      p: {
        baslik: String(f.get('baslik') ?? '').trim(),
        aciklama: String(f.get('aciklama') ?? '').trim(),
        olcu,
        hedef,
        turler,
        baslangic,
        bitis,
        group_id: null,
      },
    });
  } catch (e) {
    if (e instanceof YonetimHatasi) return { mesaj: null, hata: e.message };
    throw e;
  }
  revalidatePath('/admin', 'layout');
  return { mesaj: 'Meydan okuma açıldı. Uygulamada herkesin "Meydan okumalar" listesinde görünür.', hata: null };
}
