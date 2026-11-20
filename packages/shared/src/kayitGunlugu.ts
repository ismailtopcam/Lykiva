/**
 * Kayıt günlüğü: kayıt sürerken GPS noktaları telefona her seferinde bütün kayıt yeniden yazılmadan, dosyanın sonuna
 * satır eklenerek saklanır. Uzun sürüşte yazma maliyeti sabit kalır (yalnızca yeni noktalar) ve tek büyük değer
 * okuma / yazma sınırlarına takılmaz.
 *
 * Dosya: ilk satır `{"c": clientId}`, sonrakiler `{"p": parça, "k": kalan, "n": [nokta…]}` — "p. parçanın ilk k noktası
 * kalır, ardından n eklenir". Otomatik duraklatma parçanın sonunu kırpabildiği için yalnızca ekleme yetmez; `k` bunu
 * karşılar ve satırı tekrar uygulamak zararsızdır. Yarım yazılmış son satır okunurken atlanır.
 */
import type { TrackPoint } from './track';

/** Dosyadaki nokta: [t, lat, lng, alt, acc, speed] — yer kazanmak için dizi */
type GunlukNoktasi = [number, number, number, number | null, number | null, number | null];

type GunlukSatiri = { p: number; k: number; n: GunlukNoktasi[] };

/** Diske yazılmış durumun özeti: parça başına nokta sayısı ve son noktanın zamanı */
export type GunlukOzeti = { adet: number; sonT: number | null }[];

const yuvarla = (x: number | null | undefined, kat: number) => (x == null || !Number.isFinite(x) ? null : Math.round(x * kat) / kat);

function noktayaDizi(p: TrackPoint): GunlukNoktasi {
  // 1e-7 derece ≈ 1 cm
  return [p.t, Math.round(p.lat * 1e7) / 1e7, Math.round(p.lng * 1e7) / 1e7, yuvarla(p.alt, 10), yuvarla(p.acc, 10), yuvarla(p.speed, 100)];
}

function diziyeNokta(d: GunlukNoktasi): TrackPoint {
  return { t: d[0], lat: d[1], lng: d[2], alt: d[3], acc: d[4], speed: d[5] };
}

/** Parçaların özeti (diske yazıldıktan / diskten okunduktan sonra) */
export function gunlukOzeti(segments: TrackPoint[][]): GunlukOzeti {
  return segments.map((s) => ({ adet: s.length, sonT: s.length ? s[s.length - 1].t : null }));
}

/** Yeni günlük dosyasının başlığı */
export function gunlukBasligi(clientId: string): string {
  return JSON.stringify({ c: clientId }) + '\n';
}

/**
 * Diskteki özetten bu yana değişenleri satırlar olarak verir (yoksa boş metin).
 * Parça sayısı azaldıysa (olmaması gerekir) null: dosya baştan yazılmalı.
 */
export function gunlukFarki(ozet: GunlukOzeti, segments: TrackPoint[][]): string | null {
  if (segments.length < ozet.length) return null;
  let metin = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const eski = ozet[i];
    const sonT = seg.length ? seg[seg.length - 1].t : null;
    if (eski && eski.adet === seg.length && eski.sonT === sonT) continue;
    let k = 0;
    if (eski && eski.adet > 0) {
      // Çoğu zaman yalnızca sona eklenmiştir: eski son nokta yerinde
      if (seg.length >= eski.adet && seg[eski.adet - 1].t === eski.sonT) k = eski.adet;
      else while (k < seg.length && k < eski.adet && eski.sonT != null && seg[k].t <= eski.sonT) k++;
    }
    const satir: GunlukSatiri = { p: i, k, n: seg.slice(k).map(noktayaDizi) };
    metin += JSON.stringify(satir) + '\n';
  }
  return metin;
}

/** Dosyanın tamamı (başlık + bütün parçalar) */
export function gunlukTamami(clientId: string, segments: TrackPoint[][]): string {
  return gunlukBasligi(clientId) + (gunlukFarki([], segments) ?? '');
}

/** Günlüğü okur. Başka kayda aitse ya da başlık yoksa null */
export function gunluguOku(metin: string, clientId: string): TrackPoint[][] | null {
  const satirlar = metin.split('\n');
  let baslik: { c?: string } | null = null;
  try {
    baslik = JSON.parse(satirlar[0]) as { c?: string };
  } catch {
    return null;
  }
  if (baslik?.c !== clientId) return null;
  const segments: TrackPoint[][] = [];
  for (let i = 1; i < satirlar.length; i++) {
    if (!satirlar[i]) continue;
    let s: GunlukSatiri;
    try {
      s = JSON.parse(satirlar[i]) as GunlukSatiri;
    } catch {
      continue; // yarım yazılmış satır (uygulama yazarken kapandı)
    }
    if (!Number.isInteger(s.p) || s.p < 0 || !Array.isArray(s.n)) continue;
    while (segments.length <= s.p) segments.push([]);
    const seg = segments[s.p];
    // Yerinde kırpma: uzun günlükte her satırda kopyalamamak için
    if (seg.length > s.k) seg.length = Math.max(0, s.k);
    for (const d of s.n) seg.push(diziyeNokta(d));
  }
  return segments;
}
