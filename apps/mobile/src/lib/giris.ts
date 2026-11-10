/**
 * Google ve Apple ile giriş.
 *
 * - Apple (yalnızca iOS): telefonun kendi "Apple ile giriş" penceresi; gelen kimlik jetonu Supabase'e verilir.
 * - Google (iOS + Android): Supabase'in giriş sayfası uygulama içi tarayıcıda açılır (PKCE akışı).
 *
 * Kullanıcı geçici (anonim) hesaptaysa yeni hesap açılmaz; Google / Apple kimliği bu hesaba
 * bağlanır, kullanıcı kimliği ve kayıtlar aynı kalır. O kimlik başka bir Lykiva hesabına zaten
 * bağlıysa (ör. başka telefonda giriş yapılmış) asıl hesaba girilir ve geçici hesaptaki kayıtlar
 * oraya taşınır (`hesabi_devral`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { pushKapat } from '@/lib/push';
import { supabase, supabaseHazir } from '@/lib/supabase';

/** Tarayıcıdan dönüş adresi. Supabase'de izinli yönlendirmeler listesinde olmalı. */
export const GIRIS_DONUS = 'lykiva://giris-donus';

const ATLANDI = 'lykiva.giris.atlandi.v1';

export type Saglayici = 'google' | 'apple';

export type Hesap = {
  id: string;
  gecici: boolean;
  saglayicilar: Saglayici[];
  eposta: string | null;
};

export type GirisSonucu = {
  /** Başka hesaptan taşınan aktivite sayısı (çoğunlukla 0) */
  tasinan: number;
};

/** Kullanıcı pencereyi kapattı; hata gösterilmez */
export class GirisIptal extends Error {
  constructor() {
    super('Giriş iptal edildi');
  }
}

/* ------------------------------------------------------------------ */
/* Hesap durumu                                                        */
/* ------------------------------------------------------------------ */

function hesapOlustur(user: User | null | undefined): Hesap | null {
  if (!user) return null;
  const saglayicilar = (user.identities ?? [])
    .map((i) => i.provider)
    .filter((p): p is Saglayici => p === 'google' || p === 'apple');
  return {
    id: user.id,
    gecici: !!user.is_anonymous && saglayicilar.length === 0,
    saglayicilar,
    eposta: user.email || null,
  };
}

