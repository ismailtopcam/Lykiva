"""2B → 3B harita kartları (three.js). Kart11: hikâye 1080×1920, Kart12: gönderi 1080×1350."""
import json
import os
import sys

from cards import D, CREAM, NIGHT, ORANGE, LOGO, stat, INK, SURF, TERRA
from geo import FONTS

HERE = os.path.dirname(os.path.abspath(__file__))
THREE = '/_blob/b84b88b435c18dd928175efaa8ebd3fe'
HARITA = '/_blob/00e1e5e3e96a7e55d41d0457f37b0581'
YUKSEKLIK = '/_blob/6f2c2676839d33a5a6742f7d6994d830'
ATTR = 'Harita © OpenTopoMap (CC-BY-SA) · veri © OpenStreetMap katkıcıları · yükseklik: Mapzen Terrarium (SRTM)'

BIKE = [list(map(int, x.split(','))) for x in open(os.path.join(HERE, 'veri', 'bike_px.txt')).read().strip().split(';')]

from sehir3d import LOGIC  # ortak 3B mantığı (rota çizgisi, yükseklik, görünürlük)

EK = {"mw": 1590, "mh": 1390, "gx": 398, "gy": 348, "maxH": 1700, "mpp": 15.4, "isik": [1.1, 1.6], "gunes": [-900, 700, 1200],
      "aci": [57, -12, 20, 26], "tup": [11, 6.5, 9], "abarti": 1.6, "mod": "tur"}



def sayfa(title, W, H, k, konfig, overlay, bg):
    w, h = round(W / k), round(H / k)
    logic = LOGIC.replace('KONFIG', json.dumps(konfig, separators=(',', ':')))
    props = json.dumps({"abarti": {"editor": "range", "min": 1, "max": 3, "step": 0.1, "default": 1.6, "unit": "×"},
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
<canvas ref="{{{{ tuval }}}}" width="{W}" height="{H}" role="img" aria-label="Kaş – Kalkan rotası: önce düz haritada çizilir, sonra harita eğilip dağlar üç boyutlu yükselir" style="position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; display: block"></canvas>
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


def k11():
    W, H, k = 1080, 1920, 3
    konfig = {"w": W, "h": H, "harita": HARITA, "yukseklik": YUKSEKLIK, "rota": BIKE, "hedef": [800, 700],
              "uzaklik": 3900, "yaklas": 0.06, "zemin": "#0E1512", "cizgi": ORANGE, "kenar": "#FBF8F2", **EK, "sis": [3900 * 1.15, 3900 * 2.8]}
    overlay = f'''
<div style="position: absolute; left: 24px; right: 24px; top: 92px; display: flex; justify-content: space-between; align-items: center">
  <div style="height: 30px; padding: 0 12px; border-radius: 15px; background: rgba(14,21,18,0.8); display: flex; align-items: center; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: {CREAM}">BİSİKLET · 7 KASIM</div>
  <div style="height: 30px; padding: 0 12px; border-radius: 15px; background: rgba(14,21,18,0.8); display: flex; align-items: center">{LOGO(CREAM, 15)}</div>
</div>
<div style="position: absolute; left: 16px; right: 16px; bottom: 88px; border-radius: 20px; background: rgba(14,21,18,0.86); padding: 18px 20px; color: {CREAM}">
  <div style="{D}; font-weight: 700; font-size: 22px">Kaş – Kalkan</div>
  <div style="{D}; font-weight: 800; font-size: 52px; line-height: 1; letter-spacing: -0.04em; margin-top: 2px">27,4<span style="font-size: 20px; letter-spacing: 0; color: {ORANGE}"> km</span></div>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px">
    {stat("Süre", "1:38", CREAM, "#A3ACA5")}{stat("Tırmanış", "412 m", CREAM, "#A3ACA5")}{stat("Maks.", "48,2", CREAM, "#A3ACA5")}
  </div>
  <div style="font-size: 6px; color: #8C968F; margin-top: 10px">{ATTR}</div>
</div>'''
    return 'Kart11-UcBoyutHikaye.dc.html', '11 · 2B → 3B harita — Hikâye 1080×1920', W, H, sayfa('2B 3B harita hikâye', W, H, k, konfig, overlay, NIGHT)


def k12():
    W, H, k = 1080, 1350, 2.5
    konfig = {"w": W, "h": H, "harita": HARITA, "yukseklik": YUKSEKLIK, "rota": BIKE, "hedef": [800, 700],
              "uzaklik": 2950, "yaklas": 0.12, "zemin": "#F2EDE3", "cizgi": TERRA, "kenar": "#FBF8F2", **EK, "sis": [2950 * 1.15, 2950 * 2.8], "deniz": "#A3DDE8"}
    overlay = f'''
<div style="position: absolute; left: 28px; right: 28px; top: 26px; display: flex; justify-content: space-between; align-items: flex-start">
  <div style="padding: 10px 14px; border-radius: 14px; background: rgba(251,248,242,0.92)">
    <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.12em; color: #4F5751">BİSİKLET · 7 KASIM</div>
    <div style="{D}; font-weight: 800; font-size: 26px; color: {INK}; margin-top: 2px">Kaş – Kalkan</div>
  </div>
  <div style="padding: 8px 12px; border-radius: 14px; background: rgba(251,248,242,0.92)">{LOGO(INK, 15)}</div>
</div>
<div style="position: absolute; left: 28px; right: 28px; bottom: 26px; border-radius: 18px; background: {INK}; padding: 14px 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px">
  {stat("Mesafe", "27,4 km", CREAM, "#A3ACA5", 17)}{stat("Süre", "1:38", CREAM, "#A3ACA5", 17)}{stat("Tırmanış", "412 m", CREAM, "#A3ACA5", 17)}{stat("Maks.", "48,2", CREAM, "#A3ACA5", 17)}
</div>
<div style="position: absolute; right: 30px; bottom: 98px; font-size: 5px; color: #4F5751; background: rgba(251,248,242,0.85); padding: 1px 4px">{ATTR}</div>'''
    return 'Kart12-UcBoyutGonderi.dc.html', '12 · 2B → 3B harita — Gönderi 1080×1350', W, H, sayfa('2B 3B harita gönderi', W, H, k, konfig, overlay, '#F2EDE3')


KARTLAR = [k11, k12]

if __name__ == '__main__':
    root = sys.argv[1]
    for f in KARTLAR:
        name, title, W, H, html = f()
        open(f'{root}/project/{name}', 'w').write(html)
        print(name, len(html))
