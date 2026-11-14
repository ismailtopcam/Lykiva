/**
 * Paylaşım kartları için harita zemini: OpenFreeMap vektör karoları (uygulamanın haritasıyla aynı kaynak,
 * OpenMapTiles şeması) indirilir, su / yeşil alan / akarsu / yollar kartın içinde SVG olarak çizilir.
 * Raster karo ya da MapLibre anlık görüntüsü yerine bu yol seçildi: görsel yakalamada (view-shot) sorunsuz,
 * temaya göre renklendirilebilir, OpenTopoMap / Esri lisans koşulları yok. Kaynak gösterimi zorunlu (ODbL):
 * "© OpenStreetMap katkıcıları · OpenMapTiles".
 *
 * Karolar bellekte tutulur: şerit, önizleme ve yakalanan görsel aynı karoları bir kez indirir.
 * İnternet yoksa zemin boş kalır, kart yine çizilir.
 */
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { useEffect, useMemo, useState } from 'react';
import { G, Path } from 'react-native-svg';

import type { Cerceve, Kutu } from './ortak';

const TILEJSON = 'https://tiles.openfreemap.org/planet';
const EN_BUYUK_Z = 14;
const EN_FAZLA_KARO = 12;

type Tur = 'yesil' | 'su' | 'akarsu' | 'yolKucuk' | 'yolOrta' | 'yolAna' | 'otoyol';
type Ozellik = { tur: Tur; poligon: boolean; halkalar: number[][] };
type KaroVerisi = { z: number; x: number; y: number; extent: number; ozellikler: Ozellik[] };

export type HaritaPaleti = Record<Tur, string>;

/** Gece teması (01, 09): koyu zeminde çok hafif seçilen yollar ve su */
/** Açık tema (08 Harita posteri): krem kara, yeşil alanlar, açık mavi su, turuncu ana yollar */
export const ACIK_HARITA: HaritaPaleti = {
  yesil: '#DCE5C8',
  su: '#B7D9E2',
  akarsu: '#9CCAD6',
  yolKucuk: '#DDD5C4',
  yolOrta: '#CDC3AF',
  yolAna: '#BCAF97',
  otoyol: '#E0A27A',
};

export const GECE_HARITA: HaritaPaleti = {
  yesil: '#19261F',
  su: '#070C0D',
  akarsu: '#0B1316',
  yolKucuk: '#34413A',
  yolOrta: '#43514A',
  yolAna: '#56655D',
  otoyol: '#66766D',
};

const KALINLIK: Record<Tur, number> = { yesil: 0, su: 0, akarsu: 0.9, yolKucuk: 0.55, yolOrta: 0.85, yolAna: 1.3, otoyol: 1.8 };
const CIZIM_SIRASI: Tur[] = ['yesil', 'su', 'akarsu', 'yolKucuk', 'yolOrta', 'yolAna', 'otoyol'];

const YOL_SINIFI: Record<string, Tur> = {
  motorway: 'otoyol',
  trunk: 'otoyol',
  primary: 'yolAna',
  secondary: 'yolAna',
  tertiary: 'yolOrta',
  minor: 'yolOrta',
  service: 'yolKucuk',
  track: 'yolKucuk',
  path: 'yolKucuk',
};
const YESIL_SINIF = new Set(['wood', 'forest', 'grass', 'wetland', 'scrub', 'park']);

/* ------------------------------------------------------------------ */
/* İndirme ve bellek                                                   */
/* ------------------------------------------------------------------ */

let karoAdresi: Promise<string> | null = null;
function adresSablonu(): Promise<string> {
  karoAdresi ??= fetch(TILEJSON)
    .then((r) => r.json() as Promise<{ tiles: string[] }>)
    .then((j) => j.tiles[0])
    .catch((e: unknown) => {
      karoAdresi = null;
      throw e;
    });
  return karoAdresi;
}

const hazir = new Map<string, KaroVerisi | null>();
const suren = new Map<string, Promise<KaroVerisi | null>>();

