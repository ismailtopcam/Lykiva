/**
 * 3B video temaları (tasarım 11–17) ve sunucuya giden gövde. Video sunucuda üretilir (altyapi/kart-video);
 * şeritteki küçük resim o şablonun kendi sunucu çıktısından bir karedir (örnek rota).
 */
import { kmUnit } from '@lykiva/shared';
import type { ImageSourcePropType } from 'react-native';

import sehirGeceResmi from '@/assets/paylasim/video-sehir-gece.jpg';
import sehirMaketResmi from '@/assets/paylasim/video-sehir-maket.jpg';
import takipResmi from '@/assets/paylasim/video-takip.jpg';
import yorungeResmi from '@/assets/paylasim/video-yorunge.jpg';
import type { Activity, LngLat } from '@/data/ornek';
import { $t, yerel } from '@/i18n';
import type { VideoBicim, VideoGovdesi, VideoTema } from '@/lib/kartVideo';
import { buyuk, degerler, gun, noktaHizlari, tur } from './ortak';

/** Şehir şablonları kısa rotalar için: uzun rotada kamera uzaklaşınca binalar çizilmez */
const SEHIR_EN_FAZLA_KM = 20;

const kmSayisi = (a: Activity) => sayiyaCevir(a.distanceKm);
const kisaRota = (a: Activity) => kmSayisi(a) <= SEHIR_EN_FAZLA_KM;

/** `oran`: örnek resmin genişlik / yüksekliği (hikâye 9:16, gönderi 4:5) */
export type VideoTemasi = { id: VideoTema; ad: () => string; bicimler: VideoBicim[]; resim: ImageSourcePropType; oran: number; uygun: (a: Activity) => boolean };

export const VIDEO_TEMALARI: VideoTemasi[] = [
  { id: 'yorunge', ad: () => $t('paylasimTemalari.video_yorunge'), bicimler: ['hikaye', 'gonderi'], resim: yorungeResmi, oran: 9 / 16, uygun: () => true },
  { id: 'takip', ad: () => $t('paylasimTemalari.video_takip'), bicimler: ['gonderi', 'hikaye'], resim: takipResmi, oran: 4 / 5, uygun: () => true },
  { id: 'sehir-gece', ad: () => $t('paylasimTemalari.video_sehir_gece'), bicimler: ['hikaye', 'gonderi'], resim: sehirGeceResmi, oran: 9 / 16, uygun: kisaRota },
  { id: 'sehir-maket', ad: () => $t('paylasimTemalari.video_sehir_maket'), bicimler: ['gonderi', 'hikaye'], resim: sehirMaketResmi, oran: 4 / 5, uygun: kisaRota },
];

/** Dilin ondalık ayırıcısı */
function ondalikAyirici(): ',' | '.' {
  return (1.5).toLocaleString(yerel()).includes(',') ? ',' : '.';
}

/** "1.234,5" / "1,234.5" → 1234.5 (o anki dilin biçimiyle yazılmış sayı) */
export function sayiyaCevir(s: string): number {
  const ond = ondalikAyirici();
  const temiz = s.replace(new RegExp(`[^0-9${ond === ',' ? ',' : '.'}]`, 'g'), '').replace(',', '.');
  const n = Number(temiz);
  return Number.isFinite(n) ? n : 0;
}

/** En fazla n noktaya seyreltmek için alınacak sıralar (sunucu 5000'e kadar kabul eder; gövde küçük kalsın) */
function seyrekSiralar(uzunluk: number, n: number): number[] {
  if (uzunluk <= n) return Array.from({ length: uzunluk }, (_, i) => i);
  const adim = (uzunluk - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(i * adim));
}

/**
 * Sunucuya giden gövde: iz (gizlilik ayarına göre uçları kırpılmış), her noktadaki hız ve kullanıcının dilindeki metinler.
 * Hız, animasyonun rotada kullanıcının hızıyla ilerlemesi için; sahibi hızı gizlediyse gönderilmez (video düz hızla akar).
 */
export function videoGovdesi(a: Activity, route: LngLat[], tema: VideoTema, bicim: VideoBicim): VideoGovdesi {
  const ond = ondalikAyirici();
  const kesir = a.distanceKm.split(ond)[1]?.length ?? 0;
  const siralar = seyrekSiralar(route.length, 2000);
  const hizlar = a.hizGizli ? null : noktaHizlari(a, route);
  const hiz = hizlar && hizlar.some((v) => v > 0) ? siralar.map((i) => Math.round(Math.min(400, Math.max(0, hizlar[i] || 0)) * 10) / 10) : undefined;
  return {
    tema,
    bicim,
    rota: siralar.map((i) => [Math.round(route[i][0] * 1e6) / 1e6, Math.round(route[i][1] * 1e6) / 1e6]),
    hiz,
    metin: {
      ust: buyuk(`${tur(a)} · ${gun(a)}`).slice(0, 60),
      baslik: a.title.slice(0, 80),
      kmSayi: kmSayisi(a),
      kmBasamak: Math.min(2, kesir),
      ondalik: ond,
      kmBirim: kmUnit(),
      degerler: degerler(a, ['sure', 'tirmanis', 'maks', 'ort'], 3).map((d) => ({ etiket: d.etiket.slice(0, 24), deger: d.deger.slice(0, 24) })),
      kaynak: $t('paylasimTemalari.video_kaynak'),
    },
  };
}
