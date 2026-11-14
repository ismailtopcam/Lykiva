"""10 paylaşım kartı tasarımı → project/Kart*.dc.html"""
import math
import sys
from geo import ROUTE_A, ROUTE_B, ELEV_A, path_d, sample, smooth_line, contours, page

D = "font-family: 'Bricolage Grotesque', system-ui, sans-serif"  # başlık yazısı
INK, CREAM, SURF, TERRA, SEA, NIGHT, LAND, WATER = '#16201B', '#F2EDE3', '#FBF8F2', '#B04E25', '#0B6A6A', '#0E1512', '#E8E0CF', '#CBE1DC'
ORANGE = '#E07A4A'

LOGO = lambda c, s=15: f'<span style="{D}; font-weight: 800; font-size: {s}px; letter-spacing: -0.02em; color: {c}">lykiva</span>'


def stat(label, value, fg, muted, vs=20, ls=11):
    return (f'<div><div style="font-size: {ls}px; color: {muted}; font-weight: 500">{label}</div>'
            f'<div style="{D}; font-weight: 700; font-size: {vs}px; color: {fg}; line-height: 1.15">{value}</div></div>')


# ---------------------------------------------------------------- 1
def k1():
    w, h = 360, 640
    cont = ''.join(f'<path d="{d}"/>' for d in contours(250, 130, 190, 120, 9, 0.11, seed=1) + contours(40, 330, 120, 90, 6, 0.15, seed=4))
    route = path_d(ROUTE_A, sx=1.05, sy=1.25, ox=8, oy=60)
    body = f'''
<svg width="360" height="420" viewBox="0 30 360 420" role="img" aria-label="Eş yükselti çizgileri üzerinde turuncu bisiklet rotası" style="position: absolute; left: 0; top: 0">
  <g fill="none" stroke="#2A3832" stroke-width="1">{cont}</g>
  <path d="{route}" fill="none" stroke="{NIGHT}" stroke-width="11" stroke-linecap="round"/>
  <path d="{route}" fill="none" stroke="{ORANGE}" stroke-width="5" stroke-linecap="round"/>
  <circle cx="{288*1.05+8:.1f}" cy="{54*1.25+60:.1f}" r="7" fill="{NIGHT}" stroke="{ORANGE}" stroke-width="3"/>
</svg>
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
    return 'Kart01-GeceTopografya.dc.html', '01 · Gece topoğrafya — Hikâye 1080×1920', w, h, page('Gece topoğrafya', w, h, body, NIGHT)


# ---------------------------------------------------------------- 2
def k2():
    w, h = 432, 540
    d_main, P = smooth_line(ELEV_A, 432, 300, top=40, lo=0, hi=260)
    back = [v * 0.75 + 30 for v in [30, 70, 60, 110, 150, 120, 170, 210, 160, 90, 50]]
    d_back, _ = smooth_line(back, 432, 300, top=40, lo=0, hi=260)
    peak = max(range(len(ELEV_A)), key=lambda i: ELEV_A[i])
    px, py = P[peak]
    body = f'''
<div style="position: absolute; left: 28px; top: 28px; right: 28px; display: flex; justify-content: space-between; align-items: flex-start">
  <div>
    <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: #4F5751">BİSİKLET · KAŞ – KALKAN</div>
    <div style="{D}; font-weight: 800; font-size: 64px; line-height: 1; letter-spacing: -0.04em; color: {INK}; margin-top: 10px">↑ 412 m</div>
    <div style="font-size: 14px; color: #4F5751; margin-top: 4px">27,4 km boyunca tırmanış</div>
  </div>
  {LOGO(INK, 16)}
