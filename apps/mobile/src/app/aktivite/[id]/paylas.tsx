import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type HostInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { IlerlemeCubugu } from '@/components/IlerlemeCubugu';
import { HikayeGorseli, KART_SABLONLARI, PaylasimKarti, uclariKirp, type KartIstatistigi } from '@/components/PaylasimKarti';
import { haritaZeminiHazir } from '@/components/paylasim/haritaZemini';
import { BICIM_OLCU, Olcekli } from '@/components/paylasim/ortak';
import { PAYLASIM_TEMALARI, TemaGorseli, type TemaKimligi } from '@/components/paylasim/temalar';
import { VIDEO_TEMALARI, videoGovdesi } from '@/components/paylasim/videoTemalari';
import { Txt } from '@/components/Txt';
import { Button, Chip, Label, ToggleRow } from '@/components/ui';
import { aktiviteAyarla, aktiviteNoktalari, useAktivite } from '@/data/aktivite';
import type { Activity } from '@/data/ornek';
import { baglantiAc, baglantiAdresi, baglantiDurumu, baglantiKapat, baglantiPaylas } from '@/lib/baglanti';
import { fotoSec, type Kaynak } from '@/lib/foto';
import { dosyaAdi, gpxPaylas } from '@/lib/gpx';
import { useVideoIsi, videoEkrani, videoIsiAl, videoIste, videoKullanilabilir, videoPaylas, type VideoBicim, type VideoTema } from '@/lib/kartVideo';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

const statDefs = (): [KartIstatistigi, string][] => [
  ['mesafe', $t('ortak.mesafe')],
  ['sure', $t('ortak.sure')],
  ['tirmanis', $t('ortak.tirmanis')],
  ['maks', $t('ortak.maks_hiz')],
  ['ort', $t('ortak.ort_hiz')],
  ['mola', $t('aktivite_paylas.molalar')],
  ['hava', $t('ortak.hava')],
  ['kisiler', $t('aktivite_paylas.birlikte_yaptiklarim')],
];

/** Tema şeridindeki küçük önizlemelerin yüksekliği (pt) */
const KUCUK_YUKSEKLIK = 112;

const GORUNURLUK = (): { id: NonNullable<Activity['visibility']>; label: string }[] => [
  { id: 'private', label: $t('ortak.sadece_ben') },
  { id: 'followers', label: $t('ortak.takipciler') },
  { id: 'groups', label: $t('ortak.gruplarim') },
  { id: 'public', label: $t('ortak.herkese_acik') },
];

type Hedef = { id: 'hikaye' | 'kart' | 'akis' | 'baglanti' | 'gpx'; label: string; icon: IconName; bg: string; fg: string };

const targets = (): Hedef[] => [
  { id: 'hikaye', label: $t('aktivite_paylas.hikaye'), icon: 'image', bg: colors.ink, fg: colors.ground },
  { id: 'kart', label: $t('aktivite_paylas.kart_gorseli'), icon: 'share', bg: colors.sea, fg: '#FFFFFF' },
  { id: 'akis', label: $t('aktivite_paylas.lykiva_akisi'), icon: 'home', bg: colors.terra, fg: '#FFFFFF' },
  { id: 'baglanti', label: $t('aktivite_paylas.baglanti'), icon: 'link', bg: colors.sand, fg: colors.ink },
  { id: 'gpx', label: 'GPX', icon: 'download', bg: colors.sand, fg: colors.ink },
];

