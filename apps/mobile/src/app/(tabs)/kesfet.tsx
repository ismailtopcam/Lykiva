/**
 * Harita sekmesi: iki iş tek ekranda. Panelin başındaki geçişle "Yolculuk yap" (bulunduğun yerden seçtiğin yere
 * yol tarifi) ya da "Egzersiz yap" (tür seç, kaydı başlat; bkz. `EgzersizPaneli`) seçilir.
 *
 * Hedef haritaya dokunarak ya da yer aramayla (Photon) seçilir; yol BRouter'la, seçilen etkinliğe göre hesaplanır
 * (patika ya da yol öncelikli). "Yola çık" kaydı bu yolla başlatır, kayıt ekranı kalan mesafeyi gösterir.
 * Etkinliklerin yanında "Araba" da seçilebilir (Egzersiz'de yoktur, etkinlik türü değildir): "Yola çık" aynı rota
 * takibini açar ama yolculuk bitince aktivite olarak kaydedilmez (bkz. `Kayit.araba`). Bizde adım adım yönlendirme
 * olmadığı için ayrıntı bölümündeki "Haritalar'da aç" hedefi telefonun harita uygulamasında açar.
 * Eski Keşfet içeriği (rotalar, topluluklar, etkinlikler, kişiler) sağ üstteki düğmeyle açılır: `kesfet-liste.tsx`.
 * Dosya adı bağlantılar bozulmasın diye `kesfet` kaldı.
 */
import { ACTIVITY_LABELS, ACTIVITY_TYPES, estimateDuration, formatKm, formatMeters, kmUnit, routeStats, type RoutePoint } from '@lykiva/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EgimProfili, imlecKonumu, TirmanisListesi, useRotaEgim } from '@/components/EgimProfili';
import { EgzersizPaneli, GpsRozeti } from '@/components/EgzersizPaneli';
import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { ModGecisi, type HaritaModu } from '@/components/ModGecisi';
import { usePanelKademesi } from '@/components/panelKademesi';
import { gercekHarita, type MapMarker } from '@/components/map/TopoMap';
import { YolHaritasi } from '@/components/map/YolHaritasi';
import { RotaRuzgari } from '@/components/RotaRuzgari';
import { Txt } from '@/components/Txt';
import { Button, Chip, Stat } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import type { Rota } from '@/data/rota';
import { baslat, IzinHatasi, konumOnizlemeBaslat, useKayit } from '@/kayit/kaydedici';
import { sonHedefEkle, useSonHedefler } from '@/lib/sonHedefler';
import { yerAra, type YerSonucu } from '@/lib/yerArama';
import { rotaHesapla, type CizimModu, type YolTuru } from '@/lib/yonlendirme';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

type Hedef = { c: LngLat; ad: string | null };
type Odak = { c: LngLat; z: number };
/** Bilgi panelinin son bölümünün altındaki boşluk (styles.sheetIc paddingBottom) */
const PANEL_ALT_BOSLUK = 16;
/** Boş durumda panelde gösterilen son yer sayısı */
const SON_HEDEF_SAYISI = 3;
const BOS: RoutePoint[] = [];

const TERCIHLER = (): { id: Exclude<CizimModu, 'serbest'>; label: string }[] => [
  { id: 'yol', label: $t('harita.yol_oncelikli') },
  { id: 'patika', label: $t('harita.patika_oncelikli') },
];

/** "1 sa 10 dk" */
function sureMetni(s: number) {
  const dk = Math.max(1, Math.round(s / 60));
  const sa = Math.floor(dk / 60);
  return sa > 0 ? $t('rota_olustur.sa_dk', { sa, a: dk % 60 }) : $t('rota_olustur.dk', { dk });
}