</div>
<svg width="432" height="300" viewBox="0 0 432 300" role="img" aria-label="Yükseklik profili: en yüksek nokta 236 metre" style="position: absolute; left: 0; bottom: 92px">
  <path d="{d_back} L432 300 L0 300Z" fill="#E4D9C3"/>
  <path d="{d_main} L432 300 L0 300Z" fill="{TERRA}"/>
  <path d="{d_main}" fill="none" stroke="{INK}" stroke-width="2"/>
  <line x1="{px:.1f}" y1="{py-8:.1f}" x2="{px:.1f}" y2="{py-46:.1f}" stroke="{INK}" stroke-width="1.5"/>
  <circle cx="{px:.1f}" cy="{py:.1f}" r="5" fill="{CREAM}" stroke="{INK}" stroke-width="2"/>
  <text x="{px+8:.1f}" y="{py-36:.1f}" font-family="Bricolage Grotesque, sans-serif" font-weight="700" font-size="16" fill="{INK}">236 m</text>
  <text x="{px+8:.1f}" y="{py-20:.1f}" font-family="Inter, sans-serif" font-size="11" fill="#4F5751">en yüksek nokta</text>
</svg>
<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 92px; background: {INK}; display: grid; grid-template-columns: repeat(4, 1fr); align-items: center; padding: 0 28px; box-sizing: border-box; gap: 8px">
  {stat("Mesafe", "27,4 km", CREAM, "#A3ACA5", 18)}{stat("Süre", "1:38", CREAM, "#A3ACA5", 18)}{stat("İniş", "↓ 398 m", CREAM, "#A3ACA5", 18)}{stat("Ort.", "16,7", CREAM, "#A3ACA5", 18)}
</div>'''
    return 'Kart02-ZirveProfili.dc.html', '02 · Zirve profili — Gönderi 1080×1350', w, h, page('Zirve profili', w, h, body, CREAM)


# ---------------------------------------------------------------- 3
def k3():
    w, h = 480, 480
    route = path_d(ROUTE_A, sx=0.26, sy=0.3, ox=6, oy=2)
    body = f'''
<div style="position: absolute; left: 40px; top: 52px; width: 400px; height: 376px; background: {SURF}; border-radius: 6px; transform: rotate(-3deg); box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22); padding: 26px; box-sizing: border-box; display: grid; grid-template-columns: 1fr 1px 128px; gap: 20px">
  <div style="display: flex; flex-direction: column; justify-content: space-between">
    <div>
      <div style="{D}; font-weight: 800; font-size: 40px; line-height: 0.95; letter-spacing: -0.03em; color: {SEA}">Kaş’tan<br>selamlar</div>
      <p style="margin: 16px 0 0; font-size: 13px; line-height: 1.5; color: #2E3631; font-style: italic">27,4 km sahil yolu, 412 m tırmanış. Kaputaş üstündeki seyir noktasında mola şart.</p>
    </div>
    <div style="font-size: 12px; font-weight: 600; color: #4F5751">— Ege, Mert, Deniz ve Can</div>
  </div>
  <div style="background: #D3C9B7"></div>
  <div style="display: flex; flex-direction: column; gap: 14px">
    <div style="width: 96px; height: 116px; align-self: flex-end; background: {TERRA}; padding: 6px; box-sizing: border-box; outline: 3px dotted {SURF}; outline-offset: -3px; display: flex; flex-direction: column; justify-content: space-between">
      <svg width="84" height="62" viewBox="0 0 84 62" role="img" aria-label="Pul üzerinde rota"><path d="{route}" fill="none" stroke="{SURF}" stroke-width="3" stroke-linecap="round"/></svg>
      <div style="{D}; font-weight: 800; font-size: 20px; color: {SURF}; line-height: 1">27,4<span style="font-size: 11px"> KM</span></div>
    </div>
    <svg width="110" height="110" viewBox="0 0 110 110" role="img" aria-label="Posta damgası: Kaş, 7 Kasım 2026" style="align-self: flex-end; margin-top: -40px; margin-right: 34px">
      <circle cx="55" cy="55" r="44" fill="none" stroke="{SEA}" stroke-width="2" opacity="0.8"/>
      <circle cx="55" cy="55" r="34" fill="none" stroke="{SEA}" stroke-width="1" opacity="0.8"/>
      <text x="55" y="52" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="11" fill="{SEA}">KAŞ</text>
      <text x="55" y="66" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" fill="{SEA}">07.11.2026</text>
    </svg>
    <div style="margin-top: auto; display: flex; flex-direction: column; gap: 10px">
      <div style="border-bottom: 1px solid #C9BFAE; font-size: 12px; color: {INK}; padding-bottom: 4px">Bisiklet · 1:38</div>
      <div style="border-bottom: 1px solid #C9BFAE; font-size: 12px; color: {INK}; padding-bottom: 4px">Maks. 48,2 km/sa</div>
      <div style="display: flex; justify-content: flex-end">{LOGO(INK, 14)}</div>
    </div>
  </div>
