/* global maplibregl */
/**
 * 3B kart sahnesi. Node tarafı `sahneKur(veri)` ile kurar, her kare için `kare(saniye)` çağırır ve ekran görüntüsü alır.
 * Kare zamana bağlıdır (gerçek saat değil): aynı veri her seferinde aynı videoyu verir.
 *
 * Kaynaklar: harita ve binalar OpenFreeMap (OpenMapTiles şeması, © OpenStreetMap katkıcıları),
 * arazi Mapzen Terrarium (AWS Open Data). Tasarımdaki zamanlamalar: tasarim/AKTARIM.md > Animasyon zamanlamaları.
 */
'use strict';

const STIL = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  positron: 'https://tiles.openfreemap.org/styles/positron',
};
/** Harita kabının CSS'teki büyütmesi (sahne.css > #harita) */
const K = 2;
/**
 * Hız ayarları (adres parametresi; uret.js ortamdan doldurur). Sunucuda ekran kartı yok, WebGL yazılımla çizilir:
 *   aa=1      kenar yumuşatma (MSAA; yazılımla pahalı)
 *   oran=1    harita çözünürlüğü çarpanı (0,75 → piksel sayısı ~%56)
 *   golge=1   tepe gölgesi katmanı
 *   sade=1    stil sadeleşir: yalnız zemin, yeşil alan, su ve ana yollar kalır. Yazılım WebGL'de maliyet piksel sayısından çok
 *             katman sayısına bağlı (arazi açıkken her katman her karede dokuya ayrıca çizilir); liberty ~110 katman.
 *   arazi=1   3B arazi (kapalıysa eğik görünüm + tepe gölgesi)
 *   demboyut=256  arazi karosu boyutu; 512 → aynı alan için 4 kat az arazi parçası (daha kaba, çok daha hızlı)
 */
const Q = new URLSearchParams(location.search);
const HIZ = {
  aa: Q.get('aa') === '1',
  oran: Number(Q.get('oran') || 1),
  golge: Q.get('golge') !== '0',
  sade: Q.get('sade') !== '0',
  arazi: Q.get('arazi') !== '0',
  demBoyut: Number(Q.get('demboyut') || 256),
};

/** Sade stilde kalan katmanlar (OpenFreeMap liberty / dark / positron adları) */
const KALAN = /^(background|natural_earth|park|landuse_park|landuse_residential|landcover_(wood|grass|wetland|sand|ice|glacier|ice_shelf)|water|waterway|waterway_river|road_(motorway|trunk_primary|secondary_tertiary|minor)(_casing)?|highway_(minor|major_casing|major_inner|motorway_casing|motorway_inner))$/;
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

const AYAR = {
  // 11, 12, 16: düz harita → eğilir, dağlar yükselir, kamera döner
  yorunge: { stil: 'liberty', su: '#9CC8D3', abarti: 1.7, golge: 0.55, bina: null, rota: '#E07A4A', gok: '#0E1512', kamera: 'yorunge', yaklas: 0.3 },
  // 13: gece şehir, binalar yükselir
  'sehir-gece': { stil: 'dark', abarti: 1.2, golge: 0.2, bina: { renk: '#3C4048' }, rota: '#E07A4A', gok: '#1B1B20', kamera: 'yorunge', yaklas: 0.7, arazi: false },
  // 14 (15'in uydusu yerine): beyaz maket şehir
  'sehir-maket': { stil: 'positron', abarti: 1.2, golge: 0.12, bina: { renk: '#F3F3F5' }, rota: '#B04E25', gok: '#E9E9EE', kamera: 'yorunge', yaklas: 0.7, arazi: false },
  // 17: kamera rotanın arkasından izler
  takip: { stil: 'liberty', su: '#9CC8D3', abarti: 1.5, golge: 0.55, bina: null, rota: '#E07A4A', gok: '#8FCFE0', ufuk: '#DCEFF3', kamera: 'takip' },
};

