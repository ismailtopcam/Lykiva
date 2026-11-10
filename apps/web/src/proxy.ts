/**
 * Yönetim paneli koruması: /admin altındaki her istekte oturum çerezine bakar.
 * Yoksa giriş sayfasına yönlendirir; erişim jetonu bitmek üzereyse yeniler ve çerezi günceller.
 * Asıl yetki kontrolü veritabanındadır (her panel fonksiyonu yöneticiliği kontrol eder).
 */
import { NextResponse, type NextRequest } from 'next/server';

import { CEREZ, CEREZ_SECENEKLERI, oturumuCoz, oturumuYaz, oturumuYenile, yenilenmeli } from '@/lib/yonetim/oturum';

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === '/admin/giris') return NextResponse.next();

  const giriseGit = () => {
    const url = new URL('/admin/giris', request.url);
    url.searchParams.set('sonra', pathname + search);
    const res = NextResponse.redirect(url);
    res.cookies.set(CEREZ, '', { ...CEREZ_SECENEKLERI, maxAge: 0 });
    return res;
  };

  const oturum = oturumuCoz(request.cookies.get(CEREZ)?.value);
  if (!oturum) return giriseGit();
  if (!yenilenmeli(oturum)) return NextResponse.next();

  const yeni = await oturumuYenile(oturum);
  if (!('oturum' in yeni)) return giriseGit();
  const deger = oturumuYaz(yeni.oturum);
  // Bu istekte sayfayı çizen sunucu kodu da yeni jetonu görsün
  request.cookies.set(CEREZ, deger);
  const res = NextResponse.next({ request });
  res.cookies.set(CEREZ, deger, CEREZ_SECENEKLERI);
  return res;
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