</div>'''
    return 'Kart03-Kartpostal.dc.html', '03 · Kartpostal — Kare 1080×1080', w, h, page('Kartpostal', w, h, body, SEA)


# ---------------------------------------------------------------- 4
def k4():
    w, h = 360, 640
    bars = ''.join(
        f'<rect x="{i*8:.1f}" y="{56 - v:.1f}" width="5" height="{v:.1f}" rx="1" fill="{INK}"/>'
        for i, v in enumerate([max(4, (ELEV_A[int(j / 34 * 10)] * (1 - (j / 34 * 10) % 1) + ELEV_A[min(10, int(j / 34 * 10) + 1)] * ((j / 34 * 10) % 1)) / 236 * 52) for j in range(35)]))
    row = lambda a, b, c, d: (f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px">'
                              f'<div><div style="font-size: 10px; letter-spacing: 0.1em; color: #4F5751; font-weight: 600">{a}</div><div style="{D}; font-weight: 700; font-size: 20px; color: {INK}">{b}</div></div>'
                              f'<div><div style="font-size: 10px; letter-spacing: 0.1em; color: #4F5751; font-weight: 600">{c}</div><div style="{D}; font-weight: 700; font-size: 20px; color: {INK}">{d}</div></div></div>')
    body = f'''
<div style="position: absolute; left: 28px; right: 28px; top: 92px; bottom: 92px; background: {SURF}; border-radius: 22px; overflow: hidden; display: flex; flex-direction: column">
  <div style="background: {TERRA}; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center">
    {LOGO(SURF, 18)}<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: {SURF}">BİSİKLET KARTI</span>
  </div>
  <div style="padding: 16px 24px 0">
    <div style="display: flex; justify-content: space-between; align-items: flex-end">
      <div><div style="{D}; font-weight: 800; font-size: 44px; line-height: 1; color: {INK}">KAŞ</div><div style="font-size: 12px; color: #4F5751">Kalkış 08:12</div></div>
      <svg width="64" height="24" viewBox="0 0 64 24" aria-hidden="true" style="margin-bottom: 18px"><path d="M2 12h56M50 5l8 7-8 7" fill="none" stroke="{TERRA}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div style="text-align: right"><div style="{D}; font-weight: 800; font-size: 44px; line-height: 1; color: {INK}">KLK</div><div style="font-size: 12px; color: #4F5751">Varış 10:08</div></div>
    </div>
    {row("MESAFE", "27,4 km", "HAREKET", "1:38")}
    {row("TIRMANIŞ", "↑ 412 m", "MAKS. HIZ", "48,2")}
    {row("YOL", "Sahil yolu", "EKİP", "4 kişi")}
  </div>
  <div style="margin: 18px 0 0; position: relative; height: 0; border-top: 2px dashed #D3C9B7">
    <div style="position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; border-radius: 14px; background: {LAND}"></div>
    <div style="position: absolute; right: -14px; top: -14px; width: 28px; height: 28px; border-radius: 14px; background: {LAND}"></div>
  </div>
  <div style="padding: 14px 24px 18px; margin-top: auto">
    <div style="font-size: 10px; letter-spacing: 0.1em; color: #4F5751; font-weight: 600; margin-bottom: 8px">YÜKSEKLİK PROFİLİ · 7 KASIM 2026</div>
    <svg width="276" height="58" viewBox="0 0 276 58" role="img" aria-label="Barkod biçiminde yükseklik profili">{bars}</svg>
  </div>
