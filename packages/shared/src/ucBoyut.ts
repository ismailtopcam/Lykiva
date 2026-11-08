/**
 * İnişli çıkışlı (3B) görünüm için hesaplar: GPS izini yerel metre düzlemine çevirir,
 * döndürür, eğer, yüksekliği abartır ve ekrana sığdırır. Saf fonksiyonlar; testleri ucBoyut.test.ts.
 *
 * Paralel (ortografik) izdüşüm: uzaktaki kısım küçülmez, ölçek her yerde aynıdır; böylece
 * yüksekliği abartma katsayısı doğrudan okunabilir.
 */
import { haversine } from './track';

/** [boylam, enlem, yükseklik | null] */
export type IzKoordinati = [number, number, number | null];

export type Iz3B = {
  /** Doğu (m), merkeze göre */
  x: number[];
  /** Kuzey (m), merkeze göre */
  y: number[];
  /** Yükseklik (m); eksikler komşulardan doldurulmuş, hiç yoksa 0 */
  z: number[];
  /** Başlangıçtan mesafe (m) */
  d: number[];
  toplamM: number;
  minZ: number;
  maxZ: number;
  /** İzde gerçek yükseklik verisi var mı */
  yukseklikVar: boolean;
};

/** Eksik (null) değerleri komşular arasında doğrusal doldurur; uçlarda en yakın değeri kullanır */
export function eksikleriDoldur(v: (number | null)[]): number[] | null {
  const bilinen = v.map((x, i) => (x != null && Number.isFinite(x) ? i : -1)).filter((i) => i >= 0);
  if (!bilinen.length) return null;
  const out = new Array<number>(v.length);
  let k = 0;
  for (let i = 0; i < v.length; i++) {
    while (k < bilinen.length - 1 && bilinen[k + 1] <= i) k++;
    const a = bilinen[k];
    if (i <= bilinen[0]) out[i] = v[bilinen[0]] as number;
    else if (i >= bilinen[bilinen.length - 1]) out[i] = v[bilinen[bilinen.length - 1]] as number;
    else {
      const b = bilinen[k + 1];
      const va = v[a] as number;
      const vb = v[b] as number;
      out[i] = i === a ? va : va + ((vb - va) * (i - a)) / (b - a);
    }
  }
  return out;
}

/** İzi 3B görünüme hazırlar; çok noktalı izleri en fazla `enFazla` noktaya seyreltir */
export function izHazirla(koordinatlar: IzKoordinati[], enFazla = 600): Iz3B | null {
  const k = koordinatlar.filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (k.length < 2) return null;
  const adim = Math.max(1, Math.ceil(k.length / enFazla));
  const s: IzKoordinati[] = [];
  for (let i = 0; i < k.length; i += adim) s.push(k[i]);
  if (s[s.length - 1] !== k[k.length - 1]) s.push(k[k.length - 1]);

  const lat0 = s.reduce((t, c) => t + c[1], 0) / s.length;
  const lng0 = s.reduce((t, c) => t + c[0], 0) / s.length;
  const mY = 111195; // 1° enlem ≈ m
  const mX = mY * Math.cos((lat0 * Math.PI) / 180);
  const x = s.map((c) => (c[0] - lng0) * mX);
  const y = s.map((c) => (c[1] - lat0) * mY);
  const dolu = eksikleriDoldur(s.map((c) => c[2]));
  const z = dolu ?? s.map(() => 0);
  const d = [0];
  for (let i = 1; i < s.length; i++) d[i] = d[i - 1] + haversine({ lng: s[i - 1][0], lat: s[i - 1][1] }, { lng: s[i][0], lat: s[i][1] });
  return {
    x,
    y,
    z,
    d,
    toplamM: d[d.length - 1],
    minZ: Math.min(...z),
    maxZ: Math.max(...z),
    yukseklikVar: dolu != null,
  };
}

export type Kamera = {
  /** Döndürme (derece, saat yönünde; 0 = kuzey yukarıda/uzakta) */
  yon: number;
  /** Bakış açısı (derece): 90 = tepeden, 0 = yandan */
  egim: number;
  /** Yükseklik abartısı (1 = gerçek ölçek) */
  abarti: number;
};

