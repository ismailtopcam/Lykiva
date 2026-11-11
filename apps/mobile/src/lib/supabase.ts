/**
 * Supabase istemcisi (kendi sunucumuz: api.lykiva.app).
 *
 * Anahtar .env dosyasından gelir: EXPO_PUBLIC_SUPABASE_ANON_KEY
 * (anon anahtarı herkese açık olacak şekilde tasarlanmıştır; veriyi veritabanı kuralları korur).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { $t } from '@/i18n';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://api.lykiva.app';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Anahtar girilmemişse uygulama örnek verilerle çalışır, kayıtlar telefonda bekler */
export const supabaseHazir = ANON_KEY.length > 0;

export const supabase = createClient(SUPABASE_URL, ANON_KEY || 'anahtar-eksik', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Google girişi tarayıcıda yapılır; dönüşte gelen kod telefonda saklanan doğrulayıcıyla oturuma çevrilir
    flowType: 'pkce',
  },
});

// Uygulama ön plandayken oturum yenilensin, arka plandayken dursun
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/**
 * Oturum yoksa geçici (anonim) hesap açar. Google / Apple ile giriş yapılınca
 * bu hesap onlara bağlanır, kayıtlar kaybolmaz (bkz. lib/giris.ts).
 */
export async function oturumuSagla(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  if (!supabaseHazir) throw new Error($t('lib_supabase.sunucu_anahtari_girilmemis_apps'));
  const { data: yeni, error } = await supabase.auth.signInAnonymously();
  if (error || !yeni.user) throw error ?? new Error($t('lib_supabase.gecici_hesap_acilamadi'));
  return yeni.user.id;
}
