/**
 * Yerelde deneme: örnek rotadan video ya da tek tek kare üretir.
 *
 *   node src/deneme.js <ornek> <tema> [bicim] [--kareler 0,5,9]
 *   ornek: kas-kalkan | izmir-kordon | istanbul      tema: yorunge | sehir-gece | sehir-maket | takip
 *
 * Çıktı: cikti/<ornek>-<tema>-<bicim>.mp4 (ya da …-<saniye>.jpg). Ekran kartıyla hızlı denemek için KV_GL=gpu.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { dogrula } from './dogrula.js';
import { baslat } from './sunucu.js';
import { kareleriAl, tarayiciKapat, videoUret } from './uret.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [ornek = 'kas-kalkan', tema = 'yorunge', bicimArg] = process.argv.slice(2).filter((a, i, l) => !a.startsWith('--') && l[i - 1] !== '--kareler');
const kareArg = process.argv.indexOf('--kareler');
const saniyeler = kareArg > 0 ? process.argv[kareArg + 1].split(',').map(Number) : null;

// Örnek metinler (uygulamada telefon kendi dilinde ve gerçek değerlerle gönderir)
const METIN = {
  'kas-kalkan': { ust: 'BİSİKLET · 7 KASIM', baslik: 'Kaş – Kalkan sahil yolu', degerler: [['Süre', '1:38'], ['Tırmanış', '502 m'], ['Maks.', '48,2']] },
  'izmir-kordon': { ust: 'KOŞU · 7 KASIM', baslik: 'Kordon’da akşam koşusu', degerler: [['Süre', '15:14'], ['Tempo', '5:30 /km'], ['Başlangıç', '19:40']] },
  istanbul: { ust: 'YÜRÜYÜŞ · İSTANBUL', baslik: 'Sultanahmet → Galata', degerler: [['Süre', '0:39'], ['Tırmanış', '60 m'], ['Ort.', '4,8']] },
};

const veri = JSON.parse(await readFile(path.join(KOK, 'ornek', `${ornek}.json`), 'utf8'));
const m = METIN[ornek];
const girdi = dogrula({
  tema,
  bicim: bicimArg,
  rota: veri.rota,
  metin: {
    ust: m.ust,
    baslik: m.baslik,
    kmSayi: Math.round(veri.uzunluk_m / 10) / 100,
    kmBasamak: veri.uzunluk_m < 10000 ? 2 : 1,
    ondalik: ',',
    kmBirim: 'km',
    degerler: m.degerler.map(([etiket, deger]) => ({ etiket, deger })),
    kaynak: 'Harita © OpenStreetMap katkıcıları · OpenMapTiles · OpenFreeMap · yükseklik: Mapzen Terrarium',
  },
});

const s = await baslat(0);
await mkdir(path.join(KOK, 'cikti'), { recursive: true });
const ad = `${ornek}-${tema}-${girdi.bicim}`;
const bas = Date.now();
try {
  if (saniyeler) {
    const { kareler, gunluk } = await kareleriAl(girdi, s.sahneAdresi, saniyeler);
    for (let i = 0; i < kareler.length; i++) await writeFile(path.join(KOK, 'cikti', `${ad}-${saniyeler[i]}.jpg`), kareler[i]);
    if (gunluk.length) console.log('sahne hataları:', gunluk.slice(0, 5));
    console.log(`${kareler.length} kare, ${((Date.now() - bas) / 1000).toFixed(1)} sn`);
  } else {
    let son = 0;
    await videoUret(girdi, path.join(KOK, 'cikti', `${ad}.mp4`), s.sahneAdresi, (p) => {
      if (p - son >= 0.1) {
        son = p;
        console.log(`%${Math.round(p * 100)} (${((Date.now() - bas) / 1000).toFixed(0)} sn)`);
      }
    });
    console.log(`cikti/${ad}.mp4 — ${((Date.now() - bas) / 1000).toFixed(1)} sn`);
  }
} finally {
  await tarayiciKapat();
  s.kapat();
}
