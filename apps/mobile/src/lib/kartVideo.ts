/**
 * 3B paylaşım kartı videoları (sunucu: altyapi/kart-video). İş gönderilir, durumu birkaç saniyede bir sorulur,
 * hazır olunca MP4 telefonun önbelleğine indirilir; paylaşım ekranından çıkılmışsa yerel bildirim gelir.
 *
 * Takip uygulama açıkken sürer (iOS arka planda zamanlayıcıları durdurur; uygulama öne gelince kaldığı yerden devam eder).
 * Sunucu videoyu 60 dk tutar. Kapı uygulama anahtarı ister (EXPO_PUBLIC_ALTYAPI_ANAHTARI); yoksa özellik kapalıdır.
 */
import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { $t } from '@/i18n';

const VIDEO_URL = process.env.EXPO_PUBLIC_VIDEO_URL || 'https://video.ismailtopcam.dev';
const ANAHTAR = process.env.EXPO_PUBLIC_ALTYAPI_ANAHTARI;
const SORMA_ARALIGI = 3000;

/** Bu derlemede video özelliği kullanılabilir mi */
export const videoKullanilabilir = Platform.OS !== 'web' && !!ANAHTAR;

export type VideoTema = 'yorunge' | 'sehir-gece' | 'sehir-maket' | 'takip';
export type VideoBicim = 'hikaye' | 'gonderi';

export type VideoGovdesi = {
  tema: VideoTema;
  bicim: VideoBicim;
  rota: [number, number][];
  metin: {
    ust: string;
    baslik: string;
    kmSayi: number;
    kmBasamak: number;
    ondalik: ',' | '.';
    kmBirim: string;
    degerler: { etiket: string; deger: string }[];
    kaynak: string;
  };
};

export type VideoIsi = {
  anahtar: string;
  aktivite: string;
  baslik: string;
  durum: 'gonderiliyor' | 'sirada' | 'uretiliyor' | 'indiriliyor' | 'hazir' | 'hata';
  ilerleme: number;
  sira?: number;
  hata?: string;
  /** İndirilen MP4 (telefonun önbelleği) */
  dosya?: string;
};

const isler = new Map<string, VideoIsi>();
const dinleyiciler = new Set<() => void>();
/** Şu an paylaşım ekranında açık olan aktivite: oradaysa bildirim gönderilmez */
let acikAktivite: string | null = null;

const isAnahtari = (aktivite: string, tema: VideoTema, bicim: VideoBicim) => `${aktivite}:${tema}:${bicim}`;

function guncelle(anahtar: string, d: Partial<VideoIsi>) {
  const eski = isler.get(anahtar);
  if (!eski) return;
  isler.set(anahtar, { ...eski, ...d });
  dinleyiciler.forEach((f) => f());
}

function abone(f: () => void) {
  dinleyiciler.add(f);
  return () => dinleyiciler.delete(f);
}

/** Bir aktivite + tema + biçim için işin anlık durumu (yoksa null) */
export function useVideoIsi(aktivite: string, tema: VideoTema | null, bicim: VideoBicim): VideoIsi | null {
  return useSyncExternalStore(abone, () => (tema ? (isler.get(isAnahtari(aktivite, tema, bicim)) ?? null) : null));
}

/** İşin anlık durumu (bileşen dışından) */
export function videoIsiAl(aktivite: string, tema: VideoTema, bicim: VideoBicim): VideoIsi | null {
  return isler.get(isAnahtari(aktivite, tema, bicim)) ?? null;
}

/** Paylaşım ekranı açılınca / kapanınca çağırır (açıkken bildirim gönderilmez) */
export function videoEkrani(aktivite: string | null) {
  acikAktivite = aktivite;
}

const basliklar = () => ({ 'X-Lykiva-Anahtar': ANAHTAR ?? '' });