</div>'''
    return 'Kart04-BinisKarti.dc.html', '04 · Biniş kartı — Hikâye 1080×1920', w, h, page('Biniş kartı', w, h, body, LAND)


# ---------------------------------------------------------------- 5
def k5():
    w, h = 432, 540
    route = path_d(ROUTE_A, sx=1.27, sy=0.5, ox=10, oy=-10)
    body = f'''
<div style="position: absolute; left: 32px; top: 30px; right: 32px; display: flex; justify-content: space-between">
  <div style="font-size: 13px; font-weight: 600; color: {INK}">Kaş – Kalkan<br><span style="font-weight: 400; color: #4F5751">Bisiklet · 7 Kasım</span></div>
  {LOGO(INK, 16)}
</div>
<div style="position: absolute; left: 22px; top: 120px; {D}; font-weight: 800; font-size: 188px; line-height: 0.85; letter-spacing: -0.07em; color: {INK}">27,4</div>
<div style="position: absolute; right: 34px; top: 292px; {D}; font-weight: 700; font-size: 30px; color: {TERRA}">km</div>
<svg width="432" height="90" viewBox="0 0 432 90" role="img" aria-label="Rota çizgisi" style="position: absolute; left: 0; top: 340px">
  <path d="{route}" fill="none" stroke="{TERRA}" stroke-width="2.5" stroke-linecap="round"/>
</svg>
<div style="position: absolute; left: 32px; right: 32px; bottom: 32px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; border-top: 1.5px solid {INK}; padding-top: 14px">
  {stat("Süre", "1:38", INK, "#4F5751", 17)}{stat("Tırmanış", "412 m", INK, "#4F5751", 17)}{stat("Maks.", "48,2", INK, "#4F5751", 17)}{stat("Ort.", "16,7", INK, "#4F5751", 17)}
</div>'''
    return 'Kart05-MinimalTipografi.dc.html', '05 · Minimal tipografi — Gönderi 1080×1350', w, h, page('Minimal tipografi', w, h, body, SURF)


# ---------------------------------------------------------------- 6
def k6():
    w, h = 360, 640
    route = path_d(ROUTE_B, sx=1.2, sy=1.05, ox=50, oy=130)
    body = f'''
<svg width="360" height="640" viewBox="0 0 360 640" role="img" aria-label="Fotoğraf yeri: kullanıcının kendi fotoğrafı buraya gelir" style="position: absolute; inset: 0">
  <defs><pattern id="tarali" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#5E6B62"/><line x1="0" y1="0" x2="0" y2="14" stroke="#6B786F" stroke-width="6"/></pattern></defs>
  <rect width="360" height="640" fill="url(#tarali)"/>
</svg>
<div style="position: absolute; left: 0; right: 0; top: 200px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: #DCE3DE">
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span style="font-size: 13px; font-weight: 600">Kendi fotoğrafın</span>
</div>
<svg width="360" height="460" viewBox="0 0 360 460" role="img" aria-label="Fotoğrafın üzerinde beyaz yürüyüş rotası" style="position: absolute; left: 0; top: 0">
  <path d="{route}" fill="none" stroke="rgba(14,21,18,0.55)" stroke-width="10" stroke-linecap="round"/>
  <path d="{route}" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round"/>
</svg>
<div style="position: absolute; left: 20px; top: 92px; height: 34px; padding: 0 14px; border-radius: 17px; background: rgba(14,21,18,0.78); display: flex; align-items: center; gap: 8px; color: #FFFFFF; font-size: 12px; font-weight: 600">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 20l6-11 4 6 3-4 5 9z"/></svg>Doğa yürüyüşü
</div>
<div style="position: absolute; left: 16px; right: 16px; bottom: 88px; border-radius: 20px; background: rgba(14,21,18,0.82); padding: 18px 20px; color: #FFFFFF">
  <div style="{D}; font-weight: 700; font-size: 22px">Faralya – Kabak</div>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px">
    {stat("Mesafe", "7,2 km", "#FFFFFF", "#C9D1CB")}{stat("Tırmanış", "380 m", "#FFFFFF", "#C9D1CB")}{stat("Süre", "2:40", "#FFFFFF", "#C9D1CB")}
  </div>
  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 12px; color: #C9D1CB">Likya Yolu · Fethiye{LOGO("#FFFFFF", 16)}</div>
