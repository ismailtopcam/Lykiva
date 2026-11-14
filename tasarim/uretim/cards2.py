"""Kartların gerçek rota + harita + hareketli çizgi sürümü (cards.py üzerine)."""
import os
import sys

import cards as C
from cards import D, INK, CREAM, SURF, TERRA, SEA, NIGHT, ORANGE, LOGO, stat
from geo import ELEV_A, smooth_line, page

HERE = os.path.dirname(os.path.abspath(__file__))
MAP = '/_blob/00e1e5e3e96a7e55d41d0457f37b0581'
MAPW, MAPH = 1590, 1390
ATTR = 'Harita © OpenTopoMap (CC-BY-SA) · veri © OpenStreetMap katkıcıları, SRTM'


def _read(name):
    return [tuple(map(int, x.split(','))) for x in open(os.path.join(HERE, 'veri', name)).read().strip().split(';')]


BIKE = _read('bike_px.txt')   # Kaş → Kalkan, harita pikseli (harita-topo.jpg üzerinde)
HIKE = _read('hike_px.txt')   # Faralya → Kabak, 0..1000 kutusunda

# Çizgi 6 sn'de baştan sona çizilir, 1,5 sn bekler, yeniden başlar
CSS = """
@keyframes ciz { 0% { stroke-dashoffset: 1 } 75% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: 0 } }
@keyframes git { 0% { offset-distance: 0% } 75% { offset-distance: 100% } 100% { offset-distance: 100% } }
@keyframes ac { 0% { transform: scaleX(0) } 75% { transform: scaleX(1) } 100% { transform: scaleX(1) } }
@keyframes buyu { 0% { transform: scaleY(0) } 60% { transform: scaleY(1) } 100% { transform: scaleY(1) } }
.iz { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ciz 8s ease-in-out infinite; }
.nokta { offset-rotate: 0deg; animation: git 8s ease-in-out infinite; }
.acil { transform-box: fill-box; transform-origin: 0 50%; animation: ac 8s ease-in-out infinite; }
.cubuk { transform-box: fill-box; transform-origin: 50% 100%; animation: buyu 8s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .iz, .nokta, .acil, .cubuk { animation: none; stroke-dashoffset: 0; transform: none; offset-distance: 100%; } }
"""


def poly(pts):
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)


def fit(pts, w, h, pad=0):
    """Noktaları w×h kutuya oranı koruyarak ortalar."""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    s = min((w - 2 * pad) / (max(xs) - min(xs) or 1), (h - 2 * pad) / (max(ys) - min(ys) or 1))
    ox = (w - (max(xs) - min(xs)) * s) / 2 - min(xs) * s
    oy = (h - (max(ys) - min(ys)) * s) / 2 - min(ys) * s
    return [(x * s + ox, y * s + oy) for x, y in pts]


def anim(d, color, width, casing=None, casing_w=None, dot=None, dot_r=None):
    """Baştan sona çizilen rota + ucunda ilerleyen nokta."""
    out = ''
    if casing:
        out += f'<path class="iz" pathLength="1" d="{d}" fill="none" stroke="{casing}" stroke-width="{casing_w}" stroke-linecap="round" stroke-linejoin="round"/>'
    out += f'<path class="iz" pathLength="1" d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'
    if dot:
        out += f'<circle class="nokta" cx="0" cy="0" r="{dot_r}" fill="{dot}" stroke="{color}" stroke-width="{dot_r * 0.45:.1f}" style="offset-path: path(\'{d}\')"/>'
    return out


def harita(L, T, Wd, Hd, mx, my, s, filt, inner, label, relative=False):
    """Harita görseli + aynı koordinatlarda rota katmanı. mx,my: görünen alanın harita pikselindeki sol üstü."""
    pos = 'position: relative' if relative else f'position: absolute; left: {L}px; top: {T}px'
    return (f'<div style="{pos}; width: {Wd}px; height: {Hd}px; overflow: hidden">'
            f'<img src="{MAP}" alt="" style="position: absolute; left: {-mx * s:.2f}px; top: {-my * s:.2f}px; width: {MAPW * s:.2f}px; height: {MAPH * s:.2f}px; max-width: none; filter: {filt}">'
            f'<svg width="{Wd}" height="{Hd}" viewBox="{mx} {my} {Wd / s:.1f} {Hd / s:.1f}" role="img" aria-label="{label}" style="position: absolute; left: 0; top: 0">{inner}</svg>'
            f'</div>')


