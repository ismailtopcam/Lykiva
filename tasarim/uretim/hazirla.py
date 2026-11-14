"""Yükseklik haritalarını temizler, binaları dokuya işler. Çıktılar: *-doku.jpg, *-yk.png"""
import numpy as np
from PIL import Image
from scipy import ndimage as nd


def deniz_maskesi(harita, renk, tol, min_alan):
    a = np.asarray(harita.convert('RGB')).astype(int)
    m = np.all(np.abs(a - np.array(renk)) <= tol, axis=2)
    m = nd.binary_opening(m, iterations=1)
    lab, n = nd.label(m)
    alan = nd.sum(m, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = alan >= min_alan
    m = keep[lab]
    m = nd.binary_closing(m, iterations=3)
    return nd.binary_fill_holes(m) & m | m


def sehir(ad, maxH, deniz_renk, tol, ton, kirp=None):
    harita = Image.open(f'{ad}-harita.jpg').convert('RGB')
    yk = Image.open(f'{ad}-yukseklik.png' if ad == 'izmir' else f'{ad}-yukseklik-ham.png').convert('L')
    if kirp:  # (x0, y0, x1, y1) harita pikseli
        harita = harita.crop(kirp)
        yk = yk.crop(tuple(v // 2 for v in kirp))
    g = np.asarray(yk).astype(float) / 255 * maxH          # metre
    g = nd.median_filter(g, 3)
    GW, GH = yk.size
    # deniz
    if deniz_renk:
        dm_full = deniz_maskesi(harita, deniz_renk, tol, 4000)
        dm = np.asarray(Image.fromarray(dm_full.astype(np.uint8) * 255).resize((GW, GH), Image.BILINEAR)) > 127
    else:
        dm_full = np.zeros((harita.size[1], harita.size[0]), bool)
        dm = np.zeros((GH, GW), bool)
    # zemin = binalar silinmiş, yumuşatılmış arazi
    zemin = nd.grey_opening(g, size=(11, 11))
    zemin = nd.gaussian_filter(zemin, 3)
    bina = np.clip(g - zemin, 0, 120)
    kiyi = nd.binary_dilation(dm, iterations=3)
    maske = (bina > 3) & ~kiyi
    maske = nd.binary_opening(maske, iterations=1)
    zemin = np.where(kiyi, np.minimum(zemin, nd.grey_erosion(zemin, size=(7, 7))), zemin)
    zemin = np.where(dm, 0, np.maximum(zemin, 0.5))
    # kıyıyı yumuşat (denize doğru iner)
    yumus = nd.gaussian_filter(zemin, 1.5)
    zemin = np.where(dm, 0, yumus)
    son = zemin + np.where(maske, bina, 0)
    son = np.clip(son, 0, maxH)
    Image.fromarray((son / maxH * 255).round().astype(np.uint8)).save(f'{ad}-yk.png', optimize=True)

    # bina tonunu dokuya işle
    doku = np.asarray(harita).astype(float)
    if ton:
        mb = np.asarray(Image.fromarray(maske.astype(np.uint8) * 255).resize(harita.size, Image.NEAREST)) > 127
        hb = np.asarray(Image.fromarray(np.where(maske, bina, 0).astype(np.float32)).resize(harita.size, Image.NEAREST))
        renk, guc, isik = ton
        k = np.clip(guc + isik * (hb / 30), 0, 1)[..., None] * mb[..., None]
        doku = doku * (1 - k) + np.array(renk, float) * k
    Image.fromarray(doku.clip(0, 255).astype(np.uint8)).save(f'{ad}-doku.jpg', quality=86, optimize=True)
    print(ad, 'yk', (GW, GH), 'harita', harita.size, 'bina pikseli %', round(maske.mean() * 100, 1),
          'deniz %', round(dm.mean() * 100, 1), 'max m', round(son.max(), 1))


def dag(ad, maxH, deniz_renk, tol):
    harita = Image.open(f'{ad}-harita.jpg').convert('RGB')
    yk = Image.open(f'{ad}-yukseklik-ham.png').convert('L')
    g = np.asarray(yk).astype(float) / 255 * maxH
    med = nd.median_filter(g, 9)
    g = np.where(g < med - 40, med, g)  # Terrarium boşluklarını doldur
    g = nd.median_filter(g, 3)
    GW, GH = yk.size
    dm_full = deniz_maskesi(harita, deniz_renk, tol, 20000)
    dm = np.asarray(Image.fromarray(dm_full.astype(np.uint8) * 255).resize((GW, GH), Image.BILINEAR)) > 127
    g = np.where(dm, 0, g)
    g = nd.gaussian_filter(g, 0.8)
    g = np.where(dm, 0, g)
    Image.fromarray((g / maxH * 255).round().clip(0, 255).astype(np.uint8)).save(f'{ad}-yk.png', optimize=True)
    harita.save(f'{ad}-doku.jpg', quality=86, optimize=True)
    iy, ix = np.unravel_index(np.argmax(g), g.shape)
    print(ad, 'max m', round(g.max()), 'zirve (harita px)', ix * 2, iy * 2, 'deniz %', round(dm.mean() * 100, 1))


if __name__ == '__main__':
    import sys
    hangi = sys.argv[1:]
    if 'izmir' in hangi:
        sehir('izmir', 200, (35, 34, 39), 10, ((150, 160, 172), 0.4, 0.3))
    if 'istanbul' in hangi:
        sehir('istanbul', 120, (208, 207, 212), 5, ((252, 250, 246), 0.85, 0.15))
    if 'faralya' in hangi:
        dag('faralya', 2000, (163, 221, 232), 14)
    if 'antalya' in hangi:
        sehir('antalya', 150, None, 0, None, kirp=(200, 100, 1400, 1300))
