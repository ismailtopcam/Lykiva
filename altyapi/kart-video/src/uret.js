/**
 * Videoyu üretir: sahne sayfası başsız Chromium'da açılır, her kare için zaman ilerletilir, ekran görüntüsü
 * ffmpeg'e akıtılır (H.264, yuv420p, +faststart → Instagram / WhatsApp oynatır).
 *
 * Ayarlar (ortam):
 *   KV_FPS     kare hızı (varsayılan 24)
 *   KV_OLCEK   çizim ölçeği: CSS pikselin kaç katı çizilir (varsayılan 2 → hikâye 720×1280, çıkışta 1080×1920'ye büyütülür)
 *   KV_HARITA_ORAN  haritanın çözünürlük çarpanı (varsayılan 0,75; yazılar etkilenmez)
 *   KV_AA      kenar yumuşatma (varsayılan 0; yazılım WebGL'de çok pahalı)
 *   KV_GOLGE   tepe gölgesi (varsayılan 1)
 *   KV_SADE    sade stil (varsayılan 1)
 *   KV_ARAZI   yörünge / takipte 3B arazi (varsayılan 1; kapalıysa eğik harita + tepe gölgesi, ~3 kat hızlı)
 *   KV_GL      'swiftshader' (varsayılan; ekran kartı olmayan sunucu) ya da 'gpu'
 *   KV_FFMPEG  ffmpeg yolu (varsayılan 'ffmpeg')
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

import { BICIMLER } from './dogrula.js';

const FPS = Number(process.env.KV_FPS || 24);
const OLCEK = Number(process.env.KV_OLCEK || 2);
const GL = process.env.KV_GL || 'swiftshader';
const SAHNE_AYAR = new URLSearchParams({
  aa: process.env.KV_AA || '0',
  oran: process.env.KV_HARITA_ORAN || '0.75',
  golge: process.env.KV_GOLGE || '1',
  sade: process.env.KV_SADE || '1',
  arazi: process.env.KV_ARAZI || '1',
}).toString();
const FFMPEG = process.env.KV_FFMPEG || 'ffmpeg';

let tarayici = null;
async function tarayiciAc() {
  if (tarayici?.isConnected()) return tarayici;
  const args = GL === 'gpu' ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  tarayici = await chromium.launch({ args: [...args, '--disable-dev-shm-usage', '--no-sandbox'] });
  return tarayici;
}

function ffmpegBaslat(cikti, cw, ch) {
  const ff = spawn(
    FFMPEG,
    [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      // JPEG tam aralık (pc) gelir; telefonlar ve Instagram sınırlı aralık (tv) yuv420p bekler
      '-vf', `scale=${cw}:${ch}:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-movflags', '+faststart',
      cikti,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  );
  let hata = '';
  ff.stderr.on('data', (d) => (hata += d));
  const bitti = new Promise((res, rej) => {
    ff.on('error', rej);
    ff.on('close', (kod) => (kod === 0 ? res() : rej(new Error(`ffmpeg ${kod}: ${hata.slice(-400)}`))));
  });
  const yaz = (buf) => (ff.stdin.write(buf) ? Promise.resolve() : new Promise((r) => ff.stdin.once('drain', r)));
  return { yaz, kapat: () => ff.stdin.end(), bitti, oldur: () => ff.kill('SIGKILL') };
}

/**
 * @param {ReturnType<import('./dogrula.js').dogrula>} girdi
 * @param {string} cikti  mp4 dosya yolu
 * @param {string} sahneAdresi  sahne sayfasının adresi (aynı süreçteki sunucu)
 * @param {(p: number) => void} [ilerleme]
 */
export async function videoUret(girdi, cikti, sahneAdresi, ilerleme = () => {}) {
  const b = BICIMLER[girdi.bicim];
  const t = await tarayiciAc();
  const baglam = await t.newContext({ viewport: { width: b.w, height: b.h }, deviceScaleFactor: OLCEK });
  const sayfa = await baglam.newPage();
  const gunluk = [];
  sayfa.on('console', (m) => m.type() === 'error' && gunluk.push(m.text()));
  sayfa.on('pageerror', (e) => gunluk.push(String(e)));
  let ff = null;
  try {
    await sayfa.goto(`${sahneAdresi}?${SAHNE_AYAR}`, { waitUntil: 'load' });
    // Harita, arazi ve yazı tipleri yüklenip ilk kare hazır olana kadar
    await sayfa.evaluate((v) => window.sahneKur(v), girdi);
    const kareSayisi = Math.round(girdi.sure * FPS);
    ff = ffmpegBaslat(cikti, b.cw, b.ch);
    let goruntu = null;
    for (let i = 0; i < kareSayisi; i++) {
      const degisti = await sayfa.evaluate((s) => window.kare(s), i / FPS);
      // Görünüm değişmediyse (sondaki bekleme) son kare tekrarlanır: çizim ve ekran görüntüsü yok
      // Yazılım WebGL'de ağır bir kare 30 sn'yi (Playwright varsayılanı) aşabiliyor
      if (degisti || !goruntu) goruntu = await sayfa.screenshot({ type: 'jpeg', quality: 90, animations: 'disabled', caret: 'hide', timeout: 120_000 });
      await ff.yaz(goruntu);
      ilerleme((i + 1) / kareSayisi);
    }
    ff.kapat();
    await ff.bitti;
  } catch (e) {
    if (ff) {
      // ffmpeg öldürülünce "bitti" sözü reddedilir; sahipsiz kalırsa süreç çöker (bütün işler kaybolur)
      ff.bitti.catch(() => undefined);
      ff.oldur();
    }
    if (gunluk.length) e.message += ` | sahne: ${gunluk.slice(-3).join(' / ')}`;
    throw e;
  } finally {
    await baglam.close().catch(() => undefined);
  }
}

/** Deneme için: verilen saniyelerdeki kareleri JPEG olarak döndürür (video üretmeden görünümü denetlemek) */
export async function kareleriAl(girdi, sahneAdresi, saniyeler) {
  const b = BICIMLER[girdi.bicim];
  const t = await tarayiciAc();
  const baglam = await t.newContext({ viewport: { width: b.w, height: b.h }, deviceScaleFactor: OLCEK });
  const sayfa = await baglam.newPage();
  const gunluk = [];
  sayfa.on('console', (m) => m.type() === 'error' && gunluk.push(m.text()));
  try {
    await sayfa.goto(`${sahneAdresi}?${SAHNE_AYAR}`, { waitUntil: 'load' });
    await sayfa.evaluate((v) => window.sahneKur(v), girdi);
    const out = [];
    for (const s of saniyeler) {
      await sayfa.evaluate((x) => window.kare(x), s);
      out.push(await sayfa.screenshot({ type: 'jpeg', quality: 90 }));
    }
    return { kareler: out, gunluk };
  } finally {
    await baglam.close().catch(() => undefined);
  }
}

export async function tarayiciKapat() {
  await tarayici?.close().catch(() => undefined);
  tarayici = null;
}