GECE_FILTRE = 'grayscale(1) invert(1) brightness(0.62) contrast(1.15)'
BIKE_D = poly(BIKE)


# ---------------------------------------------------------------- 1 · harita + çizim
def k1():
    w, h = 360, 640
    s = 360 / 1400
    inner = anim(BIKE_D, ORANGE, 19, casing=NIGHT, casing_w=40, dot=NIGHT, dot_r=24)
    body = f'''
{harita(0, 0, 360, 380, 100, 10, s, GECE_FILTRE, inner, "Kaş’tan Kalkan’a sahil yolu, harita üzerinde turuncu rota")}
<div style="position: absolute; right: 10px; top: 366px; font-size: 6px; color: #8C968F">{ATTR}</div>
<div style="position: absolute; left: 28px; right: 28px; bottom: 90px; color: {CREAM}">
  <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: #A3ACA5">BİSİKLET · 7 KASIM</div>
  <div style="{D}; font-weight: 700; font-size: 26px; margin-top: 6px">Kaş – Kalkan</div>
  <div style="{D}; font-weight: 800; font-size: 66px; line-height: 0.95; letter-spacing: -0.04em; margin-top: 4px">27,4<span style="font-size: 26px; letter-spacing: 0; color: {ORANGE}"> km</span></div>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #2E3B35">
    {stat("Süre", "1:38", CREAM, "#A3ACA5")}{stat("Tırmanış", "412 m", CREAM, "#A3ACA5")}{stat("Maks.", "48,2", CREAM, "#A3ACA5")}
  </div>
  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 22px">
    <span style="font-size: 12px; font-weight: 600; color: #A3ACA5">@mert · @deniz · @can</span>{LOGO(CREAM, 18)}
  </div>
</div>'''
    return 'Kart01-GeceTopografya.dc.html', '01 · Gece haritası — Hikâye 1080×1920', w, h, page('Gece haritası', w, h, body, NIGHT, CSS)


# ---------------------------------------------------------------- 2 · profil soldan sağa açılır
def k2():
    name, title, w, h, html = C.k2()
    d_main, _ = smooth_line(ELEV_A, 432, 300, top=40, lo=0, hi=260)
    old_fill = f'<path d="{d_main} L432 300 L0 300Z" fill="{TERRA}"/>\n  <path d="{d_main}" fill="none" stroke="{INK}" stroke-width="2"/>'
    assert old_fill in html
    new = (f'<defs><mask id="profilAc"><rect class="acil" x="0" y="0" width="432" height="300" fill="#fff"/></mask></defs>'
           f'<g mask="url(#profilAc)"><path d="{d_main} L432 300 L0 300Z" fill="{TERRA}"/><path d="{d_main}" fill="none" stroke="{INK}" stroke-width="2"/></g>')
    html = html.replace(old_fill, new).replace('a{color:#B04E25}a:hover{color:#8A3C1C}\n', 'a{color:#B04E25}a:hover{color:#8A3C1C}\n' + CSS + '\n', 1)
    return name, title, w, h, html


# ---------------------------------------------------------------- 3 · pulda gerçek rota
def k3():
    name, title, w, h, html = C.k3()
    i0 = html.index('<svg width="84" height="62"'); i1 = html.index('</svg>', i0) + 6
    d = poly(fit(BIKE, 84, 62, 4))
    html = html[:i0] + f'<svg width="84" height="62" viewBox="0 0 84 62" role="img" aria-label="Pul üzerinde Kaş – Kalkan rotası">{anim(d, SURF, 2.4)}</svg>' + html[i1:]
    html = html.replace('a{color:#B04E25}a:hover{color:#8A3C1C}\n', 'a{color:#B04E25}a:hover{color:#8A3C1C}\n' + CSS + '\n', 1)
    return name, title, w, h, html


# ---------------------------------------------------------------- 4 · barkod çubukları sırayla büyür
def k4():
    name, title, w, h, html = C.k4()
    parts = html.split('<rect x="')
    out = parts[0]
    for i, prt in enumerate(parts[1:]):
        out += f'<rect class="cubuk" style="animation-delay: {i * 0.06:.2f}s" x="' + prt
    html = out.replace('a{color:#B04E25}a:hover{color:#8A3C1C}\n', 'a{color:#B04E25}a:hover{color:#8A3C1C}\n' + CSS + '\n', 1)
    return name, title, w, h, html