/** Oturum değiştikçe güncellenen hesap bilgisi. `undefined`: henüz yükleniyor, `null`: oturum yok. */
export function useHesap(): Hesap | null | undefined {
  const [hesap, setHesap] = useState<Hesap | null | undefined>(undefined);
  useEffect(() => {
    let acik = true;
    supabase.auth.getSession().then(({ data }) => {
      if (acik) setHesap(hesapOlustur(data.session?.user));
    });
    const { data } = supabase.auth.onAuthStateChange((_olay, session: Session | null) => {
      if (acik) setHesap(hesapOlustur(session?.user));
    });
    return () => {
      acik = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return hesap;
}

/**
 * Açılışta giriş ekranı gösterilsin mi? Sunucu anahtarı yoksa (örnek veri modu) hayır.
 * Kullanıcı "Şimdilik geç" dediyse bir daha kendiliğinden açılmaz; profilden açılabilir.
 */
export function useGirisGerekli(): boolean | undefined {
  const hesap = useHesap();
  const [atlandi, setAtlandi] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(ATLANDI)
      .then((v) => setAtlandi(v === '1'))
      .catch(() => setAtlandi(false));
  }, []);
  if (!supabaseHazir) return false;
  if (hesap === undefined || atlandi === undefined) return undefined;
  if (hesap && !hesap.gecici) return false;
  return !atlandi;
}

export async function girisiAtla() {
  await AsyncStorage.setItem(ATLANDI, '1').catch(() => undefined);
}

export async function appleKullanilabilir(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  // Ücretsiz Apple hesabıyla derlenmişse yetki yok (bkz. app.config.js)
  if (process.env.EXPO_PUBLIC_APPLE_GIRIS === '0') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/* ------------------------------------------------------------------ */
/* Apple                                                               */
/* ------------------------------------------------------------------ */

export async function appleIleGiris(): Promise<GirisSonucu> {
  // Tekrar oynatma saldırısına karşı: Apple'a özet, Supabase'e ham değer verilir
  const ham = Crypto.randomUUID();
  const ozet = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, ham);

  let kimlik: AppleAuthentication.AppleAuthenticationCredential;
  try {
    kimlik = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: ozet,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new GirisIptal();
    throw e;
  }
  if (!kimlik.identityToken) throw new Error('Apple kimlik bilgisi gelmedi');

  // Apple adı yalnızca ilk girişte verir, jetonun içinde de yoktur
  const ad = [kimlik.fullName?.givenName, kimlik.fullName?.familyName].filter(Boolean).join(' ') || null;
  const jeton = kimlik.identityToken;

  const oturum = (await supabase.auth.getSession()).data.session;
  if (oturum?.user.is_anonymous) {
    const { error } = await supabase.auth.linkIdentity({ provider: 'apple', token: jeton, nonce: ham });
    if (!error) {
      await profiliTamamla({ ad });
      return { tasinan: 0 };
    }
    if (!baskaHesaptaMi(error)) throw error;
    // Bu Apple hesabı başka bir Lykiva hesabında: oraya geç, kayıtları taşı
    const kod = await devirKoduAl();
    const { error: girisHatasi } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: jeton, nonce: ham });
    if (girisHatasi) throw girisHatasi;
    const tasinan = await devral(kod);
    await profiliTamamla({ ad });
    return { tasinan };
  }

  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: jeton, nonce: ham });
  if (error) throw error;
  await profiliTamamla({ ad });
  return { tasinan: 0 };
}

/* ------------------------------------------------------------------ */
/* Google                                                              */
/* ------------------------------------------------------------------ */

export async function googleIleGiris(): Promise<GirisSonucu> {
  const oturum = (await supabase.auth.getSession()).data.session;
  if (oturum?.user.is_anonymous) {
    const sonuc = await tarayicidaGiris('bagla');
    if (sonuc === 'tamam') {
      await profiliTamamla({});
      return { tasinan: 0 };
    }
    // Bu Google hesabı başka bir Lykiva hesabında: oraya gir, kayıtları taşı.
    // Google oturumu tarayıcıda açık kaldığı için ikinci pencere genelde hemen kapanır.
    const kod = await devirKoduAl();
    await tarayicidaGiris('gir');
    const tasinan = await devral(kod);
    await profiliTamamla({});
    return { tasinan };
  }
  await tarayicidaGiris('gir');
  await profiliTamamla({});
  return { tasinan: 0 };
}

/** Tarayıcıda Google girişini yapar. 'baskaHesapta': bağlanmak istenen kimlik başka hesaba ait. */
async function tarayicidaGiris(tur: 'bagla' | 'gir'): Promise<'tamam' | 'baskaHesapta'> {
  const secenekler = { redirectTo: GIRIS_DONUS, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } };
  const { data, error } =
    tur === 'bagla'
      ? await supabase.auth.linkIdentity({ provider: 'google', options: secenekler })
      : await supabase.auth.signInWithOAuth({ provider: 'google', options: secenekler });
  if (error) throw error;
  if (!data.url) throw new Error('Giriş adresi alınamadı');

  const sonuc = await WebBrowser.openAuthSessionAsync(data.url, GIRIS_DONUS);
  if (sonuc.type !== 'success') throw new GirisIptal();

  const p = adrestenParametreler(sonuc.url);
  if (p.error_code === 'identity_already_exists' || /already linked/i.test(p.error_description ?? '')) {
    if (tur === 'bagla') return 'baskaHesapta';
  }
  if (p.error || p.error_code) throw new Error(p.error_description || p.error || 'Google girişi tamamlanamadı');
  if (!p.code) throw new Error('Google girişi tamamlanamadı (kod gelmedi)');

  const { error: degisimHatasi } = await supabase.auth.exchangeCodeForSession(p.code);
  if (degisimHatasi) throw degisimHatasi;
  // Bağlamadan sonra oturumdaki kullanıcı bilgisi (kimlikler) tazelensin
  if (tur === 'bagla') await supabase.auth.refreshSession();
  return 'tamam';
}

