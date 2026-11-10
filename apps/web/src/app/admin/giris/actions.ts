'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { CEREZ, CEREZ_SECENEKLERI, oturumuCoz, oturumuYaz, rpcCagir, sifreyleGiris, sunucudanCik } from '@/lib/yonetim/oturum';

export type GirisDurumu = { hata: string | null; eposta: string };

/** Yalnızca panel içine dönülür (başka siteye yönlendirme açığı olmasın) */
function guvenliHedef(sonra: FormDataEntryValue | null) {
  const s = typeof sonra === 'string' ? sonra : '';
  return s.startsWith('/admin') && !s.startsWith('//') && !s.startsWith('/admin/giris') ? s : '/admin';
}

export async function girisYap(_onceki: GirisDurumu, form: FormData): Promise<GirisDurumu> {
  const eposta = String(form.get('eposta') ?? '').trim().slice(0, 200);
  const sifre = String(form.get('sifre') ?? '');
  if (!eposta || !sifre) return { hata: 'E-posta ve şifreyi yaz.', eposta };

  const sonuc = await sifreyleGiris(eposta, sifre);
  if (!('oturum' in sonuc)) {
    const hata =
      sonuc.kod === 400 || sonuc.kod === 401
        ? 'E-posta ya da şifre yanlış.'
        : sonuc.kod === 429
          ? 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.'
          : `Giriş yapılamadı: ${sonuc.hata}`;
    return { hata, eposta };
  }

  const yetki = await rpcCagir(sonuc.oturum.a, 'yonetici_mi');
  if (!yetki.ok) return { hata: `Yetki kontrol edilemedi: ${yetki.mesaj}`, eposta };
  if (yetki.veri !== true) {
    await sunucudanCik(sonuc.oturum.a);
    return { hata: 'Bu hesabın yönetim yetkisi yok.', eposta };
  }

  (await cookies()).set(CEREZ, oturumuYaz(sonuc.oturum), CEREZ_SECENEKLERI);
  redirect(guvenliHedef(form.get('sonra')));
}

export async function cikisYap() {
  const depo = await cookies();
  const oturum = oturumuCoz(depo.get(CEREZ)?.value);
  if (oturum) await sunucudanCik(oturum.a);
  depo.set(CEREZ, '', { ...CEREZ_SECENEKLERI, maxAge: 0 });
  redirect('/admin/giris');
}
