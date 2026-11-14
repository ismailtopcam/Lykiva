"""Kart13–17: şehir merkezleri ve dağ için 3B kartlar (three.js).
13 İzmir Kordon koşusu (hikâye) · 14 İstanbul Sultanahmet→Galata yürüyüşü (gönderi)
15 Antalya Kaleiçi→Konyaaltı bisiklet (kare) · 16 Faralya→Kabak, Babadağ (hikâye)
17 Kaş–Kalkan takip kamerası (gönderi)"""
import json
import os
import sys

from cards import D, CREAM, NIGHT, ORANGE, LOGO, stat, INK, SURF, TERRA
from geo import FONTS

HERE = os.path.dirname(os.path.abspath(__file__))
THREE = '/_blob/b84b88b435c18dd928175efaa8ebd3fe'

B = {
    'izmir': ('/_blob/a69eadc4bb8ab8568ec0089802e73e67', '/_blob/f589d919253eb345e4d9dbca71f1e87a'),
    'istanbul': ('/_blob/9599f8693524baf0c37f45c94231f8b6', '/_blob/b1b53efb1efe893f9fe0c354253fcd88'),
    'antalya': ('/_blob/be648e3d3ffb9959bd0f3a19b41fbe63', '/_blob/b257f8fb07b051fb8c5ef374b2d36fdd'),
    'faralya': ('/_blob/3f77f8eae350db199d56e2f7edf1b618', '/_blob/948a1d957e7d0535e21ec6f085064fd1'),
    'kas': ('/_blob/00e1e5e3e96a7e55d41d0457f37b0581', '/_blob/6f2c2676839d33a5a6742f7d6994d830'),
}

ESRI = 'Harita © Esri, HERE, Garmin · bina verisi © OpenStreetMap katkıcıları · yükseklik: Mapzen Terrarium'
ESRI_UYDU = 'Uydu görüntüsü © Esri, Maxar, Earthstar Geographics · bina verisi © OpenStreetMap katkıcıları · yükseklik: Mapzen Terrarium'
OTM = 'Harita © OpenTopoMap (CC-BY-SA) · veri © OpenStreetMap katkıcıları · yükseklik: Mapzen Terrarium (SRTM)'


def rota(ad, dx=0, dy=0):
    return [[int(a) - dx, int(b) - dy] for a, b in (x.split(',') for x in open(os.path.join(HERE, 'veri', f'{ad}_px.txt')).read().strip().split(';'))]