function hataMetni(kod: number) {
  if (kod === 429) return $t('paylasimTemalari.video_hata_sinir');
  if (kod === 503) return $t('paylasimTemalari.video_hata_dolu');
  return $t('paylasimTemalari.video_hata');
}

async function indir(anahtar: string, id: string) {
  guncelle(anahtar, { durum: 'indiriliyor', ilerleme: 1 });
  const r = await fetch(`${VIDEO_URL}/video/${id}/mp4`, { headers: basliklar() });
  if (!r.ok) throw new Error(hataMetni(r.status));
  const f = new File(Paths.cache, `lykiva-3b-${id}.mp4`);
  if (f.exists) f.delete();
  f.create();
  f.write(new Uint8Array(await r.arrayBuffer()));
  guncelle(anahtar, { durum: 'hazir', dosya: f.uri });
  const is = isler.get(anahtar);
  if (is && acikAktivite !== is.aktivite) {
    await Notifications.scheduleNotificationAsync({
      content: { title: $t('paylasimTemalari.video_bildirim_baslik'), body: $t('paylasimTemalari.video_bildirim_govde', { baslik: is.baslik }), data: { tur: 'kart_video', activity_id: is.aktivite } },
      trigger: null,
    }).catch(() => undefined);
  }
}

async function izle(anahtar: string, id: string) {
  const bas = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, SORMA_ARALIGI));
    // Sunucu videoyu 60 dk tutar; 45 dk'da bitmediyse (ya da ağ hiç gelmediyse) vazgeç
    if (Date.now() - bas > 45 * 60_000) throw new Error($t('paylasimTemalari.video_hata'));
    let d: { durum: string; ilerleme?: number; sira?: number; hata?: string };
    try {
      const r = await fetch(`${VIDEO_URL}/video/${id}`, { headers: basliklar() });
      if (r.status === 404) throw new Error($t('paylasimTemalari.video_hata'));
      if (!r.ok) continue; // geçici hata (ağ, 429): bir sonraki turda yeniden sor
      d = await r.json();
    } catch (e) {
      if (e instanceof TypeError) continue; // ağ yok
      throw e;
    }
    if (d.durum === 'hata') throw new Error($t('paylasimTemalari.video_hata'));
    if (d.durum === 'hazir') return indir(anahtar, id);
    guncelle(anahtar, { durum: d.durum === 'sirada' ? 'sirada' : 'uretiliyor', ilerleme: d.ilerleme ?? 0, sira: d.sira });
  }
}

/** Video işini başlatır (aynı aktivite + tema + biçim için süren ya da hazır iş varsa yenisini açmaz) */
export async function videoIste(aktivite: string, baslik: string, govde: VideoGovdesi): Promise<void> {
  const anahtar = isAnahtari(aktivite, govde.tema, govde.bicim);
  const var_ = isler.get(anahtar);
  if (var_ && var_.durum !== 'hata') return;
  isler.set(anahtar, { anahtar, aktivite, baslik, durum: 'gonderiliyor', ilerleme: 0 });
  dinleyiciler.forEach((f) => f());
  try {
    const r = await fetch(`${VIDEO_URL}/video`, { method: 'POST', headers: { ...basliklar(), 'content-type': 'application/json' }, body: JSON.stringify(govde) });
    if (r.status !== 202) throw new Error(hataMetni(r.status));
    const { id } = (await r.json()) as { id: string };
    guncelle(anahtar, { durum: 'sirada' });
    await izle(anahtar, id);
  } catch (e) {
    // Ağ hatası (TypeError: "Network request failed") kullanıcıya ham gösterilmez
    const metin = e instanceof Error && !(e instanceof TypeError) ? e.message : $t('paylasimTemalari.video_hata_ag');
    guncelle(anahtar, { durum: 'hata', hata: metin });
  }
}

export async function videoPaylas(is: VideoIsi) {
  if (!is.dosya) return;
  await Sharing.shareAsync(is.dosya, { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: $t('aktivite_paylas.karti_paylas') });
}