/** `?a=1#b=2` biçimindeki dönüş adresinden parametreleri okur (sorgu + parça birlikte) */
export function adrestenParametreler(adres: string): Record<string, string> {
  const sonuc: Record<string, string> = {};
  const parcalar: string[] = [];
  const soru = adres.indexOf('?');
  const diyez = adres.indexOf('#');
  if (soru >= 0) parcalar.push(adres.slice(soru + 1, diyez > soru ? diyez : undefined));
  if (diyez >= 0) parcalar.push(adres.slice(diyez + 1));
  for (const parca of parcalar) {
    for (const cift of parca.split('&')) {
      if (!cift) continue;
      const esit = cift.indexOf('=');
      const anahtar = decodeURIComponent((esit >= 0 ? cift.slice(0, esit) : cift).replace(/\+/g, ' '));
      const deger = esit >= 0 ? decodeURIComponent(cift.slice(esit + 1).replace(/\+/g, ' ')) : '';
      sonuc[anahtar] = deger;
    }
  }
  return sonuc;
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function baskaHesaptaMi(e: AuthError): boolean {
  return e.code === 'identity_already_exists' || /already linked/i.test(e.message);
}

async function devirKoduAl(): Promise<string> {
  const { data, error } = await supabase.rpc('devir_kodu_al');
  if (error || typeof data !== 'string') throw error ?? new Error('Devir kodu alınamadı');
  return data;
}

async function devral(kod: string): Promise<number> {
  const { data, error } = await supabase.rpc('hesabi_devral', { p_kod: kod });
  if (error) {
    // Giriş başarılı; taşıma başarısız olsa da kullanıcıyı içeride bırak
    if (__DEV__) console.warn('[giris] kayıtlar taşınamadı', error.message);
    return 0;
  }
  return typeof data === 'number' ? data : 0;
}

/**
 * Profil yeni açıldıysa (ad "Yeni kullanıcı", fotoğraf yok) Google / Apple'dan gelen ad ve
 * fotoğrafla doldurur. Daha önce düzenlenmiş profile dokunmaz.
 */
async function profiliTamamla({ ad }: { ad?: string | null }) {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    const kimlikVerisi = (user.identities ?? [])
      .filter((i) => i.provider === 'google' || i.provider === 'apple')
      .map((i) => i.identity_data ?? {});
    const ilk = (anahtarlar: string[]) => {
      for (const v of kimlikVerisi) {
        for (const k of anahtarlar) {
          const x = v[k];
          if (typeof x === 'string' && x.trim()) return x.trim();
        }
      }
      return null;
    };
    const yeniAd = ad || ilk(['full_name', 'name']);
    const foto = ilk(['avatar_url', 'picture']);

    const { data: profil } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle();
    if (!profil) return;
    const degisiklik: { display_name?: string; avatar_url?: string } = {};
    if (yeniAd && profil.display_name === 'Yeni kullanıcı') degisiklik.display_name = yeniAd.slice(0, 60);
    if (foto && !profil.avatar_url) degisiklik.avatar_url = foto;
    if (Object.keys(degisiklik).length) await supabase.from('profiles').update(degisiklik).eq('id', user.id);
  } catch (e) {
    if (__DEV__) console.warn('[giris] profil tamamlanamadı', e);
  }
}

/** Çıkış. Telefonda gönderilmemiş kayıt varken çağrılmamalı (bkz. ayarlar ekranı). */
export async function cikisYap() {
  // Telefon bildirimleri önceki hesaba gitmesin (kalıcı kapatma değil; yeni hesapta yeniden açılır)
  await pushKapat(false).catch(() => undefined);
  await supabase.auth.signOut();
  await AsyncStorage.removeItem(ATLANDI).catch(() => undefined);
}