LOGIC = r"""
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.tuval = (el) => { this.el = el; };
    this.sayac = (el) => { this.sayacEl = el; };
  }
  componentDidMount() {
    this.iptal = false;
    const bekle = () => {
      if (this.iptal) return;
      if (!(window.THREE && this.el)) { setTimeout(bekle, 100); return; }
      if (!('IntersectionObserver' in window)) { this.kur(); return; }
      // Yalnız ekrandayken çiz: aynı sayfada çok sayıda 3B kart tarayıcının WebGL sınırını aşmasın
      this.gozcu = new IntersectionObserver((e) => {
        const gor = e.some((x) => x.isIntersecting);
        if (gor && !this.renderer) this.kur();
        else if (!gor && this.renderer) this.sok();
      }, { rootMargin: '200px' });
      this.gozcu.observe(this.el);
    };
    bekle();
  }
  componentWillUnmount() {
    this.iptal = true;
    if (this.gozcu) this.gozcu.disconnect();
    this.sok();
  }
  sok() {
    this.nesil = (this.nesil || 0) + 1;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.renderer) {
      this.sahne && this.sahne.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && (o.material.map && o.material.map.dispose(), o.material.dispose()); });
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.renderer = null;
    this.sahne = null;
  }
  kur() {
    const nesil = this.nesil = (this.nesil || 0) + 1;
    const T = window.THREE, el = this.el, cfg = KONFIG;
    const W = cfg.w, H = cfg.h, MW = cfg.mw, MH = cfg.mh, GX = cfg.gx, GY = cfg.gy;
    const renderer = new T.WebGLRenderer({ canvas: el, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    this.renderer = renderer;
    const scene = new T.Scene();
    this.sahne = scene;
    scene.background = new T.Color(cfg.zemin);
    scene.fog = new T.Fog(cfg.zemin, cfg.sis[0], cfg.sis[1]);
    const camera = new T.PerspectiveCamera(cfg.fov || 34, W / H, cfg.near || 10, 30000);
    scene.add(new T.HemisphereLight(0xffffff, cfg.yer || 0x445544, cfg.isik[0]));
    const gunes = new T.DirectionalLight(cfg.gunesRenk || 0xffffff, cfg.isik[1]);
    gunes.position.set(cfg.gunes[0], cfg.gunes[1], cfg.gunes[2]);
    scene.add(gunes);

    const grup = new T.Group();
    scene.add(grup);
    const img = new Image();
    img.onload = () => {
      if (this.iptal || nesil !== this.nesil) return;
      const c = document.createElement('canvas');
      c.width = GX; c.height = GY;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, GX, GY);
      const px = g.getImageData(0, 0, GX, GY).data;
      // gri 0..255 = 0..maxH metre; birim = harita pikseli (mpp metre)
      const h = new Float32Array(GX * GY);
      for (let i = 0; i < GX * GY; i++) h[i] = (px[i * 4] / 255) * cfg.maxH / cfg.mpp;
      const yukseklik = (x, y) => {
        const fx = Math.max(0, Math.min(GX - 1.001, x / MW * (GX - 1)));
        const fy = Math.max(0, Math.min(GY - 1.001, y / MH * (GY - 1)));
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const a = h[y0 * GX + x0], b = h[y0 * GX + x0 + 1], c2 = h[(y0 + 1) * GX + x0], d = h[(y0 + 1) * GX + x0 + 1];
        return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c2 * (1 - tx) * ty + d * tx * ty;
      };
      const geo = new T.PlaneGeometry(MW, MH, GX - 1, GY - 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, h[i]);
      geo.computeVertexNormals();
      const doku = new T.TextureLoader().load(cfg.harita);
      doku.colorSpace = T.SRGBColorSpace;
      doku.anisotropy = 8;
      const mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ map: doku, roughness: 1, metalness: 0 }));
      grup.add(mesh);
      if (cfg.deniz) {
        const deniz = new T.Mesh(new T.PlaneGeometry(MW * 10, MH * 10, 40, 40), new T.MeshBasicMaterial({ color: cfg.deniz }));
        deniz.position.z = -0.3;
        scene.add(deniz);
      }

      const [r1, r2, ust] = cfg.tup;
      // Rota düz bir eğri olarak kurulur; yükseklik gölgelendiricide eklenir (tüp kesiti dikeyde gerilmesin)
      const pts = cfg.rota.map(([x, y]) => new T.Vector3(x - MW / 2, MH / 2 - y, 0));
      const egri = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const zH = (p) => yukseklik(p.x + MW / 2, MH / 2 - p.y);
      const U = { value: 0.02 };
      const SEG = 1600;
      const merkezH = new Float32Array(SEG + 1);
      for (let i = 0; i <= SEG; i++) merkezH[i] = zH(egri.getPointAt(i / SEG));
      const tupGeo = (r, rs) => {
        const g = new T.TubeGeometry(egri, SEG, r, rs, false);
        const n = g.attributes.position.count, a = new Float32Array(n);
        for (let v = 0; v < n; v++) a[v] = merkezH[Math.min(SEG, Math.floor(v / (rs + 1)))];
        g.setAttribute('aH', new T.BufferAttribute(a, 1));
        return g;
      };
      const yamala = (m) => {
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uSz = U;
          sh.vertexShader = 'attribute float aH;\nuniform float uSz;\n' + sh.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\ntransformed.z += aH * uSz + ' + ust.toFixed(2) + ';');
        };
        m.customProgramCacheKey = () => 'rota-yukseklik';
        return m;
      };
      const kenar = new T.Mesh(tupGeo(r1, 8), yamala(new T.MeshBasicMaterial({ color: cfg.kenar, side: T.BackSide })));
      const cizgi = new T.Mesh(tupGeo(r2, 8), yamala(new T.MeshBasicMaterial({ color: cfg.cizgi })));
      const uc = new T.Mesh(new T.SphereGeometry(r1 * (cfg.ucBoy || 1.6), 24, 16), new T.MeshBasicMaterial({ color: cfg.kenar, side: T.BackSide }));
      const ucIc = new T.Mesh(new T.SphereGeometry(r1 * (cfg.ucBoy || 1.6) * 0.66, 24, 16), new T.MeshBasicMaterial({ color: cfg.cizgi }));
      uc.add(ucIc);
      scene.add(kenar, cizgi, uc);
      if (cfg.mod === 'takip') {
        const iz = new T.Mesh(tupGeo(r2 * 0.75, 6),
          yamala(new T.MeshBasicMaterial({ color: cfg.kenar, transparent: true, opacity: 0.45 })));
        scene.add(iz);
      }
      const noktaAl = (u, sz) => { const p = egri.getPointAt(Math.max(0, Math.min(1, u))); p.z = zH(p) * sz + ust; return p; };
      const n1 = kenar.geometry.index.count, n2 = cizgi.geometry.index.count;

      const hedef = new T.Vector3(cfg.hedef[0] - MW / 2, MH / 2 - cfg.hedef[1], 0);
      const yumusak = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
      const yorunge = (phiD, thetaD, R) => {
        const phi = phiD * Math.PI / 180, theta = thetaD * Math.PI / 180;
        const o = new T.Vector3(Math.sin(phi) * Math.sin(theta), -Math.sin(phi) * Math.cos(theta), Math.cos(phi)).multiplyScalar(R);
        return {
          pos: hedef.clone().add(o),
          bak: hedef.clone(),
          up: new T.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(phi) * Math.cos(theta), Math.sin(phi)),
        };
      };
      const sayacYaz = (f) => {
        if (this.sayacEl && cfg.km) this.sayacEl.textContent = (f * cfg.km).toFixed(cfg.km < 10 ? 2 : 1).replace('.', ',');
      };
      const rotaCiz = (f, sz) => {
        U.value = sz;
        kenar.geometry.setDrawRange(0, Math.floor(n1 * f / 3) * 3);
        cizgi.geometry.setDrawRange(0, Math.floor(n2 * f / 3) * 3);
        uc.position.copy(noktaAl(Math.min(0.9999, f), sz));
        uc.visible = f > 0.001;
        sayacYaz(f);
      };
      const A = cfg.aci;
      const t0 = performance.now();
      const ciz = () => {
        if (this.iptal || nesil !== this.nesil) return;
        const abarti = (this.props.abarti ?? cfg.abarti);
        let poz;
        if (cfg.mod === 'takip') {
          // 0–2 sn düz harita · 2–4 sn yükselir, kamera rotanın arkasına iner · 4–13 sn rotayı izler · 13–15 sn geri çekilir · 15–16 sn bekler
          const DONGU = 16;
          const t = ((performance.now() - t0) / 1000) % DONGU;
          const kalk = yumusak((t - 2) / 2);
          const f = yumusak((t - 4) / 9);
          const geri = yumusak((t - 13) / 2);
          const w = kalk * (1 - geri);
          // Üstten bakarken sis uzakta, rotayı izlerken yakında
          scene.fog.near = cfg.uzaklik * 1.15 + (cfg.sis[0] - cfg.uzaklik * 1.15) * w;
          scene.fog.far = cfg.uzaklik * 2.8 + (cfg.sis[1] - cfg.uzaklik * 2.8) * w;
          const sz = Math.max(0.02, kalk * abarti);
          grup.scale.z = sz;
          rotaCiz(f, sz);
          const ust = yorunge(1 + geri * (A[0] - 1), A[1] + geri * A[2], cfg.uzaklik * (1 - cfg.yaklas * geri));
          const kp = (u) => noktaAl(u, sz);
          const P = kp(f);
          const yon = kp(f + 0.035).sub(kp(f - 0.015)); yon.z = 0; yon.normalize();
          const [geriM, yukM, ileriM] = cfg.takip;
          const kpos = P.clone().addScaledVector(yon, -geriM);
          const zemin = yukseklik(kpos.x + MW / 2, MH / 2 - kpos.y) * sz;
          kpos.z = Math.max(P.z + yukM, zemin + yukM * 0.55);
          const kbak = P.clone().addScaledVector(yon, ileriM);
          poz = {
            pos: ust.pos.clone().lerp(kpos, w),
            bak: ust.bak.clone().lerp(kbak, w),
            up: ust.up.clone().lerp(new T.Vector3(0, 0, 1), w).normalize(),
          };
        } else {
          // 0–4 sn düz harita, rota çizilir · 4–7 sn eğilir, binalar / dağlar yükselir · 7–11 sn yavaş tur · 11–12 sn bekler
          const DONGU = 12;
          const t = ((performance.now() - t0) / 1000) % DONGU;
          const f = yumusak(t / 4);
          const kalk = yumusak((t - 4) / 3);
          const tur = yumusak((t - 7) / 4);
          const sz = Math.max(0.02, kalk * abarti);
          grup.scale.z = sz;
          rotaCiz(f, sz);
          poz = yorunge(1 + kalk * (A[0] - 1), A[1] + kalk * A[2] + tur * A[3], cfg.uzaklik * (1 - cfg.yaklas * kalk));
        }
        camera.position.copy(poz.pos);
        camera.up.copy(poz.up);
        camera.lookAt(poz.bak);
        renderer.render(scene, camera);
        this.raf = requestAnimationFrame(ciz);
      };
      ciz();
    };
    img.src = cfg.yukseklik;
  }
  renderVals() {
    return { tuval: this.tuval, sayac: this.sayac };
  }
}
"""