export default function PaylasimStudyosuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { a, hata } = useAktivite(id);
  const insets = useSafeAreaInsets();
  const [look, setLook] = useState(0);
  // Tasarım temaları (tasarim/ kartları); 'klasik' = renk şablonlu eski kart; 3B video temaları sunucuda üretilir
  const [tema, setTema] = useState<TemaKimligi | VideoTema | 'klasik'>('klasik');
  const videoTemaId = VIDEO_TEMALARI.some((t) => t.id === tema) ? (tema as VideoTema) : null;
  const [videoBicimSecim, setVideoBicim] = useState<VideoBicim | null>(null);
  const videoBicimleri = VIDEO_TEMALARI.find((t) => t.id === videoTemaId)?.bicimler ?? ['hikaye'];
  const videoBicim: VideoBicim = videoBicimSecim && videoBicimleri.includes(videoBicimSecim) ? videoBicimSecim : videoBicimleri[0];
  const videoIs = useVideoIsi(id ?? '', videoTemaId, videoBicim);
  // "Fotoğrafın üstünde" teması için seçilen fotoğraf: yalnızca telefonda, sunucuya gitmez
  const [foto, setFoto] = useState<string | null>(null);
  const { width: ekranGenisligi } = useWindowDimensions();
  const [hideYerel, setHide] = useState<boolean | null>(null);
  const [gorunurlukYerel, setGorunurluk] = useState<Activity['visibility'] | null>(null);
  const [on, setOn] = useState<Partial<Record<KartIstatistigi, boolean>>>({ mesafe: true, sure: true, tirmanis: true, maks: true, kisiler: true });
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<Hedef['id'] | null>(null);
  const buyukKart = useRef<HostInstance>(null);
  const hikaye = useRef<HostInstance>(null);
  const temaKart = useRef<HostInstance>(null);
  const temaHikaye = useRef<HostInstance>(null);
  // Web paylaşım bağlantısı: undefined = bilinmiyor, null = kapalı, metin = açık (anahtar)
  const [baglanti, setBaglanti] = useState<string | null | undefined>(undefined);
  const sunucuId = a?.mine && supabaseHazir ? a.id : null;
  const kirpik = hideYerel ?? a?.hideEndpoints ?? true;
  const iz = useMemo(() => (!a ? [] : kirpik ? uclariKirp(a.route) : a.route), [a, kirpik]);

  // Bu ekran açıkken video hazır olunca bildirim gönderilmez (ekranda zaten görünür)
  useEffect(() => {
    videoEkrani(id ?? null);
    return () => videoEkrani(null);
  }, [id]);

  useEffect(() => {
    if (!sunucuId) return;
    let acik = true;
    baglantiDurumu(sunucuId)
      .then((k) => acik && setBaglanti(k))
      .catch(() => undefined);
    return () => {
      acik = false;
    };
  }, [sunucuId]);

  if (!a) {
    return (
      <View style={styles.root}>
        <Header title={$t('ortak.paylas')} center />
        <View style={{ padding: space.lg, alignItems: 'center' }}>{hata ? <Txt variant="muted">{hata}</Txt> : <ActivityIndicator color={colors.terra} />}</View>
      </View>
    );
  }

  // Kullanıcı değiştirmediyse aktivitedeki ayar geçerli
  const hide = hideYerel ?? a.hideEndpoints ?? true;
  const gorunurluk = gorunurlukYerel ?? a.visibility ?? 'followers';
  const sunucuda = !!a.mine;

  const temalar = PAYLASIM_TEMALARI.filter((t) => t.uygun(a));
  const secili = temalar.find((t) => t.id === tema) ?? null;
  const temaOzellik = { a, route: iz, uclariGizle: hide, foto };
  const videolar = videoKullanilabilir && a.route.length > 1 ? VIDEO_TEMALARI.filter((t) => t.uygun(a)) : [];
  const seciliVideo = videolar.find((t) => t.id === tema) ?? null;
  const seciliId = secili?.id ?? seciliVideo?.id ?? 'klasik';

  function videoBaslat(bicim: VideoBicim) {
    if (!seciliVideo) return;
    setMesaj(null);
    void videoIste(a!.id, a!.title, videoGovdesi(a!, iz, seciliVideo.id, bicim));
  }

  async function gorselUret(tur: 'kart' | 'hikaye'): Promise<string> {
    // Görseller içeriğin arkasında (pencere içinde) çizili; büyük boyutta yakalanır.
    // Pencere dışındaki görünümler iOS'ta boş yakalanabildiği için ekran dışına itilmedi.
    const { captureRef } = await import('react-native-view-shot');
    // RN 0.88'de View bir ana bileşen örneği döndürür; view-shot türleri henüz bunu tanımıyor
    type YakalamaHedefi = Parameters<typeof captureRef>[0];
    const ad = `${dosyaAdi(a!.title)}-${secili?.id ?? 'klasik'}-${tur}`;
    if (secili) {
      // Harita zemini olan temalarda karolar insin, çizim bitsin (en fazla birkaç saniye; inmezse zeminsiz çıkar)
      await haritaZeminiHazir();
      await new Promise((r) => setTimeout(r, 150));
      // Tema kendi biçiminde (hikâye / gönderi / kare); hikâye istenirse gönderi ve kare kartlar 9:16 zemine oturur
      const o = BICIM_OLCU[secili.bicim];
      const hikayeMi = tur === 'hikaye' || secili.bicim === 'hikaye';
      const hedef = (hikayeMi && secili.bicim !== 'hikaye' ? temaHikaye : temaKart) as unknown as YakalamaHedefi;
      const boyut = hikayeMi ? { width: 1080, height: 1920 } : { width: 1080, height: Math.round((1080 * o.h) / o.w) };
      return captureRef(hedef, { format: 'png', quality: 1, ...boyut, result: 'tmpfile', fileName: ad });
    }
    const hedef = (tur === 'hikaye' ? hikaye : buyukKart) as unknown as YakalamaHedefi;
    const boyut = tur === 'hikaye' ? { width: 1080, height: 1920 } : { width: 1080, height: 1653 };
    return captureRef(hedef, { format: 'png', quality: 1, ...boyut, result: 'tmpfile', fileName: ad });
  }

  async function fotoAl(kaynak: Kaynak): Promise<string | null> {
    setMesaj(null);
    try {
      const uri = await fotoSec(kaynak);
      if (uri) setFoto(uri);
      return uri;
    } catch (e) {
      setMesaj(e instanceof Error ? e.message : $t('aktivite_paylas.paylasilamadi'));
      return null;
    }
  }

  function temaSec(id: TemaKimligi | VideoTema | 'klasik') {
    setTema(id);
    // Fotoğraf teması ilk seçildiğinde galeriyi aç
    if (id === 'foto' && !foto && Platform.OS !== 'web') void fotoAl('galeri');
  }

  async function hedefSec(h: Hedef) {
    setMesaj(null);
    setMesgul(h.id);
    try {
      if ((h.id === 'hikaye' || h.id === 'kart') && seciliVideo) {
        // 3B video: hazırsa paylaş, değilse o biçimde üretimi başlat
        const b: VideoBicim = h.id === 'hikaye' && seciliVideo.bicimler.includes('hikaye') ? 'hikaye' : seciliVideo.bicimler[0];
        setVideoBicim(b);
        const is = videoIsiAl(a!.id, seciliVideo.id, b);
        if (is?.durum === 'hazir') await videoPaylas(is);
        else if (!is || is.durum === 'hata') videoBaslat(b);
      } else if (h.id === 'hikaye' || h.id === 'kart') {
        if (Platform.OS === 'web') throw new Error($t('aktivite_paylas.gorsel_paylasimi_telefonda_calisir'));
        if (!(await Sharing.isAvailableAsync())) throw new Error($t('aktivite_paylas.bu_cihazda_paylasim_menusu'));
        if (secili?.id === 'foto' && !foto) {
          if (!(await fotoAl('galeri'))) return;
          // Seçilen fotoğrafın görünüme yüklenmesi için kısa bekleme
          await new Promise((r) => setTimeout(r, 400));
        }
        const uri = await gorselUret(h.id);
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: $t('aktivite_paylas.karti_paylas') });
      } else if (h.id === 'gpx') {
        await gpxPaylas(a!.title, a!.type, await aktiviteNoktalari(a!.id));
      } else if (h.id === 'akis') {
        if (!sunucuda) throw new Error(a!.id.startsWith('yerel-') ? $t('aktivite_paylas.kayit_henuz_sunucuya_gitmedi_2') : $t('aktivite_paylas.yalnizca_kendi_aktiviteni_akista'));
        const v = gorunurluk === 'private' ? 'followers' : gorunurluk;
        await aktiviteAyarla(a!.id, { visibility: v, hide_endpoints: hide });
        setGorunurluk(v);
        setMesaj(v === 'public' ? $t('aktivite_paylas.akista_herkese_acik_paylasildi') : $t('aktivite_paylas.takipcilerinin_akisinda_paylasildi'));
      } else if (h.id === 'baglanti') {
        if (!sunucuda) throw new Error(a!.id.startsWith('yerel-') ? $t('aktivite_paylas.kayit_henuz_sunucuya_gitmedi') : $t('aktivite_paylas.yalnizca_kendi_aktivitenin_baglantisini'));
        const anahtar = baglanti ?? (await baglantiAc(a!.id));
        setBaglanti(anahtar);
        const adres = baglantiAdresi(anahtar);
        if (Platform.OS === 'web') setMesaj(adres);
        else await baglantiPaylas(a!.title, adres);
      }
    } catch (e) {
      setMesaj(e instanceof Error ? e.message : $t('aktivite_paylas.paylasilamadi'));
    } finally {
      setMesgul(null);
    }
  }

  async function gorunurlukSec(v: NonNullable<Activity['visibility']>) {
    setGorunurluk(v);
    if (!sunucuda) return;
    try {
      await aktiviteAyarla(a!.id, { visibility: v });
      setMesaj(v === 'private' ? $t('aktivite_paylas.artik_yalnizca_sen_goruyorsun') : v === 'public' ? $t('ortak.herkese_acik') : v === 'groups' ? $t('aktivite_paylas.gruplarindaki_kisiler_gorebilir') : $t('aktivite_paylas.takipcilerin_gorebilir'));
    } catch (e) {
      setMesaj(e instanceof Error ? e.message : $t('ortak.kaydedilemedi'));
    }
  }

  async function baglantiSec(v: boolean) {
    setMesaj(null);
    try {
      if (v) {
        setBaglanti(await baglantiAc(a!.id));
        setMesaj($t('aktivite_paylas.baglanti_acildi_baglanti_ile'));
      } else {
        await baglantiKapat(a!.id);
        setBaglanti(null);
        setMesaj($t('aktivite_paylas.baglanti_kapatildi_eski_baglanti'));
      }
    } catch (e) {
      setMesaj(e instanceof Error ? e.message : $t('ortak.kaydedilemedi'));
    }
  }

  async function gizlemeSec(v: boolean) {
    setHide(v);
    if (sunucuda) await aktiviteAyarla(a!.id, { hide_endpoints: v }).catch(() => undefined);
  }

  // Seçili temanın büyük önizlemesi: en fazla 400 pt yükseklik, ekran genişliğine sığar
  function temaOnizleme() {
    if (!secili) return null;
    const o = BICIM_OLCU[secili.bicim];
    const s = Math.min(400 / o.h, (ekranGenisligi - space.lg * 2) / o.w);
    return (
      <View style={{ borderRadius: 10, overflow: 'hidden' }}>
        <Olcekli w={o.w} h={o.h} s={s}>
          <secili.Bilesen {...temaOzellik} />
        </Olcekli>
      </View>
    );
  }

  // 3B video temasının önizlemesi: şablonun kendi sunucu çıktısından örnek kare (video kullanıcının rotasıyla üretilir)
  function videoOnizleme() {
    if (!seciliVideo) return null;
    const oran = seciliVideo.oran;
    const h = Math.min(400, (ekranGenisligi - space.lg * 2) / oran);
    return (
      <View style={{ borderRadius: 10, overflow: 'hidden' }}>
        <Image source={seciliVideo.resim} style={{ width: h * oran, height: h }} accessibilityIgnoresInvertColors />
        <View style={styles.videoRozet}>
          <Icon name="play" size={12} color="#FFFFFF" />
          <Txt style={styles.videoRozetYazi}>{$t('paylasimTemalari.video_rozet')}</Txt>
        </View>
      </View>
    );
  }

  // Video işinin durumu ve düğmesi
  function videoDenetimi() {
    if (!seciliVideo) return null;
    const is = videoIs;
    const suruyor = is && (is.durum === 'gonderiliyor' || is.durum === 'sirada' || is.durum === 'uretiliyor' || is.durum === 'indiriliyor');
    return (
      <View style={{ gap: 10, marginBottom: 14 }}>
        <Txt variant="small">{$t('paylasimTemalari.video_ornek')}</Txt>
        {seciliVideo.bicimler.length > 1 ? (
          <View accessibilityRole="radiogroup" style={styles.row}>
            {seciliVideo.bicimler.map((b) => (
              <Chip key={b} label={b === 'hikaye' ? $t('paylasimTemalari.bicim_hikaye') : $t('paylasimTemalari.bicim_gonderi')} role="radio" tone="sea" selected={b === videoBicim} onPress={() => setVideoBicim(b)} />
            ))}
          </View>
        ) : null}
        {suruyor ? (
          <View style={{ gap: 6 }} accessibilityLiveRegion="polite">
            <IlerlemeCubugu oran={is.durum === 'indiriliyor' ? 1 : is.ilerleme} />
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13 }}>
              {is.durum === 'sirada' && is.sira
                ? $t('paylasimTemalari.video_sirada', { n: is.sira })
                : is.durum === 'indiriliyor'
                  ? $t('paylasimTemalari.video_indiriliyor')
                  : $t('paylasimTemalari.video_hazirlaniyor', { n: Math.round(is.ilerleme * 100) })}
            </Txt>
            <Txt variant="small">{$t('paylasimTemalari.video_arkada')}</Txt>
          </View>
        ) : is?.durum === 'hazir' ? (
          <Button label={$t('paylasimTemalari.video_paylas')} icon="share" onPress={() => void videoPaylas(is).catch((e: unknown) => setMesaj(e instanceof Error ? e.message : $t('aktivite_paylas.paylasilamadi')))} />
        ) : (
          <>
            {is?.durum === 'hata' && is.hata ? <Txt style={{ color: colors.terra, fontSize: 13 }}>{is.hata}</Txt> : null}
            <Button label={is?.durum === 'hata' ? $t('paylasimTemalari.video_yeniden') : $t('paylasimTemalari.video_hazirla')} icon="play" onPress={() => videoBaslat(videoBicim)} />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Görseller için büyük kartlar: içeriğin arkasında çizilir (görünmez), yalnızca yakalanır */}
      <View style={styles.gizli} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <PaylasimKarti ref={buyukKart} a={a} sablon={look} goster={on} uclariGizle={hide} genislik={360} />
        <HikayeGorseli ref={hikaye} a={a} sablon={look} goster={on} uclariGizle={hide} />
        {secili ? <TemaGorseli ref={temaKart} tema={secili} {...temaOzellik} /> : null}
        {secili && secili.bicim !== 'hikaye' ? <TemaGorseli ref={temaHikaye} tema={secili} hikaye {...temaOzellik} /> : null}
      </View>
      <View style={styles.on}>
        <Header
          title={$t('ortak.paylas')}
          center
          right={
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={{ paddingHorizontal: 8, height: 44, justifyContent: 'center' }}>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15, color: colors.terra }}>{$t('aktivite_paylas.bitti')}</Txt>
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={{ paddingBottom: 170 + insets.bottom }}>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={styles.shadow}>
              {secili ? temaOnizleme() : seciliVideo ? videoOnizleme() : <PaylasimKarti a={a} sablon={look} goster={on} uclariGizle={hide} />}
            </View>
          </View>

          <View style={{ paddingHorizontal: space.lg }}>
            <Label>{$t('paylasimTemalari.tema')}</Label>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" contentContainerStyle={styles.temalar}>
            {[{ id: 'klasik' as const, ad: $t('paylasimTemalari.klasik') }, ...temalar.map((t) => ({ id: t.id, ad: t.ad() }))].map((t) => {
              const tm = temalar.find((x) => x.id === t.id);
              const o = tm ? BICIM_OLCU[tm.bicim] : { w: 196, h: 300 };
              const s = KUCUK_YUKSEKLIK / o.h;
              const sec = t.id === seciliId;
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="radio"
                  accessibilityLabel={t.ad}
                  accessibilityState={{ selected: sec }}
                  onPress={() => temaSec(t.id)}
                  style={styles.temaKutu}>
                  <View style={[styles.temaOnizleme, sec && styles.temaSecili]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    {tm ? (
                      <Olcekli w={o.w} h={o.h} s={s}>
                        <tm.Bilesen {...temaOzellik} />
                      </Olcekli>
                    ) : (
                      <PaylasimKarti a={a} sablon={look} goster={on} uclariGizle={hide} genislik={196 * s} />
                    )}
                  </View>
                  <Txt numberOfLines={1} style={[styles.temaAd, sec && { color: colors.terra }]}>
                    {t.ad}
                  </Txt>
                </Pressable>
              );
            })}
            {videolar.map((t) => {
              const sec = t.id === seciliId;
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${t.ad()}, ${$t('paylasimTemalari.video_rozet')}`}
                  accessibilityState={{ selected: sec }}
                  onPress={() => temaSec(t.id)}
                  style={styles.temaKutu}>
                  <View style={[styles.temaOnizleme, sec && styles.temaSecili]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Image source={t.resim} style={{ height: KUCUK_YUKSEKLIK, width: KUCUK_YUKSEKLIK * t.oran }} />
                    <View style={[styles.videoRozet, { left: 4, top: 4, paddingHorizontal: 5, height: 18 }]}>
                      <Icon name="play" size={9} color="#FFFFFF" />
                      <Txt style={[styles.videoRozetYazi, { fontSize: 9 }]}>3B</Txt>
                    </View>
                  </View>
                  <Txt numberOfLines={1} style={[styles.temaAd, sec && { color: colors.terra }]}>
                    {t.ad()}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: space.lg }}>
            {videoDenetimi()}

            {secili?.id === 'foto' && Platform.OS !== 'web' ? (
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                <Chip label={foto ? $t('paylasimTemalari.foto_degistir') : $t('paylasimTemalari.galeriden')} onPress={() => void fotoAl('galeri')} />
                <Chip label={$t('paylasimTemalari.kamera')} onPress={() => void fotoAl('kamera')} />
              </View>
            ) : null}

            {!secili && !seciliVideo ? (
              <>
                <Label>{$t('paylasimTemalari.renk')}</Label>
                <View accessibilityRole="radiogroup" style={styles.row}>
                  {KART_SABLONLARI().map((l, i) => (
                    <Chip key={l.name} label={l.name} role="radio" selected={i === look} onPress={() => setLook(i)} />
                  ))}
                </View>

                <Label>{$t('aktivite_paylas.kartta_goster')}</Label>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                  {statDefs()
                    .filter(([k]) => (k !== 'kisiler' || a.with.length > 0) && (k !== 'hava' || !!a.hava))
                    .map(([k, label]) => (
                      <Chip key={k} label={label} role="checkbox" tone="sea" icon={on[k] ? undefined : 'plus'} selected={!!on[k]} onPress={() => setOn({ ...on, [k]: !on[k] })} />
                    ))}
                </View>
              </>
            ) : null}

            <View style={{ borderTopWidth: 1, borderTopColor: colors.lineStrong, marginTop: 4 }}>
              <ToggleRow title={$t('aktivite_paylas.baslangic_ve_bitisi_gizle')} subtitle={$t('aktivite_paylas.evinin_konumu_haritada_gorunmez')} value={hide} onChange={gizlemeSec} />
            </View>

            {sunucuda ? (
              <>
                <Label>{$t('aktivite_paylas.lykiva_da_kimler_gorsun')}</Label>
                <View accessibilityRole="radiogroup" style={[styles.row, { flexWrap: 'wrap' }]}>
                  {GORUNURLUK().map((g) => (
                    <Chip key={g.id} label={g.label} role="radio" tone="sea" selected={g.id === gorunurluk} onPress={() => gorunurlukSec(g.id)} />
                  ))}
                </View>
                {baglanti !== undefined ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.lineStrong }}>
                    <ToggleRow
                      title={$t('aktivite_paylas.baglantiyla_paylasim')}
                      subtitle={
                        baglanti
                          ? $t('aktivite_paylas.acik_baglantisi_olan_herkes')
                          : $t('aktivite_paylas.kapali_acarsan_web_de')
                      }
                      value={!!baglanti}
                      onChange={baglantiSec}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </ScrollView>


        <View style={[styles.targets, { paddingBottom: insets.bottom + 12 }]}>
          {mesaj ? (
            <Txt accessibilityLiveRegion="polite" style={styles.mesaj}>
              {mesaj}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {targets().map((t) => {
              const pasif = (t.id === 'akis' || t.id === 'baglanti') && !sunucuda;
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  accessibilityLabel={$t('aktivite_paylas.ile_paylas', { label: t.label })}
                  accessibilityState={{ disabled: pasif, busy: mesgul === t.id }}
                  disabled={!!mesgul}
                  onPress={() => hedefSec(t)}
                  style={[styles.target, pasif && { opacity: 0.45 }]}>
                  <View style={[styles.targetIcon, { backgroundColor: t.bg }]}>
                    {mesgul === t.id ? <ActivityIndicator color={t.fg} /> : <Icon name={t.icon} color={t.fg} />}
                  </View>
                  <Txt style={{ fontSize: 11, fontFamily: fontFamily.bodySemiBold }} numberOfLines={1}>
                    {t.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <Txt variant="small" style={{ textAlign: 'center', marginTop: 8 }}>
            {$t('aktivite_paylas.hikaye_9_16_ve')}</Txt>
        </View>
      </View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  shadow: { borderRadius: 18, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  gizli: { position: 'absolute', left: 0, top: 0 },
  on: { flex: 1, backgroundColor: colors.ground },
  targets: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 8, paddingTop: 12 },
  mesaj: { textAlign: 'center', fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.seaInk, marginBottom: 8 },
  target: { width: '20%', alignItems: 'center', gap: 6 },
  temalar: { paddingHorizontal: space.lg, gap: 12, paddingBottom: 14 },
  temaKutu: { alignItems: 'center', gap: 6 },
  temaOnizleme: { borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  temaSecili: { borderColor: colors.terra },
  temaAd: { maxWidth: 104, fontSize: 11, fontFamily: fontFamily.bodySemiBold, color: colors.inkMuted },
  videoRozet: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(22,32,27,0.82)' },
  videoRozetYazi: { fontFamily: fontFamily.bodyBold, fontSize: 11, color: '#FFFFFF', letterSpacing: 0.4 },
  targetIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
}));
