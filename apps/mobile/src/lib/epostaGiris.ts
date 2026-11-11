/**
 * E-posta + şifreyle giriş, kayıt ve şifre sıfırlama.
 *
 * Doğrulama bağlantı yerine **e-postadaki kodla** yapılır (kullanıcı kodu uygulamaya yazar): posta
 * bilgisayarda açılsa da çalışır, uygulamaya dönüş bağlantısı gerekmez. E-posta şablonları
 * `apps/web/public/eposta/` altında; sunucu ayarı `supabase/README.md` > E-posta.
 *
 * Geçici (anonim) hesaptaysa:
 * - Kayıt yeni hesap açmaz; e-posta bu hesaba eklenir (`email_change` kodu), kod doğrulanınca şifre
 *   konur. Kullanıcı kimliği ve kayıtlar aynı kalır.
 * - Giriş ya da şifre sıfırlama başka (asıl) hesaba geçer; geçici hesaptaki kayıtlar oraya taşınır
 *   (`hesabi_devral`), tıpkı Google / Apple girişinde olduğu gibi.
 */
import type { AuthError } from '@supabase/supabase-js';

import { devirKoduAl, devral, type GirisSonucu, profiliTamamla } from '@/lib/giris';
import { supabase } from '@/lib/supabase';

export const SIFRE_EN_AZ = 8;

/**
 * Hangi kodu beklediğimiz:
 * - `kayit`: oturum yokken açılan yeni hesap (ya da doğrulanmamış hesaba giriş denemesi)
 * - `ekle`: geçici hesaba e-posta eklenmesi
 * - `sifre`: şifre sıfırlama
 */
export type KodTuru = 'kayit' | 'ekle' | 'sifre';

/** Bu e-postayla zaten bir hesap var: kullanıcı giriş yapmalı */
export class EpostaKayitli extends Error {
  constructor() {
    super('Bu e-postayla açılmış bir hesap var.');
  }
}

/** Hesap var ama e-posta doğrulanmamış: yeni kod gönderildi */
export class EpostaDogrulanmadi extends Error {
  constructor() {
    super('E-posta doğrulanmamış.');
  }
}

export function epostaSadelestir(eposta: string): string {
  return eposta.trim().toLowerCase();
}

export function epostaGecerli(eposta: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(epostaSadelestir(eposta));
}

/** Kod yalnızca rakam; sunucu ayarına göre 6–10 hane */
export function kodSadelestir(kod: string): string {
  return kod.replace(/\D/g, '').slice(0, 10);
}

async function geciciMi(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session?.user.is_anonymous;
}

/** Geçici hesaptan çıkmadan önce devir kodu alınır; alınamazsa giriş yine de sürer (kayıtlar sunucuda kalır) */
async function devirKoduHazirla(): Promise<string | null> {
  if (!(await geciciMi())) return null;
  try {
    return await devirKoduAl();
  } catch (e) {
    if (__DEV__) console.warn('[eposta] devir kodu alınamadı', e);
    return null;
  }
}

function epostaVarMi(e: AuthError): boolean {
  return e.code === 'email_exists' || e.code === 'user_already_exists' || /already (been )?registered|already exists/i.test(e.message);
}

/* ------------------------------------------------------------------ */
/* Giriş                                                               */
/* ------------------------------------------------------------------ */

export async function epostaIleGiris(eposta: string, sifre: string): Promise<GirisSonucu> {
  const email = epostaSadelestir(eposta);
  const kod = await devirKoduHazirla();
  const { error } = await supabase.auth.signInWithPassword({ email, password: sifre });
  if (error) {
    if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
      const { error: gonderHatasi } = await supabase.auth.resend({ type: 'signup', email });
      if (gonderHatasi) throw gonderHatasi;
      throw new EpostaDogrulanmadi();
    }
    throw error;
  }
  const tasinan = kod ? await devral(kod) : 0;
  return { tasinan };
}

/* ------------------------------------------------------------------ */
/* Kayıt                                                               */
/* ------------------------------------------------------------------ */

/**
 * Kayıt başlatır ve doğrulama kodunu gönderir. Dönen tür `kodDogrula`ya verilir.
 * `null`: sunucu doğrulama istemedi, hesap hazır.
 */
export async function epostaIleKayit(eposta: string, sifre: string, ad?: string | null): Promise<KodTuru | null> {
  const email = epostaSadelestir(eposta);

  if (await geciciMi()) {
    // Şifre, e-posta doğrulandıktan sonra konur (Supabase'in geçici hesap kuralı)
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      if (epostaVarMi(error)) throw new EpostaKayitli();
      throw error;
    }
    return 'ekle';
  }

  const { data, error } = await supabase.auth.signUp({ email, password: sifre });
  if (error) {
    if (epostaVarMi(error)) throw new EpostaKayitli();
    throw error;
  }
  // Doğrulama açıkken var olan e-posta için sunucu hata vermez, kimliksiz bir kullanıcı döner
  if (data.user && (data.user.identities?.length ?? 0) === 0) throw new EpostaKayitli();
  if (data.session) {
    await profiliTamamla({ ad });
    return null;
  }
  return 'kayit';
}

