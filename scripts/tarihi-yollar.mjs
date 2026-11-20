#!/usr/bin/env node
/**
 * Tarihi yürüyüş yollarının çizgilerini OpenStreetMap'ten (Overpass API) indirir, yolları birleştirip
 * sadeleştirir ve uygulamanın gömülü verisini yazar: apps/mobile/src/components/map/tarihiYollar.json
 *
 *   node scripts/tarihi-yollar.mjs
 *
 * Her yol bir ya da birkaç OSM ilişkisidir (route=hiking; alt ilişkiler, etaplar ve alternatifler dahil).
 * İlişki kimlikleri aşağıda; OSM'de yol yeniden düzenlenirse burayı güncelle.
 * Veri © OpenStreetMap katkıcıları, ODbL 1.0 (https://www.openstreetmap.org/copyright).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const YOLLAR = [
  { id: 'likya', osm: [51855] }, // Likya Yolu
  { id: 'karia', osm: [7235931, 18008064] }, // Karia Yolu (kıyı bölümleri) + İç Karia Yolu
  { id: 'frig', osm: [1707889] }, // Frig Yolu
  { id: 'hitit', osm: [1783561] }, // Hitit Yolu
  { id: 'evliya', osm: [4501541] }, // Evliya Çelebi Yolu
  { id: 'paul', osm: [569620] }, // Aziz Paul Yolu
  { id: 'sultanlar', osm: [19932854] }, // Sultans Trail 6. bölüm: Edirne – İstanbul (Türkiye'deki kısım)
  { id: 'efeler', osm: [16118310] }, // Efeler Yolu
];

/** Sadeleştirme payı (m): çizgi haritada bu kadar sapabilir */
const TOLERANS_M = 20;

const SUNUCULAR = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(sorgu) {
  for (let tur = 0; tur < 6; tur++) {
    for (const adres of SUNUCULAR) {
      try {
        const r = await fetch(adres, {
          method: 'POST',
          headers: { 'User-Agent': 'lykiva-veri-hazirlama/0.1', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(sorgu),
          signal: AbortSignal.timeout(180_000),
        });
        const metin = await r.text();
        if (r.ok && metin.trimStart().startsWith('{')) return JSON.parse(metin);
        console.warn(`  ${adres}: ${r.status} ${metin.slice(0, 80).replace(/\s+/g, ' ')}`);
      } catch (e) {
        console.warn(`  ${adres}: ${e.message}`);
      }
    }
    await bekle((tur + 1) * 15_000);
  }
  throw new Error('Overpass yanıt vermedi');
}

// ---- Geometri ----

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

function mesafe(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Uç noktaları ortak olan yolları uzun parçalara birleştirir (yazılar çizgi boyunca yerleşebilsin) */
function birlestir(yollar) {
  const uc = new Map(); // düğüm kimliği → yol sırası
  const ekle = (n, i) => (uc.get(n) ?? uc.set(n, []).get(n)).push(i);
  yollar.forEach((y, i) => {
    ekle(y.nodes[0], i);
    ekle(y.nodes.at(-1), i);
  });
  const kullanildi = new Array(yollar.length).fill(false);
  const sonraki = (n) => (uc.get(n) ?? []).find((i) => !kullanildi[i]);
  const parcalar = [];
  for (let i = 0; i < yollar.length; i++) {
    if (kullanildi[i]) continue;
    kullanildi[i] = true;
    let dugum = [...yollar[i].nodes];
    let nokta = [...yollar[i].geometry];
    for (const yon of ['son', 'bas']) {
      for (;;) {
        const ucD = yon === 'son' ? dugum.at(-1) : dugum[0];
        const j = sonraki(ucD);
        if (j === undefined) break;
        kullanildi[j] = true;
        let d = yollar[j].nodes;
        let g = yollar[j].geometry;
        if (yon === 'son') {
          if (d[0] !== ucD) [d, g] = [[...d].reverse(), [...g].reverse()];
          dugum = dugum.concat(d.slice(1));
          nokta = nokta.concat(g.slice(1));
        } else {
          if (d.at(-1) !== ucD) [d, g] = [[...d].reverse(), [...g].reverse()];
          dugum = d.slice(0, -1).concat(dugum);
          nokta = g.slice(0, -1).concat(nokta);
        }
      }
    }
    parcalar.push(nokta);
  }
  return parcalar;
}

/** Douglas–Peucker, metre cinsinden (yerel düz izdüşüm) */
function sadelestir(p, tol) {
  if (p.length < 3) return p;
  const k = Math.cos(rad(p[0][1]));
  const xy = p.map(([lng, lat]) => [rad(lng) * R * k, rad(lat) * R]);
  const tut = new Uint8Array(p.length);
  tut[0] = tut[p.length - 1] = 1;
  const yigin = [[0, p.length - 1]];
  while (yigin.length) {
    const [a, b] = yigin.pop();
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let enUzak = -1;
    let enI = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = xy[i];
      let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
      if (d > enUzak) [enUzak, enI] = [d, i];
    }
    if (enUzak > tol) {
      tut[enI] = 1;
      yigin.push([a, enI], [enI, b]);
    }
  }
  return p.filter((_, i) => tut[i]);
}

/** Google polyline, 5 basamak; nokta [boylam, enlem] */
function polyline(p) {
  let s = '';
  let oLat = 0;
  let oLng = 0;
  const yaz = (v) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    s += String.fromCharCode(v + 63);
  };
  for (const [lng, lat] of p) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    yaz(la - oLat);
    yaz(ln - oLng);
    oLat = la;
    oLng = ln;
  }
  return s;
}

// ---- Çalıştır ----

const cikti = { tarih: new Date().toISOString().slice(0, 10), kaynak: '© OpenStreetMap katkıcıları, ODbL', yollar: [] };

for (const y of YOLLAR) {
  console.log(`${y.id}: OSM ${y.osm.join(', ')}`);
  const j = await overpass(`[out:json][timeout:170];rel(id:${y.osm.join(',')});(._;>>;);way._;out geom;`);
  const yollar = j.elements.filter((e) => e.type === 'way' && e.geometry?.length > 1);
  const benzersiz = [...new Map(yollar.map((w) => [w.id, { nodes: w.nodes, geometry: w.geometry.map((g) => [g.lon, g.lat]) }])).values()];
  let km = 0;
  for (const w of benzersiz) for (let i = 1; i < w.geometry.length; i++) km += mesafe(w.geometry[i - 1], w.geometry[i]) / 1000;
  const parcalar = birlestir(benzersiz)
    .map((p) => sadelestir(p, TOLERANS_M))
    .filter((p) => p.length > 1);
  const nokta = parcalar.reduce((t, p) => t + p.length, 0);
  console.log(`  ${benzersiz.length} yol → ${parcalar.length} parça, ${nokta} nokta, ${Math.round(km)} km`);
  cikti.yollar.push({ id: y.id, osm: y.osm, km: Math.round(km), parcalar: parcalar.map(polyline) });
  await bekle(3000);
}

const hedef = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'mobile', 'src', 'components', 'map', 'tarihiYollar.json');
writeFileSync(hedef, JSON.stringify(cikti) + '\n');
console.log(`Yazıldı: ${hedef}`);