def sayfa(title, W, H, k, konfig, overlay, bg, aria):
    w, h = round(W / k), round(H / k)
    logic = LOGIC.replace('KONFIG', json.dumps(konfig, separators=(',', ':'), ensure_ascii=False))
    props = json.dumps({"abarti": {"editor": "range", "min": 1, "max": 4, "step": 0.1, "default": konfig['abarti'], "unit": "×"},
                        "$preview": {"width": W, "height": H}}, ensure_ascii=False).replace('&', '&amp;').replace("'", '&#39;')
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
<script src="{THREE}"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>
body{{margin:0}}
a{{color:#B04E25}}a:hover{{color:#8A3C1C}}
</style>
</helmet>
<div style="width: {W}px; height: {H}px; position: relative; overflow: hidden; background: {bg}; font-family: Inter, system-ui, sans-serif">
<canvas ref="{{{{ tuval }}}}" width="{W}" height="{H}" role="img" aria-label="{aria}" style="position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; display: block"></canvas>
<div style="position: absolute; left: 0; top: 0; width: {w}px; height: {h}px; transform: scale({k:g}); transform-origin: 0 0; pointer-events: none">
{overlay}
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{props}'>
{logic}
</script>
</body>
</html>
"""


def temel(ad, w, h, mw, mh, gx, gy, maxH, mpp, rt, **kw):
    harita, yk = B[ad]
    k = {"w": w, "h": h, "harita": harita, "yukseklik": yk, "mw": mw, "mh": mh, "gx": gx, "gy": gy,
         "maxH": maxH, "mpp": mpp, "rota": rt, "isik": [1.1, 1.6], "gunes": [-900, 700, 1200],
         "aci": [57, -12, 20, 26], "tup": [13, 7.5, 10], "abarti": 1.6, "mod": "tur"}
    k.update(kw)
    k.setdefault("sis", [k["uzaklik"] * 1.15, k["uzaklik"] * 2.8])
    return k


def hap(text, bg, fg):
    return (f'<div style="height: 30px; padding: 0 12px; border-radius: 15px; background: {bg}; display: flex; align-items: center; '
            f'font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: {fg}">{text}</div>')


def sayac_html(color, size):
    return f'<span ref="{{{{ sayac }}}}" style="font-variant-numeric: tabular-nums">0,00</span>'


# ---------------------------------------------------------------- 13 İzmir, gece, hikâye
def k13():
    W, H, k = 1080, 1920, 3
    konfig = temel('izmir', W, H, 1150, 1700, 575, 850, 200, 1.871, rota('izmir'),
                   hedef=[500, 860], uzaklik=2350, yaklas=0.3, zemin='#1C1B21', yer=0x202028,
                   isik=[0.9, 1.9], gunes=[700, -500, 900], gunesRenk=0xFFE2C4,
                   aci=[62, -8, -30, -22], tup=[6, 3.6, 5], abarti=2.4, deniz='#232227', cizgi=ORANGE, kenar='#FBF8F2', km=2.77)
    overlay = f'''
<div style="position: absolute; left: 24px; right: 24px; top: 92px; display: flex; justify-content: space-between; align-items: center">
  {hap("KOŞU · 7 KASIM", "rgba(28,27,33,0.82)", CREAM)}
  <div style="height: 30px; padding: 0 12px; border-radius: 15px; background: rgba(28,27,33,0.82); display: flex; align-items: center">{LOGO(CREAM, 15)}</div>
</div>
<div style="position: absolute; left: 16px; right: 16px; bottom: 88px; border-radius: 20px; background: rgba(28,27,33,0.88); padding: 18px 20px; color: {CREAM}">
  <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: #A3A6AE">İZMİR · ALSANCAK</div>
  <div style="{D}; font-weight: 700; font-size: 24px; margin-top: 2px">Kordon’da akşam koşusu</div>
  <div style="{D}; font-weight: 800; font-size: 54px; line-height: 1; letter-spacing: -0.04em; margin-top: 6px">{sayac_html(CREAM, 54)}<span style="font-size: 20px; letter-spacing: 0; color: {ORANGE}"> km</span></div>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px">
    {stat("Süre", "15:14", CREAM, "#A3A6AE")}{stat("Tempo", "5:30 /km", CREAM, "#A3A6AE")}{stat("Başlangıç", "19:40", CREAM, "#A3A6AE")}
  </div>
  <div style="font-size: 6px; color: #8A8D95; margin-top: 10px">{ESRI}</div>
</div>'''
    return ('Kart13-IzmirGece.dc.html', '13 · İzmir Kordon — gece şehir 3B · Hikâye 1080×1920', W, H,
            sayfa('İzmir Kordon 3B', W, H, k, konfig, overlay, '#1C1B21',
                  'Alsancak Kordon koşu rotası: önce düz gece haritasında çizilir, sonra harita eğilip binalar üç boyutlu yükselir'))


# ---------------------------------------------------------------- 14 İstanbul, maket, gönderi
def k14():
    W, H, k = 1080, 1350, 2.5
    konfig = temel('istanbul', W, H, 1300, 1500, 650, 750, 120, 1.803, rota('istanbul'),
                   hedef=[680, 770], uzaklik=2250, yaklas=0.22, zemin='#ECEBEF', yer=0xB8B6C0,
                   isik=[1.25, 1.5], gunes=[-800, -300, 1100],
                   aci=[58, -6, 24, 22], tup=[6.5, 3.8, 5], abarti=2.2, cizgi=TERRA, kenar='#FFFFFF', km=2.91)
    overlay = f'''
<div style="position: absolute; left: 28px; right: 28px; top: 26px; display: flex; justify-content: space-between; align-items: flex-start">
  <div style="padding: 10px 14px; border-radius: 14px; background: rgba(255,255,255,0.92); box-shadow: 0 1px 0 rgba(22,32,27,0.06)">
    <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.12em; color: #5E6461">YÜRÜYÜŞ · İSTANBUL</div>
    <div style="{D}; font-weight: 800; font-size: 24px; color: {INK}; margin-top: 2px; line-height: 1.1">Sultanahmet → Galata</div>
  </div>
  <div style="padding: 8px 12px; border-radius: 14px; background: rgba(255,255,255,0.92)">{LOGO(INK, 15)}</div>
</div>
<div style="position: absolute; left: 28px; right: 28px; bottom: 26px; border-radius: 18px; background: #FFFFFF; padding: 14px 18px; display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 8px; align-items: end; box-shadow: 0 2px 0 rgba(22,32,27,0.06)">
  <div><div style="font-size: 11px; color: #5E6461; font-weight: 500">Mesafe</div><div style="{D}; font-weight: 800; font-size: 30px; color: {INK}; line-height: 1; letter-spacing: -0.03em">{sayac_html(INK, 30)}<span style="font-size: 14px; color: {TERRA}"> km</span></div></div>
  {stat("Süre", "0:39", INK, "#5E6461", 18)}{stat("Adım", "3.880", INK, "#5E6461", 18)}
</div>
<div style="position: absolute; right: 30px; bottom: 96px; font-size: 5px; color: #5E6461; background: rgba(255,255,255,0.85); padding: 1px 4px">{ESRI}</div>'''
    return ('Kart14-IstanbulMaket.dc.html', '14 · İstanbul — beyaz maket şehir 3B · Gönderi 1080×1350', W, H,
            sayfa('İstanbul maket 3B', W, H, k, konfig, overlay, '#ECEBEF',
                  'Sultanahmet’ten Galata Köprüsü üzerinden Galata Kulesi’ne yürüyüş: harita eğilir, binalar beyaz maket gibi yükselir'))


# ---------------------------------------------------------------- 15 Antalya, uydu, kare
def k15():
    W, H, k = 1080, 1080, 2.5
    konfig = temel('antalya', W, H, 1200, 1200, 600, 600, 150, 3.821, rota('antalya', 200, 100),
                   hedef=[600, 650], uzaklik=2050, yaklas=0.32, zemin='#0B1B2B', yer=0x223344,
                   isik=[1.0, 1.7], gunes=[-600, -900, 1000], gunesRenk=0xFFF1DC,
                   aci=[64, 0, 10, 14], tup=[5.5, 3.3, 4], abarti=4, deniz='#0A1F2C', cizgi=ORANGE, kenar='#FFFFFF', km=6.37)
    overlay = f'''
<div style="position: absolute; left: 24px; right: 24px; top: 22px; display: flex; justify-content: space-between; align-items: center">
  {hap("BİSİKLET · ANTALYA", "rgba(11,27,43,0.78)", CREAM)}
  <div style="height: 30px; padding: 0 12px; border-radius: 15px; background: rgba(11,27,43,0.78); display: flex; align-items: center">{LOGO(CREAM, 15)}</div>
</div>
<div style="position: absolute; left: 22px; bottom: 22px; right: 22px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px">
  <div style="border-radius: 18px; background: rgba(11,27,43,0.86); padding: 14px 18px; color: {CREAM}">
    <div style="{D}; font-weight: 700; font-size: 19px">Kaleiçi → Konyaaltı</div>
    <div style="{D}; font-weight: 800; font-size: 44px; line-height: 1; letter-spacing: -0.04em; margin-top: 4px">{sayac_html(CREAM, 44)}<span style="font-size: 17px; letter-spacing: 0; color: {ORANGE}"> km</span></div>
  </div>
  <div style="border-radius: 18px; background: rgba(11,27,43,0.86); padding: 12px 16px; display: grid; grid-template-columns: repeat(3, auto); gap: 14px">
    {stat("Süre", "0:24", CREAM, "#9DB0C2", 16)}{stat("Ort.", "16,0", CREAM, "#9DB0C2", 16)}{stat("Tırmanış", "30 m", CREAM, "#9DB0C2", 16)}
  </div>
</div>
<div style="position: absolute; right: 24px; bottom: 112px; font-size: 5px; color: #C9D3DC; background: rgba(11,27,43,0.7); padding: 1px 4px">{ESRI_UYDU}</div>'''
    return ('Kart15-AntalyaUydu.dc.html', '15 · Antalya — uydu görüntülü şehir 3B · Kare 1080×1080', W, H,
            sayfa('Antalya uydu 3B', W, H, k, konfig, overlay, '#0B1B2B',
                  'Kaleiçi’nden Konyaaltı’na sahil bisiklet rotası uydu görüntüsü üzerinde: harita eğilir, falezler ve binalar yükselir'))


# ---------------------------------------------------------------- 16 Faralya → Kabak, Babadağ, hikâye
def k16():
    W, H, k = 1080, 1920, 3
    konfig = temel('faralya', W, H, 1300, 1500, 650, 750, 2000, 7.68, rota('faralya'),
                   hedef=[700, 860], uzaklik=2300, yaklas=0.2, zemin='#EFEAE0', yer=0x667755,
                   isik=[1.0, 1.9], gunes=[-1000, -400, 900],
                   aci=[62, -10, -20, -10], tup=[6.5, 3.8, 6], abarti=1.4, deniz='#A3DDE8', cizgi='#C8461E', kenar='#FFFFFF', km=5.63,
                   sis=[2300 * 1.0, 2300 * 2.6])
    overlay = f'''
<div style="position: absolute; left: 24px; right: 24px; top: 92px; display: flex; justify-content: space-between; align-items: center">
  {hap("YÜRÜYÜŞ · LİKYA YOLU", "rgba(251,248,242,0.9)", INK)}
  <div style="height: 30px; padding: 0 12px; border-radius: 15px; background: rgba(251,248,242,0.9); display: flex; align-items: center">{LOGO(INK, 15)}</div>
</div>
<div style="position: absolute; left: 24px; top: 136px; padding: 6px 10px; border-radius: 10px; background: rgba(22,32,27,0.78); color: {CREAM}; font-size: 10px; font-weight: 600; letter-spacing: 0.04em">Arkada Babadağ · 1969 m</div>
<div style="position: absolute; left: 16px; right: 16px; bottom: 88px; border-radius: 20px; background: rgba(251,248,242,0.94); padding: 18px 20px; color: {INK}">
  <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: #5E6461">FETHİYE · KELEBEKLER VADİSİ ÜSTÜ</div>
  <div style="{D}; font-weight: 700; font-size: 24px; margin-top: 2px">Faralya → Kabak</div>
  <div style="{D}; font-weight: 800; font-size: 54px; line-height: 1; letter-spacing: -0.04em; margin-top: 6px">{sayac_html(INK, 54)}<span style="font-size: 20px; letter-spacing: 0; color: #C8461E"> km</span></div>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px">
    {stat("Süre", "1:27", INK, "#5E6461")}{stat("Tırmanış", "200 m", INK, "#5E6461")}{stat("İniş", "495 m", INK, "#5E6461")}
  </div>
  <div style="font-size: 6px; color: #6B716D; margin-top: 10px">{OTM}</div>
</div>'''
    return ('Kart16-BabadagHikaye.dc.html', '16 · Faralya → Kabak, Babadağ — dağ 3B · Hikâye 1080×1920', W, H,
            sayfa('Babadağ 3B', W, H, k, konfig, overlay, '#EFEAE0',
                  'Faralya’dan Kabak’a Likya Yolu yürüyüşü: harita eğilir, Babadağ ve Kelebekler Vadisi üç boyutlu yükselir'))


# ---------------------------------------------------------------- 17 Kaş–Kalkan, takip kamerası, gönderi
def k17():
    W, H, k = 1080, 1350, 2.5
    konfig = temel('kas', W, H, 1590, 1390, 398, 348, 1700, 15.4, rota('bike'),
                   hedef=[800, 700], uzaklik=2950, yaklas=0.12, zemin='#D9E6E3', yer=0x556655,
                   isik=[1.0, 1.8], gunes=[-900, 700, 1200],
                   aci=[52, -10, 18, 0], tup=[5.5, 3.2, 5], ucBoy=1.4, abarti=1.6, mod='takip', takip=[430, 300, 220], near=4, deniz='#A3DDE8',
                   cizgi=ORANGE, kenar='#FBF8F2', km=26.45, sis=[1500, 5200], fov=40)
    overlay = f'''
<div style="position: absolute; left: 28px; right: 28px; top: 26px; display: flex; justify-content: space-between; align-items: center">
  {hap("BİSİKLET · KAŞ – KALKAN", "rgba(22,32,27,0.82)", CREAM)}
  <div style="height: 30px; padding: 0 12px; border-radius: 15px; background: rgba(22,32,27,0.82); display: flex; align-items: center">{LOGO(CREAM, 15)}</div>
</div>
<div style="position: absolute; left: 28px; bottom: 26px; right: 28px; display: flex; justify-content: space-between; align-items: flex-end">
  <div style="border-radius: 18px; background: rgba(22,32,27,0.86); padding: 12px 18px; color: {CREAM}">
    <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.12em; color: #A3ACA5">D400 SAHİL YOLU</div>
    <div style="{D}; font-weight: 800; font-size: 50px; line-height: 1; letter-spacing: -0.04em; margin-top: 4px">{sayac_html(CREAM, 50)}<span style="font-size: 18px; letter-spacing: 0; color: {ORANGE}"> km</span></div>
  </div>
  <div style="border-radius: 18px; background: rgba(22,32,27,0.86); padding: 12px 16px; display: grid; grid-template-columns: repeat(2, auto); gap: 6px 16px">
    {stat("Süre", "1:38", CREAM, "#A3ACA5", 16)}{stat("Tırmanış", "412 m", CREAM, "#A3ACA5", 16)}
  </div>
</div>
<div style="position: absolute; right: 30px; bottom: 110px; font-size: 5px; color: #C9D0CB; background: rgba(22,32,27,0.7); padding: 1px 4px">{OTM}</div>'''
    return ('Kart17-KasTakipKamera.dc.html', '17 · Kaş – Kalkan — rotayı izleyen kamera 3B · Gönderi 1080×1350', W, H,
            sayfa('Kaş Kalkan takip 3B', W, H, k, konfig, overlay, '#16201B',
                  'Kaş – Kalkan bisiklet rotası: harita yükselir, kamera rotanın arkasından sahil yolunu baştan sona izler, sonra geri çekilir'))


KARTLAR = [k13, k14, k15, k16, k17]

if __name__ == '__main__':
    root = sys.argv[1]
    for f in KARTLAR:
        name, title, W, H, html = f()
        open(f'{root}/project/{name}', 'w').write(html)
        print(name, len(html))
