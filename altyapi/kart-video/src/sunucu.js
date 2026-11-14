/**
 * Kart video servisi.
 *
 *   POST /video            { tema, bicim?, rota: [[boylam, enlem], …], metin: {…} }  → 202 { id }
 *   GET  /video/:id        → { durum: sirada | uretiliyor | hazir | hata, ilerleme 0–1, sira?, hata? }
 *   GET  /video/:id/mp4    → video/mp4 (hazırsa)
 *   GET  /saglik           → ok
 *
 * Dışarıya yalnızca kapı (nginx, uygulama anahtarı + istek sınırı) üzerinden açılır; `/sahne`, `/kutuphane`, `/yazi`
 * yolları sahne sayfasının kendisi için (Chromium aynı süreçten okur), kapıdan geçmez.
 * İşler bellekte tutulur, tek tek üretilir; video `KV_SAKLA_DK` dakika sonra silinir.
 */
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { dogrula } from './dogrula.js';
import { videoUret } from './uret.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CIKTI = process.env.KV_CIKTI || path.join(tmpdir(), 'kart-video');
const SAKLA_MS = Number(process.env.KV_SAKLA_DK || 60) * 60_000;
const EN_FAZLA_SIRA = Number(process.env.KV_EN_FAZLA_SIRA || 20);

const DURAGAN = {
  '/sahne/': path.join(KOK, 'sahne'),
  '/kutuphane/maplibre/': path.join(KOK, 'node_modules/maplibre-gl/dist'),
  '/yazi/inter/': path.join(KOK, 'node_modules/@fontsource/inter'),
  '/yazi/bricolage/': path.join(KOK, 'node_modules/@fontsource/bricolage-grotesque'),
};
const TURLER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

/** @type {Map<string, { id: string, durum: string, ilerleme: number, girdi: object, dosya: string, zaman: number, hata?: string }>} */
const isler = new Map();
const sira = [];
let calisiyor = false;
let sahneAdresi = '';

function json(res, kod, govde) {
  res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(govde));
}

async function govdeOku(req, enFazla = 1_000_000) {
  const parcalar = [];
  let boy = 0;
  for await (const p of req) {
    boy += p.length;
    if (boy > enFazla) throw Object.assign(new Error('gövde çok büyük'), { kod: 413 });
    parcalar.push(p);
  }
  try {
    return JSON.parse(Buffer.concat(parcalar).toString('utf8'));
  } catch {
    throw Object.assign(new Error('gövde JSON değil'), { kod: 400 });
  }
}

async function isle() {
  if (calisiyor) return;
  calisiyor = true;
  while (sira.length) {
    const is = sira.shift();
    is.durum = 'uretiliyor';
    const bas = Date.now();
    try {
      await videoUret(is.girdi, is.dosya, sahneAdresi, (p) => (is.ilerleme = p));
      is.durum = 'hazir';
      is.ilerleme = 1;
      console.log(`[${is.id}] hazır: ${is.girdi.tema}/${is.girdi.bicim}, ${is.girdi.rota.length} nokta, ${((Date.now() - bas) / 1000).toFixed(1)} sn`);
    } catch (e) {
      is.durum = 'hata';
      is.hata = String(e?.message || e).slice(0, 300);
      console.error(`[${is.id}] hata:`, e);
    }
    is.zaman = Date.now();
  }
  calisiyor = false;
}

async function temizle() {
  const simdi = Date.now();
  for (const [id, is] of isler) {
    if ((is.durum === 'hazir' || is.durum === 'hata') && simdi - is.zaman > SAKLA_MS) {
      isler.delete(id);
      await rm(is.dosya, { force: true }).catch(() => undefined);
    }
  }
}

async function duragan(req, res, onEk, klasor) {
  const goreli = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(onEk.length));
  const dosya = path.resolve(klasor, goreli);
  if (!dosya.startsWith(klasor + path.sep)) return json(res, 404, { hata: 'yok' });
  try {
    const s = await stat(dosya);
    if (!s.isFile()) throw new Error();
    res.writeHead(200, { 'content-type': TURLER[path.extname(dosya)] || 'application/octet-stream', 'content-length': s.size });
    createReadStream(dosya).pipe(res);
  } catch {
    json(res, 404, { hata: 'yok' });
  }
}

async function istek(req, res) {
  const yol = new URL(req.url, 'http://x').pathname;
  try {
    if (req.method === 'GET' && yol === '/saglik') return json(res, 200, { durum: 'ok', sira: sira.length, calisiyor });
    for (const [onEk, klasor] of Object.entries(DURAGAN)) if (req.method === 'GET' && yol.startsWith(onEk)) return duragan(req, res, onEk, klasor);

    if (req.method === 'POST' && yol === '/video') {
      if (sira.length >= EN_FAZLA_SIRA) return json(res, 503, { hata: 'sıra dolu, biraz sonra dene' });
      let girdi;
      try {
        girdi = dogrula(await govdeOku(req));
      } catch (e) {
        return json(res, e.kod || 400, { hata: e.message });
      }
      const id = randomUUID();
      const is = { id, durum: 'sirada', ilerleme: 0, girdi, dosya: path.join(CIKTI, `${id}.mp4`), zaman: Date.now() };
      isler.set(id, is);
      sira.push(is);
      void isle();
      return json(res, 202, { id });
    }

    const m = yol.match(/^\/video\/([0-9a-f-]{36})(\/mp4)?$/);
    if (req.method === 'GET' && m) {
      const is = isler.get(m[1]);
      if (!is) return json(res, 404, { hata: 'iş yok ya da süresi doldu' });
      if (!m[2]) {
        return json(res, 200, {
          durum: is.durum,
          ilerleme: Math.round(is.ilerleme * 100) / 100,
          ...(is.durum === 'sirada' ? { sira: sira.indexOf(is) + 1 } : null),
          ...(is.hata ? { hata: is.hata } : null),
        });
      }
      if (is.durum !== 'hazir') return json(res, 409, { hata: 'video henüz hazır değil' });
      const s = await stat(is.dosya);
      res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': s.size, 'content-disposition': 'attachment; filename="lykiva.mp4"' });
      return createReadStream(is.dosya).pipe(res);
    }
    json(res, 404, { hata: 'yok' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { hata: 'sunucu hatası' });
  }
}

/** Sunucuyu açar; deneme betiği de kullanır */
export async function baslat(port = Number(process.env.PORT || 8080)) {
  await mkdir(CIKTI, { recursive: true });
  const sunucu = http.createServer((req, res) => void istek(req, res));
  await new Promise((r) => sunucu.listen(port, r));
  const gercekPort = sunucu.address().port;
  sahneAdresi = `http://127.0.0.1:${gercekPort}/sahne/index.html`;
  const zamanlayici = setInterval(() => void temizle(), 5 * 60_000);
  return {
    port: gercekPort,
    sahneAdresi,
    kapat: () => {
      clearInterval(zamanlayici);
      sunucu.close();
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await baslat();
  console.log(`kart-video ${s.port} portunda; çıktı ${CIKTI}`);
}
