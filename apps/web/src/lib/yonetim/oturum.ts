/**
 * Yönetim paneli oturumu: Supabase (GoTrue) e-posta + şifre girişi.
 * Erişim ve yenileme jetonu tarayıcının okuyamadığı (HttpOnly) tek bir çerezde tutulur;
 * süresi dolmak üzereyken src/proxy.ts yeniler. Bu dosya hem proxy'de hem sunucu kodunda kullanılır.
 */
import { supabaseAyari } from '@/lib/sunucu';

export const CEREZ = 'lykiva_yonetim';
export const CEREZ_SECENEKLERI = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/admin',
  // Yenileme jetonu bu süre kullanılmazsa yeniden giriş gerekir
  maxAge: 60 * 60 * 24 * 7,
};

export type Oturum = { a: string; r: string; e: number };

export function oturumuCoz(deger: string | undefined): Oturum | null {
  if (!deger) return null;
  try {
    const o = JSON.parse(Buffer.from(deger, 'base64url').toString('utf8')) as Oturum;
    return typeof o.a === 'string' && typeof o.r === 'string' && typeof o.e === 'number' ? o : null;
  } catch {
    return null;
  }
}

export const oturumuYaz = (o: Oturum) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');

type JetonYaniti = { access_token: string; refresh_token: string; expires_in: number; expires_at?: number };

function jetondanOturum(j: JetonYaniti): Oturum {
  return { a: j.access_token, r: j.refresh_token, e: j.expires_at ?? Math.floor(Date.now() / 1000) + j.expires_in };
}

async function jetonIste(tur: 'password' | 'refresh_token', govde: Record<string, string>): Promise<{ oturum: Oturum } | { hata: string; kod: number }> {
  const ayar = supabaseAyari();
  if (!ayar) return { hata: 'Sunucu ayarı eksik (SUPABASE_ANON_KEY)', kod: 500 };
  try {
    const r = await fetch(`${ayar.url}/auth/v1/token?grant_type=${tur}`, {
      method: 'POST',
      headers: { apikey: ayar.anahtar, 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error_description?: string; msg?: string; error_code?: string };
      return { hata: j.error_code ?? j.error_description ?? j.msg ?? `HTTP ${r.status}`, kod: r.status };
    }
    return { oturum: jetondanOturum((await r.json()) as JetonYaniti) };
  } catch {
    return { hata: 'Sunucuya ulaşılamadı', kod: 0 };
  }
}

export const sifreyleGiris = (eposta: string, sifre: string) => jetonIste('password', { email: eposta, password: sifre });
export const oturumuYenile = (o: Oturum) => jetonIste('refresh_token', { refresh_token: o.r });

/** Erişim jetonu 60 saniyeden az kaldıysa yenilenmeli */
export const yenilenmeli = (o: Oturum) => o.e * 1000 - Date.now() < 60_000;

/** Supabase fonksiyonu (RPC) çağrısı; kullanıcının kendi jetonuyla */
export async function rpcCagir(jeton: string, ad: string, args: Record<string, unknown> = {}) {
  const ayar = supabaseAyari();
  if (!ayar) return { ok: false as const, durum: 500, kod: 'ayarsiz', mesaj: 'Sunucu ayarı eksik (SUPABASE_ANON_KEY)' };
  try {
    const r = await fetch(`${ayar.url}/rest/v1/rpc/${ad}`, {
      method: 'POST',
      headers: { apikey: ayar.anahtar, Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const e = (j ?? {}) as { code?: string; message?: string };
      return { ok: false as const, durum: r.status, kod: e.code ?? '', mesaj: e.message ?? `HTTP ${r.status}` };
    }
    return { ok: true as const, veri: j as unknown };
  } catch {
    return { ok: false as const, durum: 0, kod: 'ag', mesaj: 'Sunucuya ulaşılamadı' };
  }
}

/** Çıkışta jetonu sunucuda da geçersiz kıl (başarısız olsa da çerez silinir) */
export async function sunucudanCik(jeton: string) {
  const ayar = supabaseAyari();
  if (!ayar) return;
  await fetch(`${ayar.url}/auth/v1/logout`, {
    method: 'POST',
    headers: { apikey: ayar.anahtar, Authorization: `Bearer ${jeton}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
}
