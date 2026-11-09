#!/usr/bin/env node
/**
 * Lykiva — sunucu kontrolü (yalnızca okur, hiçbir şey değiştirmez, kullanıcı açmaz).
 *
 *   node scripts/sunucu-kontrol.mjs
 *
 * apps/mobile/.env içindeki EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ile:
 *  1. Giriş ayarları: geçici hesap, Google, Apple açık mı
 *  2. Migration'lar: her aşamanın bir fonksiyonu sunucuda var mı
 *     (fonksiyonlar anonim rol için kapalı olduğundan "izin yok" = var, "bulunamadı" = yok)
 *  3. Realtime: canlı sohbet servisine bağlanılabiliyor mu
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
let env = '';
try {
  env = readFileSync(join(kok, 'apps/mobile/.env'), 'utf8');
} catch {
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('apps/mobile/.env bulunamadı. Önce kur.sh ile sunucu anahtarını gir.');
    process.exit(1);
  }
}
// Ortam değişkeni .env'deki değeri geçersiz kılar (deneme için)
const deger = (ad) => process.env[ad] || env.match(new RegExp(`^${ad}=(.*)$`, 'm'))?.[1]?.trim() || '';
const URL_ = deger('EXPO_PUBLIC_SUPABASE_URL') || 'https://api.lykiva.ismailtopcam.dev';
const ANAHTAR = deger('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!ANAHTAR) {
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY boş. Coolify > lykiva-supabase > Environment Variables > SERVICE_SUPABASEANON_KEY değerini apps/mobile/.env dosyasına yaz.');
  process.exit(1);
}
const basliklar = { apikey: ANAHTAR, Authorization: `Bearer ${ANAHTAR}` };
let sorun = 0;
const iyi = (m) => console.log(`  ✓ ${m}`);
const kotu = (m) => {
  sorun++;
  console.log(`  ✗ ${m}`);
};
const bilgi = (m) => console.log(`  · ${m}`);

console.log(`\nSunucu: ${URL_}\n`);

// 1. Giriş ayarları
console.log('Giriş');
try {
  const r = await fetch(`${URL_}/auth/v1/settings`, { headers: basliklar });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const s = await r.json();
  const ext = s.external ?? {};
  (ext.anonymous_users ? iyi : kotu)('Geçici (anonim) hesap ' + (ext.anonymous_users ? 'açık' : 'kapalı — ENABLE_ANONYMOUS_USERS=true olmalı'));
  (ext.google ? iyi : kotu)('Google girişi ' + (ext.google ? 'açık' : 'kapalı — supabase/README.md > Giriş'));
  (ext.apple ? iyi : kotu)('Apple girişi ' + (ext.apple ? 'açık' : 'kapalı — supabase/README.md > Giriş'));
  bilgi('Hesap bağlama (manual linking) bu uçtan görünmüyor; Google/Apple ile ilk girişte anlaşılır.');
} catch (e) {
  kotu(`Giriş ayarları okunamadı (${e.message})`);
}

// 2. Migration'lar
console.log('\nVeritabanı (migration)');
const asamalar = [
  ['20261108000000_kayit_ve_kurallar', 'aktivite_detay', { aktivite: '00000000-0000-0000-0000-000000000000' }],
  ['20261109000000_giris', 'devir_kodu_al', {}],
  ['20261109010000_rotalar', 'kaydet_rota', { p: {} }],
  ['20261109020000_paylasim', 'aktivite_noktalari', { aktivite: '00000000-0000-0000-0000-000000000000' }],
  ['20261109030000_gruplar', 'grup_olustur', { p: {} }],
  ['20261109040000_etkinlikler', 'etkinlik_olustur', { p: {} }],
  ['20261109050000_canli_konum', 'canli_konum_gonder', { p: {} }],
  ['20261110000000_akis_takip', 'akis', {}],
  ['20261110010000_yorumlar', 'yorum_yaz', {}],
];
for (const [dosya, fn, govde] of asamalar) {
  try {
    const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { ...basliklar, 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (j.code === 'PGRST202' || r.status === 404) kotu(`${dosya} uygulanmamış (${fn} yok)`);
    else if (j.code === '42501' || r.status === 401 || r.status === 403 || r.ok || j.code === 'P0001') iyi(`${dosya}`);
    else bilgi(`${dosya}: beklenmeyen yanıt ${r.status} ${j.code ?? ''} ${j.message ?? ''}`);
  } catch (e) {
    kotu(`${dosya}: istek başarısız (${e.message})`);
  }
}

// 3. Realtime
console.log('\nCanlı sohbet (Realtime)');
await new Promise((bitti) => {
  const adres = `${URL_.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(ANAHTAR)}&vsn=1.0.0`;
  let ws;
  const zaman = setTimeout(() => {
    kotu('Realtime 8 saniyede yanıt vermedi — grup sohbeti canlı akmaz');
    try {
      ws?.close();
    } catch {}
    bitti();
  }, 8000);
  try {
    ws = new WebSocket(adres);
  } catch (e) {
    clearTimeout(zaman);
    kotu(`Realtime'a bağlanılamadı (${e.message})`);
    return bitti();
  }
  ws.onopen = () => ws.send(JSON.stringify({ topic: 'realtime:lykiva-kontrol', event: 'phx_join', payload: { config: {} }, ref: '1' }));
  ws.onmessage = (m) => {
    try {
      const v = JSON.parse(m.data);
      if (v.event === 'phx_reply' && v.ref === '1') {
        clearTimeout(zaman);
        (v.payload?.status === 'ok' ? iyi : kotu)(v.payload?.status === 'ok' ? 'Realtime çalışıyor' : `Realtime kanala katılmadı: ${JSON.stringify(v.payload).slice(0, 160)}`);
        ws.close();
        bitti();
      }
    } catch {}
  };
  ws.onerror = () => {
    clearTimeout(zaman);
    kotu('Realtime bağlantı hatası — servis kapalı ya da /realtime/v1 yönlendirmesi yok');
    bitti();
  };
});

console.log(sorun ? `\n${sorun} sorun var.\n` : '\nHer şey yerinde.\n');
process.exit(sorun ? 1 : 0);
