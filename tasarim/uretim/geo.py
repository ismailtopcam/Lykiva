"""Kartlar için ortak çizim yardımcıları (yalnızca SVG yolu üretir)."""
import math

# Örnek bisiklet rotası (sahil yolu, soldan sağa koylarla) — viewBox 0 0 300 200, açık kübik parçalar
ROUTE_A = [
    ((12,150),(40,140),(52,112),(78,116)),
    ((78,116),(104,120),(112,146),(136,128)),
    ((136,128),(160,110),(160,84),(186,92)),
    ((186,92),(212,100),(214,130),(238,112)),
    ((238,112),(262,94),(268,60),(288,54)),
]
# Örnek yürüyüş rotası (yukarıdan aşağı zikzak patika) — viewBox 0 0 200 300
ROUTE_B = [
    ((110,14),(96,40),(70,52),(84,78)),
    ((84,78),(98,104),(132,96),(118,128)),
    ((118,128),(104,160),(70,150),(80,182)),
    ((80,182),(90,214),(136,210),(124,240)),
    ((124,240),(112,270),(92,270),(100,290)),
]
# Kaş – Kalkan yükseklik profili (uygulamadaki örnek veri), m
ELEV_A = [4, 40, 95, 88, 120, 180, 236, 170, 110, 60, 22]

def path_d(route, sx=1, sy=1, ox=0, oy=0):
    f = lambda p: f"{p[0]*sx+ox:.1f} {p[1]*sy+oy:.1f}"
    d = "M" + f(route[0][0])
    for seg in route:
        d += f" C {f(seg[1])}, {f(seg[2])}, {f(seg[3])}"
    return d

def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])

def sample(route, n_per=24, sx=1, sy=1, ox=0, oy=0):
    pts = []
    for k, s in enumerate(route):
        for i in range(n_per + (1 if k == len(route) - 1 else 0)):
            x, y = bez(*s, i / n_per)
            pts.append((x*sx+ox, y*sy+oy))
    return pts

def smooth_line(vals, w, h, top=0, pad_b=0, lo=None, hi=None):
    """Değerleri w×h kutuya yerleştirip yumuşak (Catmull-Rom) yol döner; (d, noktalar)."""
    lo = min(vals) if lo is None else lo
    hi = max(vals) if hi is None else hi
    n = len(vals)
    P = [(i * w / (n - 1), top + (h - top - pad_b) * (1 - (v - lo) / (hi - lo or 1))) for i, v in enumerate(vals)]
    d = f"M{P[0][0]:.1f} {P[0][1]:.1f}"
    for i in range(n - 1):
        p0 = P[max(0, i - 1)]; p1 = P[i]; p2 = P[i + 1]; p3 = P[min(n - 1, i + 2)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C {c1[0]:.1f} {c1[1]:.1f}, {c2[0]:.1f} {c2[1]:.1f}, {p2[0]:.1f} {p2[1]:.1f}"
    return d, P

def contours(cx, cy, rx, ry, n, step, wob=0.08, seed=0):
    """İç içe, hafif dalgalı eş yükselti eğrileri (dekor)."""
    out = []
    for k in range(n):
        f = 1 - k * step
        if f <= 0.05: break
        pts = []
        for i in range(36):
            a = i / 36 * 2 * math.pi
            r = 1 + wob * math.sin(3 * a + seed + k * 0.7) + wob * 0.6 * math.cos(5 * a + seed * 2)
            pts.append((cx + rx * f * r * math.cos(a), cy + ry * f * r * math.sin(a)))
        d = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"
        for i in range(36):
            p0 = pts[(i - 1) % 36]; p1 = pts[i]; p2 = pts[(i + 1) % 36]; p3 = pts[(i + 2) % 36]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            d += f" C {c1[0]:.1f} {c1[1]:.1f}, {c2[0]:.1f} {c2[1]:.1f}, {p2[0]:.1f} {p2[1]:.1f}"
        out.append(d + "Z")
    return out

FONTS = '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&amp;family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&amp;display=swap" rel="stylesheet">'

def page(title, w, h, body, bg, css=''):
    """w×h tasarım ölçüsü; dosya Instagram ölçüsünde (genişlik 1080 px) çizilir, içerik ölçeklenir."""
    k = 1080 / w
    W, H = 1080, round(h * k)
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>
body{{margin:0}}
a{{color:#B04E25}}a:hover{{color:#8A3C1C}}
{css}
</style>
</helmet>
<div style="width: {W}px; height: {H}px; position: relative; overflow: hidden; background: {bg}; font-family: Inter, system-ui, sans-serif">
<div style="position: absolute; left: 0; top: 0; width: {w}px; height: {h}px; transform: scale({k:g}); transform-origin: 0 0">
{body}
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{W},"height":{H}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
"""