/**
 * E-postadaki kodu doğrular ve girişi tamamlar.
 * `ekle` için `sifre` zorunlu (kod doğrulanınca hesaba konur).
 */
export async function kodDogrula(
  eposta: string,
  kod: string,
  tur: Exclude<KodTuru, 'sifre'>,
  { sifre, ad }: { sifre?: string; ad?: string | null } = {},
): Promise<GirisSonucu> {
  const email = epostaSadelestir(eposta);
  const token = kodSadelestir(kod);

  if (tur === 'ekle') {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email_change' });
    if (error) throw error;
    if (sifre) {
      const { error: sifreHatasi } = await supabase.auth.updateUser({ password: sifre });
      if (sifreHatasi && sifreHatasi.code !== 'same_password') throw sifreHatasi;
    }
    // Oturumdaki kullanıcı bilgisi (artık geçici değil, e-posta kimliği) tazelensin
    await supabase.auth.refreshSession();
    await profiliTamamla({ ad });
    return { tasinan: 0 };
  }

  // Doğrulanmamış hesaba geçici hesaptan girilmişse kayıtlar oraya taşınır
  const devir = await devirKoduHazirla();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  const tasinan = devir ? await devral(devir) : 0;
  await profiliTamamla({ ad });
  return { tasinan };
}

/** Kodu yeniden gönderir */
export async function koduTekrarGonder(eposta: string, tur: KodTuru) {
  const email = epostaSadelestir(eposta);
  const { error } =
    tur === 'sifre'
      ? await supabase.auth.resetPasswordForEmail(email)
      : await supabase.auth.resend({ type: tur === 'ekle' ? 'email_change' : 'signup', email });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Şifre sıfırlama                                                     */
/* ------------------------------------------------------------------ */

/** Sıfırlama kodunu gönderir. Hesap yoksa da hata vermez (kimin kayıtlı olduğu öğrenilemesin). */
export async function sifreSifirlamaKoduGonder(eposta: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(epostaSadelestir(eposta));
  if (error) throw error;
}

/** Kodu doğrular (bu, hesaba girer), yeni şifreyi koyar */
export async function sifreyiYenile(eposta: string, kod: string, yeniSifre: string): Promise<GirisSonucu> {
  const email = epostaSadelestir(eposta);
  const devir = await devirKoduHazirla();
  const { error } = await supabase.auth.verifyOtp({ email, token: kodSadelestir(kod), type: 'recovery' });
  if (error) throw error;
  const { error: sifreHatasi } = await supabase.auth.updateUser({ password: yeniSifre });
  if (sifreHatasi && sifreHatasi.code !== 'same_password') throw sifreHatasi;
  const tasinan = devir ? await devral(devir) : 0;
  return { tasinan };
}

/* ------------------------------------------------------------------ */
/* Hata metinleri                                                      */
/* ------------------------------------------------------------------ */

export function epostaHataMetni(e: unknown): string {
  if (e instanceof EpostaKayitli) return 'Bu e-postayla açılmış bir hesap var. Giriş yap ya da şifreni sıfırla.';
  const kod = (e as { code?: string } | null)?.code;
  const m = e instanceof Error ? e.message : String(e);
  switch (kod) {
    case 'invalid_credentials':
      return 'E-posta ya da şifre yanlış.';
    case 'otp_expired':
      return 'Kod yanlış ya da süresi dolmuş. Yeni kod isteyebilirsin.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Çok sık denendi. Birkaç dakika bekleyip tekrar dene.';
    case 'weak_password':
      return `Şifre çok zayıf. En az ${SIFRE_EN_AZ} karakter, harf ve rakam kullan.`;
    case 'email_address_invalid':
      return 'Bu e-posta adresi geçersiz görünüyor.';
    case 'signup_disabled':
      return 'Yeni hesap açma şu an kapalı.';
    case 'email_provider_disabled':
      return 'E-postayla giriş sunucuda kapalı.';
    case 'user_banned':
      return 'Bu hesap kullanıma kapatılmış.';
  }
  if (/network|fetch|internet/i.test(m)) return 'İnternet bağlantısı yok gibi görünüyor. Bağlanınca tekrar dene.';
  if (/error sending|sending .*email|smtp/i.test(m)) return 'E-posta gönderilemedi. Biraz sonra tekrar dene.';
  if (/token has expired|invalid.*(otp|token)/i.test(m)) return 'Kod yanlış ya da süresi dolmuş. Yeni kod isteyebilirsin.';
  return `Olmadı: ${m}`;
}