/** Yolun tamamı görünsün diye kamera merkezi ve yakınlaştırması (w × h: haritanın boş kalan alanı, px) */
function cerceve(points: RoutePoint[], w: number, h: number): Odak | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.lng);
  const ys = points.map((p) => p.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const orta: LngLat = [(x0 + x1) / 2, (y0 + y1) / 2];
  const kos = Math.cos((orta[1] * Math.PI) / 180) || 1;
  // Zoom z'de dünya 256·2^z px genişliğinde; enlem farkı Mercator'da kabaca 1/cos(enlem) kadar uzar
  const zx = Math.log2((Math.max(w, 100) * 360) / (256 * Math.max(x1 - x0, 1e-5)));
  const zy = Math.log2((Math.max(h, 100) * 360 * kos) / (256 * Math.max(y1 - y0, 1e-5)));
  return { c: orta, z: Math.max(3, Math.min(16, Math.min(zx, zy) - 0.3)) };
}

export default function HaritaScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const kayit = useKayit();
  // Ne yapılıyor: yol tarifi mi, egzersiz mi (sekme açık kaldıkça korunur)
  const [gorev, setGorev] = useState<HaritaModu>('yolculuk');
  const yolculuk = gorev === 'yolculuk';
  // Egzersiz için seçilen rota (haritada gösterilir)
  const [rota, setRota] = useState<Rota | null>(null);
  const sonHedefler = useSonHedefler();
  const [activity, setActivity] = useState<YolTuru>('walk');
  const araba = activity === 'car';
  const [mod, setMod] = useState<Exclude<CizimModu, 'serbest'>>('yol');
  const [hedef, setHedef] = useState<Hedef | null>(null);
  // Yolun başı: hedef seçildiği andaki konum (her GPS güncellemesinde yeniden hesaplanmasın diye sabit)
  const [baslangic, setBaslangic] = useState<LngLat | null>(null);
  const [yol, setYol] = useState<{ points: RoutePoint[]; icin: string; sureSn: number | null } | null>(null);
  const [hesapliyor, setHesapliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basliyor, setBasliyor] = useState(false);
  const [q, setQ] = useState('');
  const [sonuclar, setSonuclar] = useState<YerSonucu[]>([]);
  const [odak, setOdak] = useState<Odak | null>(null);
  const ilkOdak = useRef(false);
  const [haritaH, setHaritaH] = useState(700);
  // Eğim profilinde seçilen nokta; yol değişince geçersiz olsun diye hangi yola ait olduğu da tutulur
  const [secim, setSecim] = useState<{ points: RoutePoint[]; v: number } | null>(null);
  // Kameranın en son hangi yol + panel yüksekliği için yola sığdırıldığı
  const [cerceveli, setCerceveli] = useState<string | null>(null);

  // Sekme açıkken GPS'i çalıştır (kayıt sürmüyorsa konumu yalnızca gösterir); sekmeden çıkınca durur
  useFocusEffect(useCallback(() => konumOnizlemeBaslat(), []));

  const sk = kayit.sonKonum;
  const ben: LngLat | null = sk ? [sk.lng, sk.lat] : null;

  // İlk konum gelince haritayı oraya getir
  useEffect(() => {
    if (sk && !ilkOdak.current) {
      ilkOdak.current = true;
      setOdak({ c: [sk.lng, sk.lat], z: 14 });
    }
  }, [sk]);

  // Hedef konumdan önce seçildiyse konum gelince başlangıç olsun (çizim sırasında, bir kez)
  if (hedef && !baslangic && sk) setBaslangic([sk.lng, sk.lat]);

  // Hedef, başlangıç, etkinlik ya da tercih değişince yolu hesapla
  const anahtar = hedef && baslangic ? `${baslangic.join(',')}>${hedef.c.join(',')}|${mod}|${activity}` : null;
  useEffect(() => {
    if (!anahtar || !hedef || !baslangic) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      setHesapliyor(true);
      setHata(null);
      rotaHesapla([baslangic, hedef.c], mod, activity, ac.signal)
        .then((r) => setYol({ points: r.points, icin: anahtar, sureSn: r.sureSn }))
        .catch((e) => {
          if (e?.name !== 'AbortError') setHata(e instanceof Error ? e.message : $t('lib_yonlendirme.rota_hesaplanamadi'));
        })
        .finally(() => !ac.signal.aborted && setHesapliyor(false));
    }, 200);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
    // Panel ve ekran ölçüsü değişince yeniden hesaplanmasın
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar]);

  // Yer arama (yazmayı bırakınca)
  useEffect(() => {
    if (q.trim().length < 2) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      yerAra(q, odak?.c ?? null, ac.signal)
        .then(setSonuclar)
        .catch(() => undefined);
    }, 350);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q, odak?.c]);

  const gorunenSonuclar = q.trim().length >= 2 ? sonuclar : [];
  // Eski hesap yeni hedefte gösterilmez
  const points = useMemo(() => (yol && yol.icin === anahtar ? yol.points : []), [yol, anahtar]);
  const stats = useMemo(() => (points.length > 1 ? routeStats(points) : null), [points]);
  const rakimVar = points.some((p) => p.alt != null);
  // Tahmini süre: etkinlikte kendi hesabımız (hız + tırmanış), arabada BRouter'ın hesabı (trafik verisi yok)
  const sureSn = !stats
    ? null
    : activity === 'car'
      ? (yol && yol.icin === anahtar ? yol.sureSn : null)
      : estimateDuration(activity, stats.distanceM, rakimVar ? stats.gainM : 0);
  const egim = useRotaEgim(points);
  const imlec = secim && secim.points === points ? secim.v : null;
  const imlecYeri = imlecKonumu(points, egim, imlec);
  // Yükselti ve tırmanış bölümleri yalnızca gösterilecek yol bilgisi varken
  const yolVar = !!hedef && !!baslangic && points.length > 1;

  // Bilgi paneli kademeleri (tek sayfanın bölümleri). Yol tarifinde: kısa özet (süre ve Yola çık; panel aşağı
  // çekilince yalnızca bu kalır), ayrıntı (mesafe, etkinlik, tercih), yükselti (rakım varsa), tırmanışlar ve rüzgâr.
  // Hedef yokken ve egzersizde tek bölüm. Panel ayrıntı kademesinde açılır; seçilen kademe hedef değişince de kalır
  const kademeAdlari = !yolculuk || !hedef
    ? [$t('harita.panel_ozet')]
    : !yolVar
      ? [$t('harita.panel_kisa'), $t('harita.panel_ozet')]
      : egim
        ? [$t('harita.panel_kisa'), $t('harita.panel_ozet'), $t('harita.panel_yukselti'), $t('egimProfili.tirmanislar')]
        : [$t('harita.panel_kisa'), $t('harita.panel_ozet'), $t('rotaRuzgari.simdiki_ruzgar')];
  const panel = usePanelKademesi({ ilk: 1, sayi: kademeAdlari.length, altBosluk: PANEL_ALT_BOSLUK });
  // Haritanın panelin üstünde kalan kısmı için panelin oturduğu yükseklik (sürüklerken değişmez)
  const panelH = panel.gorunenH || 220;

  // Yol gelince ya da panel (eğim, rüzgâr yüklendikçe) büyüyünce yolun tamamını panelin üstünde göster.
  // Çizim sırasında, her yol ve panel yüksekliği için bir kez (React'in "önceki değere göre state ayarla" kalıbı)
  // Haritada çizilen: yol tarifi ya da egzersiz için seçilen rota
  const cizilen = yolculuk ? points : (rota?.points ?? BOS);
  const cerceveAnahtari = cizilen.length > 1 ? `${yolculuk ? anahtar : `rota:${rota?.id}`}|${panelH}` : null;
  if (cerceveAnahtari && cerceveAnahtari !== cerceveli) {
    setCerceveli(cerceveAnahtari);
    const f = cerceve(cizilen, width - 80, haritaH - insets.top - 120 - panelH - 40);
    if (f) setOdak(f);
  }
  const gorunenHata = anahtar ? hata : null;
  const kayitta = kayit.durum !== 'bos';

  const markers: MapMarker[] = [];
  if (yolculuk && hedef) markers.push({ id: 'hedef', coord: hedef.c, kind: 'end' });
  if (yolculuk && imlecYeri) markers.push({ id: 'imlec', coord: imlecYeri, kind: 'cursor' });

  function hedefSec(h: Hedef) {
    setHedef(h);
    setBaslangic(ben);
    setHata(null);
  }

  function yerSec(y: YerSonucu) {
    Keyboard.dismiss();
    setQ('');
    setSonuclar([]);
    sonHedefEkle({ ad: y.ad, ayrinti: y.ayrinti, c: y.coord });
    hedefSec({ c: y.coord, ad: y.ad });
    setOdak({ c: y.coord, z: 14 });
  }

  function temizle() {
    setHedef(null);
    setBaslangic(null);
    setYol(null);
    setHata(null);
  }

  /** Araba: hedefi telefonun harita uygulamasında araba yol tarifiyle açar (iOS Apple Haritalar, Android Google Haritalar) */
  async function haritalardaAc() {
    if (!hedef) return;
    const h = encodeURIComponent(`${hedef.c[1].toFixed(6)},${hedef.c[0].toFixed(6)}`);
    const url = Platform.OS === 'ios' ? `https://maps.apple.com/?daddr=${h}&dirflg=d` : `https://www.google.com/maps/dir/?api=1&destination=${h}&travelmode=driving`;
    setHata(null);
    try {
      await Linking.openURL(url);
    } catch {
      setHata($t('harita.haritalar_acilamadi'));
    }
  }

  async function yolaCik() {
    if (!hedef || points.length < 2) return;
    setBasliyor(true);
    setHata(null);
    try {
      const ad = hedef.ad ? $t('harita.yol_tarifi_ad', { ad: hedef.ad }) : $t('harita.yol_tarifi');
      // Geçici id: sunucuda rota değil, aktiviteye route_id olarak gitmez (bkz. kayit/paket.ts).
      // Araba ('car'): rota takibi açılır, bitince kaydedilmez
      await baslat(activity, { id: `tarif-${Date.now()}`, name: ad, points }, null);
      router.push('/kayit/canli');
    } catch (e) {
      setHata(e instanceof IzinHatasi || e instanceof Error ? e.message : $t('kayit.kayit_baslatilamadi'));
    } finally {
      setBasliyor(false);
    }
  }

  const hedefAdi = hedef?.ad ?? (hedef ? $t('harita.secilen_nokta', { lat: hedef.c[1].toFixed(4), lng: hedef.c[0].toFixed(4) }) : '');

  const tahminiSure = sureSn != null ? sureMetni(sureSn) : '–';
  const kisaOlcu = stats
    ? `${formatKm(stats.distanceM)} ${kmUnit()}${rakimVar ? ` · ${$t('rota_olustur.m', { meters: formatMeters(stats.gainM) })}` : ''}`
    : $t('rota_olustur.tahmini_sure');

  return (
    <View style={styles.root} onLayout={(e) => setHaritaH(Math.round(e.nativeEvent.layout.height))}>
      {/* Kayıt ekranıyla ortak harita: eğim renkli yol, 3B/2B ve konum düğmeleri */}
      <YolHaritasi
        style={StyleSheet.absoluteFill}
        points={cizilen}
        egim={yolculuk ? egim : undefined}
        ben={ben}
        markers={markers}
        onKonum={() => ben && setOdak({ c: ben, z: 15 })}
        ustBosluk={insets.top + 58}
        follow={odak?.c ?? null}
        followZoom={odak?.z}
        onPress={yolculuk ? (c) => hedefSec({ c, ad: null }) : undefined}
        padding={{ top: 120, bottom: panelH + 40 }}
        accessibilityLabel={yolculuk && hedef ? $t('harita.yol_haritasi', { ad: hedefAdi }) : $t('harita.harita')}
      />
      <FloatingHeader
        // Konum düğmesi haritanın sağ sütununda; boş yer tutucu (verilmezse geri düğmesi çıkar)
        left={<View />}
        middle={
          yolculuk ? (
            // Arama hep yukarıda; hedef seçiliyken adını gösterir, çarpı hedefi kaldırır
            <View style={styles.search}>
              <Icon name="search" size={18} color={colors.inkMuted} strokeWidth={2} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={hedef ? hedefAdi : $t('harita.nereye_gidiyorsun')}
                placeholderTextColor={hedef ? colors.ink : colors.inkMuted}
                accessibilityLabel={$t('harita.hedef_ara')}
                autoCorrect={false}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {hedef && !q ? (
                <Pressable accessibilityRole="button" accessibilityLabel={$t('harita.hedefi_kaldir')} onPress={temizle} hitSlop={10} style={styles.searchKapat}>
                  <Icon name="close" size={18} color={colors.inkMuted} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <GpsRozeti acc={sk?.acc} />
          )
        }
        right={<IconButton floating icon="compass" label={$t('kesfet.kesfet')} onPress={() => router.push('/kesfet-liste')} />}
      />

      {yolculuk && gorunenSonuclar.length ? (
        <View style={[styles.results, { top: insets.top + 64 }]}>
          {gorunenSonuclar.map((y) => (
            <Pressable key={y.id} accessibilityRole="button" onPress={() => yerSec(y)} style={styles.result}>
              <Icon name="pin" size={18} color={colors.terra} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                  {y.ad}
                </Txt>
                {y.ayrinti ? <Txt variant="small">{y.ayrinti}</Txt> : null}
              </View>
            </Pressable>
          ))}
          <Txt variant="small" style={styles.resultsNote}>
            {$t('rota_olustur.yalnizca_turkiyedeki_yerler')}
          </Txt>
        </View>
      ) : null}

      {/* Bilgi paneli: tek uzun sayfa, kademeler bölümleri (bkz. panelKademesi.ts). Başta hep Yolculuk / Egzersiz
          geçişi. Yol tarifinde 1: süre ve Yola çık, 2: ayrıntı, 3: yükselti, 4: tırmanışlar ve rüzgâr. Panel
          büyüdükçe aynı sayfanın aşağısı görünür; içerik değişmez */}
      <Animated.View style={[styles.sheet, panel.stil]}>
        <View style={styles.sheetIc}>
          {/* 1. bölüm. Yol tarifinde hedef seçiliyken sürükleme alanı */}
          <View onLayout={panel.bolum[0]} {...(yolculuk && hedef ? panel.surukle.panHandlers : null)}>
            {yolculuk && hedef ? (
              <View
                style={styles.tutamac}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={$t('harita.bilgi_paneli')}
                accessibilityValue={{ text: kademeAdlari[panel.kademe] }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? panel.buyut() : panel.kucult())}>
                <View style={styles.cizgi} />
                <View style={styles.kademeNoktalari}>
                  {kademeAdlari.map((ad, k) => (
                    <View key={ad} style={[styles.kademeNoktasi, k <= panel.kademe && styles.kademeNoktasiDolu]} />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.grip} />
            )}

            <ModGecisi mod={gorev} onMod={setGorev} />

            {!yolculuk ? (
              <EgzersizPaneli rota={rota} onRota={setRota} kayitDurumu={kayit.durum} onBasladi={() => router.push('/kayit/canli')} />
            ) : !hedef ? (
              <>
                {sonHedefler.length ? (
                  <>
                    <Txt variant="caption" accessibilityRole="header" style={{ marginLeft: 4, marginBottom: 2 }}>
                      {$t('harita.son_gittiklerin')}
                    </Txt>
                    {sonHedefler.slice(0, SON_HEDEF_SAYISI).map((h, i) => (
                      <Pressable
                        key={`${h.ad}|${h.c.join(',')}`}
                        accessibilityRole="button"
                        onPress={() => {
                          hedefSec({ c: h.c, ad: h.ad });
                          setOdak({ c: h.c, z: 14 });
                        }}
                        style={({ pressed }) => [styles.sonSatir, i > 0 && styles.sonSatirCizgi, pressed && { opacity: 0.7 }]}>
                        <View style={styles.sonIkon}>
                          <Icon name="clock" size={20} color={colors.seaInk} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                            {h.ad}
                          </Txt>
                          {h.ayrinti ? (
                            <Txt variant="small" numberOfLines={1}>
                              {h.ayrinti}
                            </Txt>
                          ) : null}
                        </View>
                        <Icon name="chevron" size={18} color={colors.inkMuted} strokeWidth={2} />
                      </Pressable>
                    ))}
                    {gercekHarita ? (
                      <Txt variant="small" style={{ marginTop: 8, textAlign: 'center' }}>
                        {$t('harita.ya_da_haritaya_dokun')}
                      </Txt>
                    ) : null}
                  </>
                ) : (
                  <Txt variant="small">{gercekHarita ? $t('harita.haritaya_dokun_ya_da_ara') : $t('harita.yukaridan_ara')}</Txt>
                )}
                {!ben ? (
                  <Txt variant="small" style={{ marginTop: 4, color: colors.inkMuted }}>
                    {$t('harita.konum_bekleniyor')}
                  </Txt>
                ) : null}
              </>
            ) : (
              <>
                {/* Kısa özet: panel aşağı çekilince geçişle birlikte yalnızca bu satır kalır */}
                <View style={styles.ozetSatiri}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt style={styles.sure} numberOfLines={1} adjustsFontSizeToFit>
                      {tahminiSure}
                    </Txt>
                    <Txt variant="small" numberOfLines={1}>
                      {kisaOlcu}
                    </Txt>
                  </View>
                  {hesapliyor && anahtar ? <ActivityIndicator color={colors.sea} /> : null}
                  {ben && baslangic && (ben[0] !== baslangic[0] || ben[1] !== baslangic[1]) ? (
                    <IconButton icon="rotate" label={$t('harita.konumumdan_yeniden_hesapla')} onPress={() => setBaslangic(ben)} />
                  ) : null}
                  {kayitta ? (
                    <Button label={$t('harita.kayda_don')} icon="record" variant="dark" onPress={() => router.push('/kayit')} style={styles.ozetDugme} />
                  ) : (
                    <Button
                      label={basliyor ? $t('harita.basliyor') : $t('harita.yola_cik')}
                      icon="navigation"
                      variant="sea"
                      onPress={() => void yolaCik()}
                      disabled={!stats || hesapliyor || basliyor}
                      style={styles.ozetDugme}
                    />
                  )}
                </View>
                {!baslangic ? (
                  <Txt variant="small" style={{ marginTop: 8 }}>
                    {$t('harita.konum_bekleniyor')}
                  </Txt>
                ) : null}
                {gorunenHata ? (
                  <Txt accessibilityRole="alert" style={{ color: colors.terra, fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginTop: 8 }}>
                    {gorunenHata}
                  </Txt>
                ) : null}
              </>
            )}
          </View>

          {/* 2. bölüm: ayrıntı. Hedef, mesafe ve iniş çıkış, etkinlik ve yol tercihi */}
          {yolculuk && hedef ? (
            <View onLayout={panel.bolum[1]} style={styles.bolum}>
              <View style={styles.hedefSatiri}>
                <View style={styles.hedefIkon}>
                  <Icon name="pin" size={20} color={colors.seaInk} />
                </View>
                <Txt accessibilityRole="header" style={{ flex: 1, fontFamily: fontFamily.display, fontSize: 18 }} numberOfLines={1}>
                  {hedefAdi}
                </Txt>
              </View>
              {baslangic ? (
                <View style={styles.olculer}>
                  <Stat label={$t('ortak.mesafe')} size={18} value={stats ? `${formatKm(stats.distanceM)} ${kmUnit()}` : '–'} />
                  <Stat label={$t('ortak.tirmanis')} size={18} value={stats && rakimVar ? $t('rota_olustur.m', { meters: formatMeters(stats.gainM) }) : '–'} />
                  <Stat label={$t('ortak.inis')} size={18} value={stats && rakimVar ? $t('rota_olustur.m_2', { meters: formatMeters(stats.lossM) }) : '–'} />
                </View>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }} accessibilityRole="radiogroup">
                {ACTIVITY_TYPES.map((t) => (
                  <Chip key={t} label={ACTIVITY_LABELS[t]} role="radio" selected={t === activity} onPress={() => setActivity(t)} />
                ))}
                <Chip label={$t('harita.araba')} role="radio" selected={araba} onPress={() => setActivity('car')} />
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup">
                {TERCIHLER().map((m) => (
                  <Chip key={m.id} label={m.label} role="radio" tone="sea" selected={m.id === mod} onPress={() => setMod(m.id)} />
                ))}
              </View>
              {araba ? (
                <>
                  {/* Araba patikaya giremez: tercih yalnızca toprak yolları açar (bkz. yonlendirme.ts > profilEkleri) */}
                  {mod === 'patika' ? (
                    <Txt variant="small" style={{ marginTop: 8 }}>
                      {$t('harita.araba_patika_notu')}
                    </Txt>
                  ) : null}
                  {/* Bizde adım adım yönlendirme yok: hedef telefonun harita uygulamasında da açılabilir */}
                  <Button label={$t('harita.haritalarda_ac')} icon="map" variant="outline" onPress={() => void haritalardaAc()} style={{ marginTop: 12 }} />
                </>
              ) : null}
            </View>
          ) : null}

          {/* 3. bölüm: yükselti (eğim profili; rakım yoksa bu bölüm yok) */}
          {yolculuk && yolVar && egim ? (
            <View onLayout={panel.bolum[2]} style={styles.bolum}>
              <EgimProfili egim={egim} width={width - space.lg * 2} height={64} imlec={imlec} onImlec={(v) => setSecim(v == null ? null : { points, v })} />
            </View>
          ) : null}

          {/* Son bölüm: tırmanışlar ve rüzgâr; uzunsa içi kayar, harita görünür kalır */}
          {yolculuk && yolVar ? (
            <View onLayout={panel.bolum[kademeAdlari.length - 1]} style={styles.bolum}>
              <ScrollView style={{ maxHeight: height * 0.4 }} showsVerticalScrollIndicator={false}>
                {egim ? <TirmanisListesi egim={egim} onSec={(v) => setSecim({ points, v })} /> : null}
                <RotaRuzgari points={points} />
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, alignSelf: 'stretch', paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  searchKapat: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  results: { position: 'absolute', left: space.md, right: space.md, borderRadius: 16, backgroundColor: colors.surface, paddingVertical: 4, borderWidth: 1, borderColor: colors.line },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 6 },
  resultsNote: { color: colors.inkMuted, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 6 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  // Panelin içi: iç boşluklar burada, panelin boyu bunun ölçüsünden (bkz. panelKademesi.ts)
  sheetIc: { paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: PANEL_ALT_BOSLUK },
  // Alt bölümler (yükselti, tırmanışlar): üst boşluk alt boşluk kadar, bir alttaki kademede bölümün başı
  // panelin alt boşluğuna taşmasın
  bolum: { paddingTop: PANEL_ALT_BOSLUK },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 10 },
  // Parmakla tutması kolay olsun diye yüksek; ortada çizgi, altında hangi kademede olduğunu gösteren üç nokta
  tutamac: { alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 28, marginTop: -6, marginBottom: 4 },
  cizgi: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  kademeNoktalari: { flexDirection: 'row', gap: 4 },
  kademeNoktasi: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.line },
  kademeNoktasiDolu: { backgroundColor: colors.inkMuted },
  hedefSatiri: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  hedefIkon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.seaSoft, alignItems: 'center', justifyContent: 'center' },
  olculer: { flexDirection: 'row', justifyContent: 'space-between', columnGap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.ground, marginBottom: 4 },
  // Kısa özet satırı: solda süre ve mesafe, sağda Yola çık
  ozetSatiri: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sure: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 30, color: colors.ink, letterSpacing: -0.3 },
  ozetDugme: { maxWidth: '62%', paddingHorizontal: 22 },
  sonSatir: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 4 },
  sonSatirCizgi: { borderTopWidth: 1, borderTopColor: colors.line },
  sonIkon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.seaSoft, alignItems: 'center', justifyContent: 'center' },
}));