export type Izdusum = {
  /** İz noktalarının ekran koordinatları */
  iz: [number, number][];
  /** İzin zemindeki gölgesi (en alçak noktanın seviyesinde) */
  zemin: [number, number][];
  /** Herhangi bir (x, y, z) noktasını ekrana çevirir */
  P: (x: number, y: number, z: number) => [number, number];
};

/**
 * Ekrana izdüşüm. Yükseklikler en alçak noktaya göre alınır; sonuç `genislik × yukseklik` kutusuna
 * `bosluk` kenar payıyla, oran bozulmadan ortalanarak sığdırılır.
 */
export function izdusur(iz: Iz3B, kamera: Kamera, genislik: number, yukseklik: number, bosluk = 24): Izdusum {
  const a = (kamera.yon * Math.PI) / 180;
  const t = (Math.max(0, Math.min(90, kamera.egim)) * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const st = Math.sin(t);
  const ct = Math.cos(t);
  const ham = (x: number, y: number, z: number): [number, number] => {
    const xr = x * ca - y * sa;
    const yr = x * sa + y * ca;
    return [xr, -yr * st - (z - iz.minZ) * kamera.abarti * ct];
  };
  const izHam = iz.x.map((_, i) => ham(iz.x[i], iz.y[i], iz.z[i]));
  const zeminHam = iz.x.map((_, i) => ham(iz.x[i], iz.y[i], iz.minZ));
  const hepsi = [...izHam, ...zeminHam];
  const xs = hepsi.map((p) => p[0]);
  const ys = hepsi.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const olcek = Math.min((genislik - bosluk * 2) / (maxX - minX || 1), (yukseklik - bosluk * 2) / (maxY - minY || 1));
  const ox = (genislik - (maxX - minX) * olcek) / 2;
  const oy = (yukseklik - (maxY - minY) * olcek) / 2;
  const ekran = (p: [number, number]): [number, number] => [ox + (p[0] - minX) * olcek, oy + (p[1] - minY) * olcek];
  return { iz: izHam.map(ekran), zemin: zeminHam.map(ekran), P: (x, y, z) => ekran(ham(x, y, z)) };
}

/** Mesafeye göre doğrusal ara değer (d artan sırada) */
export function mesafedeDeger(d: number[], v: number[], hedef: number): number {
  if (!d.length) return 0;
  if (hedef <= d[0]) return v[0];
  if (hedef >= d[d.length - 1]) return v[v.length - 1];
  let lo = 0;
  let hi = d.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (d[m] <= hedef) lo = m;
    else hi = m;
  }
  const f = (hedef - d[lo]) / (d[hi] - d[lo] || 1);
  return v[lo] + (v[hi] - v[lo]) * f;
}

/** Bir noktadaki eğim (%): ± yarım pencere boyunca yükseklik farkı / yatay mesafe */
export function egimYuzde(iz: Iz3B, hedefM: number, pencereM = 100): number {
  const a = Math.max(0, hedefM - pencereM / 2);
  const b = Math.min(iz.toplamM, hedefM + pencereM / 2);
  if (b - a < 1) return 0;
  return ((mesafedeDeger(iz.d, iz.z, b) - mesafedeDeger(iz.d, iz.z, a)) / (b - a)) * 100;
}

export type EgimSinifi = 'cikis' | 'inis' | 'duz';

/** Her parça için eğim sınıfı (renklendirme): ±3 %'ten dik parçalar çıkış / iniş */
export function parcaEgimleri(iz: Iz3B, esikYuzde = 3, pencereM = 60): EgimSinifi[] {
  const out: EgimSinifi[] = [];
  for (let i = 1; i < iz.d.length; i++) {
    const g = egimYuzde(iz, (iz.d[i - 1] + iz.d[i]) / 2, pencereM);
    out.push(g > esikYuzde ? 'cikis' : g < -esikYuzde ? 'inis' : 'duz');
  }
  return out;
}