</div>'''
    return 'Kart06-FotografUstu.dc.html', '06 · Fotoğrafın üstünde — Hikâye 1080×1920', w, h, page('Fotoğrafın üstünde', w, h, body, '#5E6B62')


# ---------------------------------------------------------------- 7
def k7():
    w, h = 480, 480
    route = path_d(ROUTE_A, sx=1.4, sy=0.9, ox=20, oy=150)
    av = [("ED", "#0B6A6A"), ("MK", "#16201B"), ("DE", "#E07A4A"), ("CA", "#E4D9C3")]
    avatars = ''.join(
        f'<div style="width: 64px; height: 64px; border-radius: 32px; background: {c}; border: 4px solid {TERRA}; margin-left: {0 if i == 0 else -16}px; display: flex; align-items: center; justify-content: center; {D}; font-weight: 700; font-size: 20px; color: {INK if c == "#E4D9C3" else "#FFFFFF"}">{t}</div>'
        for i, (t, c) in enumerate(av))
    body = f'''
<div style="position: absolute; left: 32px; top: 32px; right: 32px; display: flex; justify-content: space-between; align-items: center">
  <div style="display: flex">{avatars}</div>{LOGO("#FFFFFF", 18)}
</div>
<div style="position: absolute; left: 32px; top: 122px; {D}; font-weight: 800; font-size: 56px; line-height: 0.95; letter-spacing: -0.04em; color: #FFFFFF">4 kişi,<br>1 rota</div>
<svg width="480" height="200" viewBox="0 0 480 200" role="img" aria-label="Birlikte sürülen rota" style="position: absolute; left: 0; top: 180px">
  <path d="{route}" fill="none" stroke="#FBF8F2" stroke-width="5" stroke-linecap="round" opacity="0.95"/>
</svg>
<div style="position: absolute; left: 32px; right: 32px; bottom: 32px; color: #FFFFFF">
  <div style="font-size: 15px; font-weight: 600">Kaş – Kalkan sahil yolu</div>
  <div style="{D}; font-weight: 700; font-size: 24px; margin-top: 4px">27,4 km · 1:38 · ↑ 412 m</div>
  <div style="font-size: 13px; margin-top: 8px; color: #FBE3D6">Ege, @mert, @deniz ve @can ile · 7 Kasım</div>
</div>'''
    return 'Kart07-Birlikte.dc.html', '07 · Birlikte — Kare 1080×1080', w, h, page('Birlikte', w, h, body, TERRA)


# ---------------------------------------------------------------- 8
def k8():
    w, h = 432, 540
    cont = ''.join(f'<path d="{d}"/>' for d in contours(250, 70, 140, 70, 6, 0.14, seed=2) + contours(80, 110, 90, 50, 4, 0.2, seed=5))
    route = path_d(ROUTE_A, sx=1.18, sy=1.0, ox=14, oy=-6)
    body = f'''
<div style="position: absolute; inset: 18px; border: 1.5px solid {INK}; display: flex; flex-direction: column">
  <svg width="393" height="240" viewBox="0 0 393 240" role="img" aria-label="Harita: kıyı şeridi ve rota" style="display: block">
    <rect width="393" height="240" fill="{LAND}"/>
    <path d="M0 182 C 60 170, 100 196, 160 190 S 260 160, 300 172 S 360 196, 393 186 L393 240 L0 240Z" fill="{WATER}"/>
    <g fill="none" stroke="#D3C7B0" stroke-width="1">{cont}</g>
    <path d="{route}" fill="none" stroke="{SURF}" stroke-width="7" stroke-linecap="round"/>
    <path d="{route}" fill="none" stroke="{TERRA}" stroke-width="3.5" stroke-linecap="round"/>
  </svg>
  <div style="flex: 1; padding: 22px 24px; display: flex; flex-direction: column">
    <div style="{D}; font-weight: 800; font-size: 34px; letter-spacing: 0.06em; color: {INK}; text-align: center">KAŞ — KALKAN</div>
    <div style="font-size: 11px; letter-spacing: 0.08em; color: #4F5751; text-align: center; margin-top: 6px">36,20° K · 29,64° D  →  36,26° K · 29,42° D</div>
    <div style="height: 1px; background: {INK}; margin: 18px 40px"></div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); text-align: center">
      {stat("Mesafe", "27,4 km", INK, "#4F5751", 19)}{stat("Tırmanış", "412 m", INK, "#4F5751", 19)}{stat("Süre", "1:38", INK, "#4F5751", 19)}
    </div>
    <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 11px; letter-spacing: 0.1em; color: #4F5751">7 KASIM 2026 · BİSİKLET{LOGO(INK, 14)}</div>
  </div>