# ---------------------------------------------------------------- 5 · minimal, gerçek rota çizilir
def k5():
    name, title, w, h, html = C.k5()
    i0 = html.index('<svg width="432" height="90"'); i1 = html.index('</svg>', i0) + 6
    d = poly(fit(BIKE, 432, 90, 8))
    html = html[:i0] + (f'<svg width="432" height="90" viewBox="0 0 432 90" role="img" aria-label="Kaş – Kalkan rota çizgisi" style="position: absolute; left: 0; top: 340px">'
                        f'{anim(d, TERRA, 2.5, dot=SURF, dot_r=4)}</svg>') + html[i1:]
    html = html.replace('a{color:#B04E25}a:hover{color:#8A3C1C}\n', 'a{color:#B04E25}a:hover{color:#8A3C1C}\n' + CSS + '\n', 1)
    return name, title, w, h, html


# ---------------------------------------------------------------- 6 · fotoğraf üstünde gerçek patika
def k6():
    name, title, w, h, html = C.k6()
    i0 = html.index('<svg width="360" height="460" viewBox="0 0 360 460"'); i1 = html.index('</svg>', i0) + 6
    pts = [(x + 120, y) for x, y in fit(HIKE, 120, 330, 0)]
    d = poly([(x, y + 140) for x, y in pts])
    html = html[:i0] + (f'<svg width="360" height="640" viewBox="0 0 360 640" role="img" aria-label="Fotoğrafın üzerinde Faralya – Kabak patikası" style="position: absolute; left: 0; top: 0">'
                        f'{anim(d, "#FFFFFF", 4.5, casing="rgba(14,21,18,0.55)", casing_w=10, dot="#16201B", dot_r=6)}</svg>') + html[i1:]
    html = html.replace('a{color:#B04E25}a:hover{color:#8A3C1C}\n', 'a{color:#B04E25}a:hover{color:#8A3C1C}\n' + CSS + '\n', 1)
    return name, title, w, h, html


# ---------------------------------------------------------------- 7 · birlikte, gerçek rota
def k7():
    name, title, w, h, html = C.k7()
    i0 = html.index('<svg width="480" height="200"'); i1 = html.index('</svg>', i0) + 6
    d = poly(fit(BIKE, 480, 200, 24))
    html = html[:i0] + (f'<svg width="480" height="200" viewBox="0 0 480 200" role="img" aria-label="Birlikte sürülen Kaş – Kalkan rotası" style="position: absolute; left: 0; top: 196px">'
                        f'{anim(d, "#FBF8F2", 5, dot=TERRA, dot_r=7)}</svg>') + html[i1:]
    html = html.replace('a{color:#B04E25}a:hover{color:#8A3C1C}\n', 'a{color:#B04E25}a:hover{color:#8A3C1C}\n' + CSS + '\n', 1)
    return name, title, w, h, html


# ---------------------------------------------------------------- 8 · poster, gerçek harita
def k8():
    name, title, w, h, html = C.k8()
    i0 = html.index('<svg width="393" height="240"'); i1 = html.index('</svg>', i0) + 6
    s = 393 / 1400
    inner = anim(BIKE_D, TERRA, 13, casing=SURF, casing_w=28, dot=SURF, dot_r=17)
    blok = harita(0, 0, 393, 240, 100, 273, s, 'saturate(0.8)', inner, 'Harita: Kaş’tan Kalkan’a sahil yolu ve rota', relative=True)
    blok = blok.replace('overflow: hidden">', f'overflow: hidden"><div style="position: absolute; right: 4px; bottom: 2px; z-index: 1; font-size: 5px; color: #4F5751; background: rgba(251,248,242,0.8); padding: 1px 3px">{ATTR}</div>', 1)
    html = html[:i0] + blok + html[i1:]
    html = html.replace('a{color:#B04E25}a:hover{color:#8A3C1C}\n', 'a{color:#B04E25}a:hover{color:#8A3C1C}\n' + CSS + '\n', 1)
    return name, title, w, h, html


