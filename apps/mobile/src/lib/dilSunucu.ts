/**
 * Uygulama dilini sunucuya bildirir (profiles.dil, supabase > 20261112000000_dil.sql): telefon bildirimleri
 * o dilde gönderilir. Açılışta, dil değişince ve giriş yapılınca çağrılır; oturum yoksa bir şey yapmaz
 * (yalnızca bunun için geçici hesap açılmaz).
 */
import { aktifDil } from '@lykiva/shared';

import { supabase, supabaseHazir } from './supabase';

let gonderilen: { kullanici: string; dil: string } | null = null;

export async function bildirimDiliniGuncelle(): Promise<void> {
  if (!supabaseHazir) return;
  try {
    const { data } = await supabase.auth.getSession();
    const kullanici = data.session?.user.id;
    if (!kullanici) return;
    const dil = aktifDil();
    if (gonderilen?.kullanici === kullanici && gonderilen.dil === dil) return;
    const { error } = await supabase.rpc('dil_ayarla', { p_dil: dil });
    // Sunucuda migration henüz yoksa sessizce geç; bildirimler Türkçe gider
    if (!error) gonderilen = { kullanici, dil };
  } catch {
    // internet yok: bir sonraki açılışta tekrar denenir
  }
}

if (supabaseHazir) {
  supabase.auth.onAuthStateChange((olay) => {
    if (olay === 'SIGNED_IN' || olay === 'USER_UPDATED') void bildirimDiliniGuncelle();
  });
}