</div>'''
    return 'Kart08-HaritaPosteri.dc.html', '08 · Harita posteri — Gönderi 1080×1350', w, h, page('Harita posteri', w, h, body, SURF)


# ---------------------------------------------------------------- 9
def k9():
    w, h = 360, 640
    pts = sample(ROUTE_A, 20, sx=1.08, sy=1.25, ox=4, oy=0)
    n = len(pts)
    # Yüksekliği rota boyunca dağıt, eğimden hız tahmini (yokuş yukarı yavaş, iniş hızlı)
    def elev(t):
        f = t * (len(ELEV_A) - 1); i = min(int(f), len(ELEV_A) - 2)
        return ELEV_A[i] + (ELEV_A[i + 1] - ELEV_A[i]) * (f - i)
    segs, fastest = [], (0, 0)
    for i in range(n - 1):
        slope = elev((i + 1) / (n - 1)) - elev(i / (n - 1))
        v = max(6, min(48.2, 18 - slope * 3.2))
        if v > fastest[0]: fastest = (v, i)
        col = '#F6D9A8' if v < 13 else (ORANGE if v < 25 else '#FF5A3C')
        segs.append(f'<line x1="{pts[i][0]:.1f}" y1="{pts[i][1]:.1f}" x2="{pts[i+1][0]:.1f}" y2="{pts[i+1][1]:.1f}" stroke="{col}" stroke-width="6" stroke-linecap="round"/>')
    fx, fy = pts[fastest[1]]
    body = f'''
<div style="position: absolute; left: 24px; top: 92px; right: 24px; display: flex; justify-content: space-between; align-items: center">
  <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: #A3ACA5">HIZ HARİTASI · KAŞ – KALKAN</div>{LOGO("#EDE7DB", 16)}
</div>
<svg width="360" height="310" viewBox="0 0 360 310" role="img" aria-label="Hıza göre renklendirilmiş rota; en hızlı bölüm inişte" style="position: absolute; left: 0; top: 120px">
  {''.join(segs)}
  <circle cx="{fx:.1f}" cy="{fy:.1f}" r="9" fill="none" stroke="#FFFFFF" stroke-width="2"/>
  <line x1="{fx:.1f}" y1="{fy+10:.1f}" x2="{fx:.1f}" y2="{fy+48:.1f}" stroke="#FFFFFF" stroke-width="1.2"/>
  <text x="{fx-60:.1f}" y="{fy+64:.1f}" font-family="Bricolage Grotesque, sans-serif" font-weight="700" font-size="15" fill="#FFFFFF">48,2 km/sa</text>
</svg>
<div style="position: absolute; left: 24px; right: 24px; top: 432px; display: flex; gap: 16px; font-size: 12px; color: #EDE7DB">
  <span style="display: flex; align-items: center; gap: 6px"><span style="width: 18px; height: 6px; border-radius: 3px; background: #F6D9A8"></span>13’ün altı</span>
  <span style="display: flex; align-items: center; gap: 6px"><span style="width: 18px; height: 6px; border-radius: 3px; background: {ORANGE}"></span>13–25</span>
  <span style="display: flex; align-items: center; gap: 6px"><span style="width: 18px; height: 6px; border-radius: 3px; background: #FF5A3C"></span>25+ km/sa</span>