let map;
let V; // istek verisi
let A; // tema ayarı
let iz; // { nk: [[lng,lat]], kum: [m], L, yon: [derece] }
let bas; // genel bakış kamerası { center, zoom }
let sonAbarti = -1;
let sonBina = -1;
let sonP = -1;

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const sinir = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const yumusak = (x) => {
  x = sinir(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const ara = (a, b, k) => a + (b - a) * k;
function aciAra(a, b, k) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * k;
}
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function mesafe(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function yonAcisi(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function izHazirla(rota) {
  const kum = [0];
  for (let i = 1; i < rota.length; i++) kum.push(kum[i - 1] + mesafe(rota[i - 1], rota[i]));
  const L = kum[kum.length - 1] || 1;
  // Yumuşatılmış yön: her noktada ±300 m içindeki parçaların birim vektör toplamı
  const parcaYon = rota.slice(1).map((p, i) => rad(yonAcisi(rota[i], p)));
  const yon = rota.map((_, i) => {
    let [sx, sy] = [0, 0];
    for (let j = 0; j < parcaYon.length; j++) {
      const orta = (kum[j] + kum[j + 1]) / 2;
      if (Math.abs(orta - kum[i]) > 300) continue;
      const w = kum[j + 1] - kum[j];
      sx += Math.sin(parcaYon[j]) * w;
      sy += Math.cos(parcaYon[j]) * w;
    }
    return sx || sy ? (Math.atan2(sx, sy) * 180) / Math.PI : 0;
  });
  return { nk: rota, kum, L, yon };
}

/** Noktaları en fazla n'e seyreltir (bina süzgeci her binada rotaya uzaklık hesaplar) */
function seyrelt(nk, n) {
  if (nk.length <= n) return nk;
  const adim = (nk.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => nk[Math.round(i * adim)]);
}

/** 3B bina koridorunun yarı genişliği (m): kısa rotada 250, uzunda rotanın %8'i, en fazla 600 */
const koridor = () => Math.round(Math.min(600, Math.max(250, iz.L * 0.08)));

/** İzde d metredeki nokta, sıra ve o noktaya kadarki parça */
function izde(d) {
  const { nk, kum } = iz;
  d = sinir(d, 0, iz.L);
  let lo = 0;
  let hi = kum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (kum[m] <= d) lo = m;
    else hi = m;
  }
  const k = kum[hi] - kum[lo] > 0 ? (d - kum[lo]) / (kum[hi] - kum[lo]) : 0;
  const p = [ara(nk[lo][0], nk[hi][0], k), ara(nk[lo][1], nk[hi][1], k)];
  return { p, i: lo, yon: aciAra(iz.yon[lo], iz.yon[hi], k) };
}
function izParcasi(d) {
  const { p, i } = izde(d);
  return [...iz.nk.slice(0, i + 1), p];
}

function bekle() {
  return new Promise((res) => {
    let bitti = false;
    const son = () => {
      if (bitti) return;
      bitti = true;
      res();
    };
    map.once('idle', son);
    map.triggerRepaint();
    setTimeout(son, 10000);
  });
}

function kmYaz(oran) {
  const m = V.metin;
  const s = (m.kmSayi * oran).toFixed(m.kmBasamak);
  document.getElementById('kmSayi').textContent = m.ondalik === ',' ? s.replace('.', ',') : s;
}

/* ------------------------------------------------------------------ */
/* Kurulum                                                             */
/* ------------------------------------------------------------------ */

function yazilariKur() {
  const m = V.metin;
  document.body.dataset.tema = V.tema;
  document.body.dataset.bicim = V.bicim;
  document.getElementById('ustYazi').textContent = m.ust;
  document.getElementById('baslikUst').textContent = m.baslik;
  document.getElementById('baslik').textContent = m.baslik;
  document.getElementById('kmBirim').textContent = m.kmBirim;
  document.getElementById('kaynak').textContent = m.kaynak;
  const doldur = (kap, liste) => {
    kap.replaceChildren(
      ...liste.map((d) => {
        const el = document.createElement('div');
        const e = document.createElement('div');
        e.className = 'etiket';
        e.textContent = d.etiket;
        const v = document.createElement('div');
        v.className = 'deger';
        v.textContent = d.deger;
        el.append(e, v);
        return el;
      }),
    );
  };
  doldur(document.getElementById('degerler'), m.degerler);
  doldur(document.getElementById('yan'), m.degerler.slice(0, 2));
  kmYaz(0);
}

/** Kartın yazıları dışında kalan alan (genel bakış kamerası bu alana sığdırılır) */
function bosAlan() {
  const H = window.innerHeight;
  const ust = document.getElementById('ustSatir').getBoundingClientRect();
  const alt = document.getElementById('altSatir').getBoundingClientRect();
  // Harita kabı K kat büyük: kenar boşlukları da K katı
  return { top: Math.round((ust.bottom + 18) * K), bottom: Math.round((H - alt.top + 18) * K), left: 28 * K, right: 28 * K };
}

function katmanlariKur() {
  let stil = map.getStyle();
  // Yazılar kapalı: kart dilden bağımsız ve sade kalsın
  for (const l of stil.layers) if (l.type === 'symbol') map.setLayoutProperty(l.id, 'visibility', 'none');
  if (HIZ.sade) {
    // Şehir şablonlarında stilin düz bina tabanı kalır: 3B çizilmeyen uzak binalar yine görünsün
    for (const l of stil.layers) if (!KALAN.test(l.id) && !(A.bina && l.id === 'building')) map.removeLayer(l.id);
    stil = map.getStyle();
  }
  const ilkCizgi = stil.layers.find((l) => l.type === 'line')?.id;
  // Liberty'nin parlak mavi denizi yerine tasarımdaki turkuaz
  if (A.su) {
    for (const l of stil.layers) {
      if (l['source-layer'] === 'water' && l.type === 'fill') map.setPaintProperty(l.id, 'fill-color', A.su);
      if (l['source-layer'] === 'waterway' && l.type === 'line') map.setPaintProperty(l.id, 'line-color', A.su);
    }
  }

  // Arazi ve tepe gölgesi için iki ayrı kaynak (MapLibre önerisi)
  const dem = { type: 'raster-dem', tiles: [DEM], tileSize: 256, encoding: 'terrarium', maxzoom: 15 };
  map.addSource('dem', { ...dem, tileSize: HIZ.demBoyut });
  if (HIZ.golge) map.addSource('dem-golge', dem);
  if (HIZ.golge) map.addLayer(
    {
      id: 'golge',
      type: 'hillshade',
      source: 'dem-golge',
      paint: { 'hillshade-exaggeration': A.golge, 'hillshade-shadow-color': '#1d2a22', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#2c3b31' },
    },
    ilkCizgi,
  );

  if (A.bina) {
    map.addLayer({
      id: 'binalar',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      // Yalnız rotanın çevresindeki binalar 3B: yazılım WebGL'de binlerce bina kareyi saniyelerce uzatıyordu
      filter: ['<', ['distance', { type: 'LineString', coordinates: seyrelt(iz.nk, 150) }], koridor()],
      paint: {
        'fill-extrusion-color': A.bina.renk,
        // Yükseklik sabit; binalar eğilirken saydamlıkla belirir. Yüksekliği her karede veriye bağlı ifadeyle değiştirmek
        // bütün binaları yeniden hesaplatıyor, yazılım WebGL'de kare başına saniyeler sürüyordu.
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0,
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }

  map.setSky({
    'sky-color': A.gok,
    'horizon-color': A.ufuk || A.gok,
    'fog-color': A.ufuk || A.gok,
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': A.kamera === 'takip' ? 0.6 : 0.25,
    'atmosphere-blend': 0,
  });

  map.addSource('rota-tum', { type: 'geojson', data: { type: 'LineString', coordinates: iz.nk } });
  map.addSource('rota', { type: 'geojson', data: { type: 'LineString', coordinates: [iz.nk[0], iz.nk[0]] } });
  map.addSource('uc', { type: 'geojson', data: { type: 'Point', coordinates: iz.nk[0] } });
  const cizgi = { 'line-cap': 'round', 'line-join': 'round' };
  map.addLayer({ id: 'rota-silik', type: 'line', source: 'rota-tum', layout: cizgi, paint: { 'line-color': '#FFFFFF', 'line-width': 3 * K, 'line-opacity': A.kamera === 'takip' ? 0.45 : 0 } });
  map.addLayer({ id: 'rota-kenar', type: 'line', source: 'rota', layout: cizgi, paint: { 'line-color': '#FFFFFF', 'line-width': 8 * K } });
  map.addLayer({ id: 'rota-cizgi', type: 'line', source: 'rota', layout: cizgi, paint: { 'line-color': A.rota, 'line-width': 4.5 * K } });
  map.addLayer({
    id: 'uc-nokta',
    type: 'circle',
    source: 'uc',
    paint: { 'circle-radius': 6 * K, 'circle-color': A.rota, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 * K, 'circle-pitch-alignment': 'map' },
  });
}

window.sahneKur = async (veri) => {
  V = veri;
  A = AYAR[V.tema];
  iz = izHazirla(V.rota);
  yazilariKur();
  await document.fonts.ready;

  map = new maplibregl.Map({
    container: 'harita',
    style: STIL[A.stil],
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    maxPitch: 85,
    center: iz.nk[0],
    zoom: 10,
    pixelRatio: (window.devicePixelRatio / K) * HIZ.oran,
    canvasContextAttributes: { antialias: HIZ.aa, preserveDrawingBuffer: Q.get('pdb') === '1' },
  });
  await new Promise((res, rej) => {
    map.once('load', res);
    map.once('error', (e) => rej(new Error(`harita: ${e.error?.message || e}`)));
  });
  katmanlariKur();

  const lng = iz.nk.map((p) => p[0]);
  const lat = iz.nk.map((p) => p[1]);
  const kam = map.cameraForBounds(
    [
      [Math.min(...lng), Math.min(...lat)],
      [Math.max(...lng), Math.max(...lat)],
    ],
    { padding: bosAlan(), maxZoom: 16.5 },
  );
  const c = maplibregl.LngLat.convert(kam.center);
  bas = { center: [c.lng, c.lat], zoom: kam.zoom, padding: bosAlan() };
  await window.kare(0);
};

/* ------------------------------------------------------------------ */
/* Kareler                                                             */
/* ------------------------------------------------------------------ */

/** 12 sn: 0–4 düz haritada rota çizilir · 4–7 eğilir, arazi yükselir · 7–11 kamera döner · 11–12 bekler */
function yorunge(t) {
  const p = yumusak(t / 4);
  const e = yumusak((t - 4) / 3);
  const r = yumusak((t - 7) / 4);
  return {
    p,
    km: p,
    abarti: ara(0.01, A.abarti, e),
    bina: e,
    // Eğilince uzak taraf küçülür; biraz yaklaşılır ki rota kartta büyük kalsın
    kamera: { center: bas.center, zoom: bas.zoom + A.yaklas * e, pitch: 58 * e, bearing: -16 * e + 32 * r, padding: bas.padding },
  };
}

/** 16 sn: 0–2 üstten düz · 2–4 yükselir, kamera rotanın arkasına iner · 4–13 izler · 13–15 geri çekilir · 15–16 bekler */
function takip(t) {
  const L = iz.L;
  const zIzle = L > 8000 ? 15.1 : L > 3000 ? 15.7 : 16.3;
  const H = window.innerHeight * K;
  const izle = (p) => {
    const { p: nokta, yon } = izde(p * L);
    return { center: nokta, zoom: zIzle, pitch: 66, bearing: yon, padding: { top: H * 0.16, bottom: 0, left: 0, right: 0 } };
  };
  const genel = { ...bas, pitch: 0, bearing: 0 };
  const kamAra = (a, b, k) => ({
    center: [ara(a.center[0], b.center[0], k), ara(a.center[1], b.center[1], k)],
    zoom: ara(a.zoom, b.zoom, k),
    pitch: ara(a.pitch, b.pitch, k),
    bearing: aciAra(a.bearing, b.bearing, k),
    padding: { top: ara(a.padding.top, b.padding.top, k), bottom: ara(a.padding.bottom, b.padding.bottom, k), left: ara(a.padding.left, b.padding.left, k), right: ara(a.padding.right, b.padding.right, k) },
  });
  const q = sinir((t - 4) / 9);
  const p = q * q * (3 - 2 * q);
  let kamera;
  if (t < 2) kamera = genel;
  else if (t < 4) kamera = kamAra(genel, izle(0), yumusak((t - 2) / 2));
  else if (t < 13) kamera = izle(p);
  else {
    const son = izle(1);
    kamera = kamAra(son, { ...bas, zoom: bas.zoom - 0.4, pitch: 48, bearing: son.bearing }, yumusak((t - 13) / 2));
  }
  return { p, km: p, abarti: ara(0.01, A.abarti, yumusak((t - 2) / 2)), bina: 1, kamera };
}

let sonImza = '';

/** Kareyi çizer. Görünüm bir önceki kareyle aynıysa (sondaki bekleme) çizmeden false döner: Node son kareyi tekrarlar. */
window.kare = async (t) => {
  const s = A.kamera === 'takip' ? takip(t) : yorunge(t);
  const k = s.kamera;
  const imza = [s.p, s.km, s.abarti, s.bina, k.center[0], k.center[1], k.zoom, k.pitch, k.bearing].map((x) => x.toFixed(6)).join('|');
  if (imza === sonImza) return false;
  sonImza = imza;
  if (Math.abs(s.abarti - sonAbarti) > 0.002 || sonAbarti < 0) {
    // Düz karelerde arazi kapalı (pahalı doku çizimi yok); eğilmeye başlayınca açılır.
    // Arazi nesnesini her karede yeniden kurmamak için abartı doğrudan değiştirilir.
    // Şehir şablonlarında arazi yok (3B etkisini binalar verir; arazi kareyi ~3 kat yavaşlatıyor)
    if (s.abarti <= 0.0105 || !HIZ.arazi || A.arazi === false) {
      if (map.terrain) map.setTerrain(null);
    } else if (!map.terrain) map.setTerrain({ source: 'dem', exaggeration: s.abarti });
    else map.terrain.exaggeration = s.abarti;
    sonAbarti = s.abarti;
  }
  if (A.bina && Math.abs(s.bina - sonBina) > 0.002) {
    map.setPaintProperty('binalar', 'fill-extrusion-opacity', 0.96 * s.bina);
    sonBina = s.bina;
  }
  // Rota değişmediyse kaynağa dokunma: her setData arazinin üstündeki harita dokusunu (render-to-texture) baştan çizdirir
  if (Math.abs(s.p - sonP) > 1e-6) {
    const d = s.p * iz.L;
    map.getSource('rota').setData({ type: 'LineString', coordinates: s.p > 0 ? izParcasi(d) : [iz.nk[0], iz.nk[0]] });
    map.getSource('uc').setData({ type: 'Point', coordinates: izde(d).p });
    sonP = s.p;
  }
  map.jumpTo(s.kamera);
  kmYaz(s.km);
  await bekle();
  return true;
};