function coz(z: number, x: number, y: number, buf: ArrayBuffer): KaroVerisi {
  const t = new VectorTile(new PbfReader(buf));
  const ozellikler: Ozellik[] = [];
  let extent = 4096;
  const al = (katman: string, tur: (sinif: string) => Tur | null) => {
    const L = t.layers[katman];
    if (!L) return;
    extent = L.extent;
    for (let i = 0; i < L.length; i++) {
      const f = L.feature(i);
      if (f.type !== 2 && f.type !== 3) continue;
      const tr = tur(String(f.properties.class ?? ''));
      if (!tr) continue;
      if (f.properties.brunnel === 'tunnel') continue;
      ozellikler.push({ tur: tr, poligon: f.type === 3, halkalar: f.loadGeometry().map((r) => r.flatMap((p) => [p.x, p.y])) });
    }
  };
  al('landcover', (s) => (YESIL_SINIF.has(s) ? 'yesil' : null));
  al('park', () => 'yesil');
  al('water', () => 'su');
  al('waterway', () => 'akarsu');
  al('transportation', (s) => YOL_SINIFI[s] ?? null);
  return { z, x, y, extent, ozellikler };
}

function karoGetir(z: number, x: number, y: number): Promise<KaroVerisi | null> {
  const k = `${z}/${x}/${y}`;
  if (hazir.has(k)) return Promise.resolve(hazir.get(k) ?? null);
  let p = suren.get(k);
  if (!p) {
    p = adresSablonu()
      .then((sablon) => fetch(sablon.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))))
      .then(async (r) => {
        // Boş karo (açık deniz) 204 / 404 dönebilir
        const veri = r.ok && r.status !== 204 ? coz(z, x, y, await r.arrayBuffer()) : null;
        hazir.set(k, veri);
        return veri;
      })
      .catch(() => null)
      .finally(() => suren.delete(k));
    suren.set(k, p);
  }
  return p;
}

/** Yakalamadan önce: inen karolar bitsin (en fazla `ms`) */
export async function haritaZeminiHazir(ms = 6000): Promise<void> {
  if (!suren.size) return;
  await Promise.race([Promise.allSettled([...suren.values()]), new Promise((r) => setTimeout(r, ms))]);
}

/** Alanı kaplayan karolar; karo sayısı sınırı aşarsa daha uzak yakınlaştırma */
function karoListesi(c: Cerceve, alan: Kutu): { z: number; liste: [number, number][] } {
  const [wx0, wx1] = [(alan.x - c.ox) / c.s, (alan.x + alan.w - c.ox) / c.s];
  const [wy0, wy1] = [(alan.y - c.oy) / c.s, (alan.y + alan.h - c.oy) / c.s];
  // Bir karo kartta ~300 px olsun (görsel 3 kat büyük yakalanır; vektör olduğu için keskin kalır)
  let z = Math.max(0, Math.min(EN_BUYUK_Z, Math.round(Math.log2((c.s * 256) / 300))));
  for (;;) {
    const n = 2 ** z;
    const [tx0, tx1] = [Math.floor((wx0 * n) / 256), Math.floor((wx1 * n) / 256)];
    const [ty0, ty1] = [Math.max(0, Math.floor((wy0 * n) / 256)), Math.min(n - 1, Math.floor((wy1 * n) / 256))];
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= EN_FAZLA_KARO || z === 0) {
      const liste: [number, number][] = [];
      for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) liste.push([((x % n) + n) % n, y]);
      return { z, liste };
    }
    z--;
  }
}

/* ------------------------------------------------------------------ */
/* Çizim                                                               */
/* ------------------------------------------------------------------ */