</div>
<div style="position: absolute; left: 24px; right: 24px; bottom: 90px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-top: 14px; border-top: 1px solid #2E3B35">
  {stat("Maks.", "48,2", "#FF8A6E", "#A3ACA5", 26)}{stat("Ort.", "16,7", "#EDE7DB", "#A3ACA5", 26)}{stat("Mesafe", "27,4", "#EDE7DB", "#A3ACA5", 26)}
</div>'''
    return 'Kart09-HizHaritasi.dc.html', '09 · Hız haritası — Hikâye 1080×1920', w, h, page('Hız haritası', w, h, body, NIGHT)


# ---------------------------------------------------------------- 10
def k10():
    w, h = 360, 640
    items = [
        ("08:12", "Başlangıç", "Kaş", None),
        ("09:02", "Kaputaş üstü seyir noktası", "8,4. km · 12:30 dk mola", "1"),
        ("09:48", "Yokuş başı çeşme", "18,1. km · 4:50 dk mola", "2"),
        ("10:08", "Varış", "Kalkan", None),
    ]
    rows = ''
    for i, (t, title, sub, num) in enumerate(items):
        dot = (f'<div style="width: 26px; height: 26px; border-radius: 13px; background: {INK}; color: {SURF}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700">{num}</div>' if num
               else f'<div style="width: 26px; height: 26px; display: flex; align-items: center; justify-content: center"><div style="width: 14px; height: 14px; border-radius: 7px; border: 3px solid {TERRA if i == 0 else INK}; background: {SURF}"></div></div>')
        rail = '' if i == len(items) - 1 else f'<div style="flex: 1; width: 2px; background: #D3C9B7; margin: 4px 0"></div>'
        rows += f'''
    <div style="display: grid; grid-template-columns: 46px 26px 1fr; gap: 12px; min-height: 66px">
      <div style="{D}; font-weight: 700; font-size: 15px; color: {INK}; padding-top: 4px">{t}</div>
      <div style="display: flex; flex-direction: column; align-items: center">{dot}{rail}</div>
      <div style="padding-top: 3px"><div style="font-size: 15px; font-weight: 600; color: {INK}">{title}</div><div style="font-size: 12px; color: #4F5751; margin-top: 2px">{sub}</div></div>
    </div>'''
    body = f'''
<div style="position: absolute; left: 28px; right: 28px; top: 92px">
  <div style="display: flex; justify-content: space-between; align-items: center"><span style="font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: #4F5751">GÜNÜN AKIŞI · 7 KASIM</span>{LOGO(INK, 16)}</div>
  <div style="{D}; font-weight: 800; font-size: 30px; line-height: 1; color: {INK}; margin-top: 10px">Kaş – Kalkan</div>
  <div style="font-size: 14px; color: #4F5751; margin-top: 6px">1:56 yolda · 1:38 hareket · 2 mola</div>
</div>
<div style="position: absolute; left: 28px; right: 28px; top: 196px">{rows}
</div>
<div style="position: absolute; left: 28px; right: 28px; bottom: 90px; background: {INK}; border-radius: 18px; padding: 16px 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px">
  {stat("Mesafe", "27,4 km", CREAM, "#A3ACA5", 18)}{stat("Tırmanış", "412 m", CREAM, "#A3ACA5", 18)}{stat("Maks.", "48,2", CREAM, "#A3ACA5", 18)}
</div>'''
    return 'Kart10-GununAkisi.dc.html', '10 · Günün akışı — Hikâye 1080×1920', w, h, page('Günün akışı', w, h, body, CREAM)


KARTLAR = [k1, k2, k3, k4, k5, k6, k7, k8, k9, k10]

if __name__ == '__main__':
    root = sys.argv[1]
    which = [int(x) for x in sys.argv[2:]] or list(range(1, 11))
    for i in which:
        name, title, w, h, html = KARTLAR[i - 1]()
        open(f'{root}/project/{name}', 'w').write(html)
        print(name, w, h)