# ---------------------------------------------------------------- 9 · hız, gerçek harita + çizilerek açılan renkler
def k9():
    w, h = 360, 640
    s = 360 / 1400
    n = len(BIKE)

    def elev(t):
        f = t * (len(ELEV_A) - 1); i = min(int(f), len(ELEV_A) - 2)
        return ELEV_A[i] + (ELEV_A[i + 1] - ELEV_A[i]) * (f - i)

    segs, fastest = [], (0, 0)
    for i in range(n - 1):
        slope = (elev((i + 1) / (n - 1)) - elev(i / (n - 1))) * 25
        v = max(6, min(48.2, 18 - slope * 3.2))
        if v > fastest[0]:
            fastest = (v, i)
        col = '#F6D9A8' if v < 13 else (ORANGE if v < 25 else '#FF5A3C')
        (x1, y1), (x2, y2) = BIKE[i], BIKE[i + 1]
        segs.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="22" stroke-linecap="round"/>')
    fx, fy = BIKE[fastest[1]]
    inner = (f'<defs><mask id="hizAc" maskUnits="userSpaceOnUse" x="0" y="0" width="{MAPW}" height="{MAPH}">'
             f'<path class="iz" pathLength="1" d="{BIKE_D}" fill="none" stroke="#fff" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/></mask></defs>'
             f'<path d="{BIKE_D}" fill="none" stroke="{NIGHT}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" mask="url(#hizAc)"/>'
             f'<g mask="url(#hizAc)">{"".join(segs)}</g>'
             f'<circle cx="{fx}" cy="{fy}" r="30" fill="none" stroke="#FFFFFF" stroke-width="6"/>'
             f'<line x1="{fx}" y1="{fy + 32}" x2="{fx}" y2="{fy + 190}" stroke="#FFFFFF" stroke-width="4"/>'
             f'<text x="{fx - 160}" y="{fy + 250}" font-family="Bricolage Grotesque, sans-serif" font-weight="700" font-size="56" fill="#FFFFFF">48,2 km/sa</text>')
    body = f'''
<div style="position: absolute; left: 24px; top: 92px; right: 24px; z-index: 1; display: flex; justify-content: space-between; align-items: center">
  <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: #A3ACA5">HIZ HARİTASI · KAŞ – KALKAN</div>{LOGO("#EDE7DB", 16)}
</div>
{harita(0, 120, 360, 300, 100, 117, s, GECE_FILTRE, inner, "Hıza göre renklendirilmiş rota, harita üzerinde; en hızlı bölüm işaretli")}
<div style="position: absolute; right: 10px; top: 408px; font-size: 6px; color: #8C968F">{ATTR}</div>
<div style="position: absolute; left: 24px; right: 24px; top: 432px; display: flex; gap: 16px; font-size: 12px; color: #EDE7DB">
  <span style="display: flex; align-items: center; gap: 6px"><span style="width: 18px; height: 6px; border-radius: 3px; background: #F6D9A8"></span>13’ün altı</span>
  <span style="display: flex; align-items: center; gap: 6px"><span style="width: 18px; height: 6px; border-radius: 3px; background: {ORANGE}"></span>13–25</span>
  <span style="display: flex; align-items: center; gap: 6px"><span style="width: 18px; height: 6px; border-radius: 3px; background: #FF5A3C"></span>25+ km/sa</span>
</div>
<div style="position: absolute; left: 24px; right: 24px; bottom: 90px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-top: 14px; border-top: 1px solid #2E3B35">
  {stat("Maks.", "48,2", "#FF8A6E", "#A3ACA5", 26)}{stat("Ort.", "16,7", "#EDE7DB", "#A3ACA5", 26)}{stat("Mesafe", "27,4", "#EDE7DB", "#A3ACA5", 26)}
</div>'''
    return 'Kart09-HizHaritasi.dc.html', '09 · Hız haritası — Hikâye 1080×1920', w, h, page('Hız haritası', w, h, body, NIGHT, CSS)


KARTLAR = [k1, k2, k3, k4, k5, k6, k7, k8, k9, C.k10]

if __name__ == '__main__':
    root = sys.argv[1]
    for i in [int(x) for x in sys.argv[2:]]:
        name, title, w, h, html = KARTLAR[i - 1]()
        open(f'{root}/project/{name}', 'w').write(html)
        print(name, len(html))