function yollar(karolar: KaroVerisi[], c: Cerceve, alan: Kutu): Record<Tur, string> {
  const out = Object.fromEntries(CIZIM_SIRASI.map((t) => [t, ''])) as Record<Tur, string>;
  const parca: Record<Tur, string[]> = Object.fromEntries(CIZIM_SIRASI.map((t) => [t, [] as string[]])) as Record<Tur, string[]>;
  const [x0, x1, y0, y1] = [alan.x - 20, alan.x + alan.w + 20, alan.y - 20, alan.y + alan.h + 20];
  for (const k of karolar) {
    const n = 2 ** k.z;
    const olcek = ((256 / n) * c.s) / k.extent;
    const bx = c.ox + ((k.x * 256) / n) * c.s;
    const by = c.oy + ((k.y * 256) / n) * c.s;
    for (const o of k.ozellikler) {
      const esik = o.poligon ? 1.2 : 0.6;
      for (const h of o.halkalar) {
        let d = '';
        let [sx, sy] = [NaN, NaN];
        let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
        let sayi = 0;
        for (let i = 0; i < h.length; i += 2) {
          const x = bx + h[i] * olcek;
          const y = by + h[i + 1] * olcek;
          // Yakın noktaları atla (çizgide 0,6 px, alanda 1,2 px): yol metni kısalır, görünüm değişmez
          if (sayi > 0 && Math.abs(x - sx) < esik && Math.abs(y - sy) < esik && i < h.length - 2) continue;
          d += `${sayi === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
          [sx, sy] = [x, y];
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          sayi++;
        }
        if (sayi < 2 || maxX < x0 || minX > x1 || maxY < y0 || minY > y1) continue;
        if (o.poligon && maxX - minX < 1 && maxY - minY < 1) continue;
        parca[o.tur].push(o.poligon ? `${d}Z` : d);
      }
    }
  }
  for (const t of CIZIM_SIRASI) out[t] = parca[t].join('');
  return out;
}

/**
 * Bir `<Svg>` içine konur; koordinatlar o Svg'nin kart pikseli. `cerceve` izNoktalari'nın döndürdüğü dönüşüm.
 */
export function HaritaZemini({ alan, cerceve, palet }: { alan: Kutu; cerceve: Cerceve | null; palet: HaritaPaleti }) {
  const plan = useMemo(() => (cerceve ? karoListesi(cerceve, alan) : null), [cerceve?.s, cerceve?.ox, cerceve?.oy, alan.x, alan.y, alan.w, alan.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const anahtar = plan ? `${plan.z}:${plan.liste.join(';')}` : '';
  const [yuklenen, setYuklenen] = useState<{ anahtar: string; karolar: KaroVerisi[] } | null>(null);
  // İnene kadar bellekteki karolar kullanılır (yakalanan görünüm sonradan açılsa da zemini hemen hazır gelir)
  const karolar =
    yuklenen?.anahtar === anahtar ? yuklenen.karolar : plan ? plan.liste.map(([x, y]) => hazir.get(`${plan.z}/${x}/${y}`)).filter((k): k is KaroVerisi => !!k) : [];

  useEffect(() => {
    if (!plan) return;
    let acik = true;
    Promise.all(plan.liste.map(([x, y]) => karoGetir(plan.z, x, y))).then((l) => {
      if (acik) setYuklenen({ anahtar, karolar: l.filter((k): k is KaroVerisi => !!k) });
    });
    return () => {
      acik = false;
    };
  }, [anahtar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Yol metinleri pahalı: yalnızca karo kümesi ya da çerçeve değişince yeniden kur
  const surum = `${anahtar}|${karolar.length}|${yuklenen?.anahtar === anahtar ? 1 : 0}`;
  const d = useMemo(() => (cerceve && karolar.length ? yollar(karolar, cerceve, alan) : null), [surum, cerceve?.s, cerceve?.ox, cerceve?.oy]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  return (
    <G>
      {CIZIM_SIRASI.map((t) =>
        d[t] ? (
          KALINLIK[t] === 0 ? (
            <Path key={t} d={d[t]} fill={palet[t]} />
          ) : (
            <Path key={t} d={d[t]} fill="none" stroke={palet[t]} strokeWidth={KALINLIK[t]} strokeLinecap="round" strokeLinejoin="round" />
          )
        ) : null,
      )}
    </G>
  );
}
