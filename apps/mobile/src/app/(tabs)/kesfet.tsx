/**
 * Harita sekmesi: iki iş tek ekranda. Panelin başındaki geçişle "Yolculuk yap" (bulunduğun yerden seçtiğin yere
 * yol tarifi) ya da "Egzersiz yap" (tür seç, kaydı başlat; bkz. `EgzersizPaneli.tsx`) seçilir.
 *
 * Hedef haritaya dokunarak ya da yer aramayla (Photon) seçilir; yol BRouter'la, seçilen etkinliğe göre hesaplanır
 * (patika ya da yol öncelikli). "Yola çık" kaydı bu yolla başlatır, kayıt ekranı kalan mesafeyi gösterir.
 * Etkinliklerin yanında "Araba" da seçilebilir (Egzersiz'de yoktur, etkinlik türü değildir): "Yola çık" aynı rota
 * takibini açar ama yolculuk bitince aktivite olarak kaydedilmez (bkz. `Kayit.araba`). Bizde adım adım yönlendirme
 * olmadığı için ayrıntı bölümündeki "Haritalar'da aç" hedefi telefonun harita uygulamasında açar.
 * Panel tutamağından sürüklenir: en altta yalnızca tutamaç kalır (harita açılır), sonra kademeler gelir
 * (bkz. `panelKademesi.ts`).
 * Eski Keşfet içeriği (rotalar, topluluklar, etkinlikler, kişiler) sağ üstteki düğmeyle açılır: `kesfet-liste.tsx`.
 * Dosya adı bağlantılar bozulmasın diye `kesfet` kaldı.
 */
import { ACTIVITY_LABELS, ACTIVITY_TYPES, estimateDuration, formatKm, formatMeters, kmUnit, routeStats, type RoutePoint } from '@lykiva/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EgimProfili, imlecKonumu, TirmanisListesi, useRotaEgim } from '@/components/EgimProfili';
import { EgzersizAyrinti, EgzersizSeridi, GpsRozeti } from '@/components/EgzersizPaneli';
import { FloatingHeader } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { ModGecisi, type HaritaModu } from '@/components/ModGecisi';
import { usePanelKademesi } from '@/components/panelKademesi';
import { gercekHarita, type MapMarker } from '@/components/map/TopoMap';
import { YolHaritasi } from '@/components/map/YolHaritasi';
import { RotaRuzgari } from '@/components/RotaRuzgari';
import { Txt } from '@/components/Txt';
import { Button, Chip, Stat, ToggleRow } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { rotaGetir, type Rota } from '@/data/rota';
import { baslat, IzinHatasi, konumOnizlemeBaslat, useKayit } from '@/kayit/kaydedici';
import { egzersizTuruSec, TUR_IKONLARI } from '@/lib/egzersizTuru';
import { sonHedefEkle, sonHedefleriTemizle, sonHedefSil, useSonHedefler, type SonHedef } from '@/lib/sonHedefler';
import { yerAra, type YerSonucu } from '@/lib/yerArama';
import { rotaHesapla, type CizimModu, type YolTuru } from '@/lib/yonlendirme';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

/** `ayrinti`: aramayla seçilen yerin ilçesi / ili (haritaya dokunarak seçilende yok) */
type Hedef = { c: LngLat; ad: string | null; ayrinti?: string | null };
type Odak = { c: LngLat; z: number };
/** Bilgi panelinin son bölümünün altındaki boşluk (styles.sheetIc paddingBottom) */
const PANEL_ALT_BOSLUK = 16;
const BOS: RoutePoint[] = [];
/** "Egzersiz olarak da kaydet" seçimi telefonda saklanır ('0' = kapalı) */
const KAYDET_ANAHTARI = 'lykiva.yolculuk-kaydet.v1';

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
  // Yol tarifi aynı zamanda aktivite olarak kaydedilsin mi (kapalıysa bitince bir şey kaydedilmez)
  const [kaydet, setKaydet] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(KAYDET_ANAHTARI)
      .then((s) => s === '0' && setKaydet(false))
      .catch(() => undefined);
  }, []);
  function kaydetSec(v: boolean) {
    setKaydet(v);
    void AsyncStorage.setItem(KAYDET_ANAHTARI, v ? '1' : '0').catch(() => undefined);
  }
  const [mod, setMod] = useState<Exclude<CizimModu, 'serbest'>>('yol');
  // Ulaşım ve yol tercihi hapları: basılınca altında seçenekleri açılır
  const [acikSecim, setAcikSecim] = useState<'ulasim' | 'tercih' | null>(null);
  // Kısa özet satırının boyu: ayrıntı bölümü bu kadar yukarı bindirilir (aşağıda, panel)
  const [kisaH, setKisaH] = useState(54);
  const [hedef, setHedef] = useState<Hedef | null>(null);
  // Yolun başı: hedef seçildiği andaki konum (her GPS güncellemesinde yeniden hesaplanmasın diye sabit)
  const [baslangic, setBaslangic] = useState<LngLat | null>(null);
  const [yol, setYol] = useState<{ points: RoutePoint[]; icin: string; sureSn: number | null } | null>(null);
  const [hesapliyor, setHesapliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basliyor, setBasliyor] = useState(false);
  const [q, setQ] = useState('');
  // Arama kutusu odaktayken ve boşken altında son aramalar listelenir. Odak gidince liste biraz geç kapanır:
  // web'de listeye basınca önce kutu odağı bırakır, liste basıştan önce kaybolmasın
  const [aramaOdakta, setAramaOdakta] = useState(false);
  const aramaKutusu = useRef<TextInputInstance>(null);
  const odakZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (odakZamanlayici.current) clearTimeout(odakZamanlayici.current);
  }, []);
  function aramaOdagi(odakta: boolean) {
    if (odakZamanlayici.current) clearTimeout(odakZamanlayici.current);
    odakZamanlayici.current = null;
    if (odakta) setAramaOdakta(true);
    else odakZamanlayici.current = setTimeout(() => setAramaOdakta(false), 200);
  }
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
  // çekilince yalnızca bu kalır), ayrıntı (tasarımdaki "panel açık": hedef, ölçüler ve yükselti, ulaşım ve tercih,
  // kayıt anahtarı, en altta Yola çık), tırmanışlar ve rüzgâr. Kısa özetle ayrıntı aynı yerde durur: panel büyürken
  // kısa özet söner, ayrıntı belirir (bkz. panelKademesi.ts > gecis).
  // Hedef yokken ve egzersizde tek bölüm. Panel ayrıntı kademesinde açılır; seçilen kademe hedef değişince de kalır.
  // Her durumda panel tutamağından aşağı çekilince yalnızca tutamaç kalır (kapalı; harita açılır), yukarı çekince
  // ya da tutamağa dokununca geri gelir
  const kademeAdlari = !yolculuk
    ? [$t('egzersiz.hangi_egzersiz'), $t('harita.panel_ozet')]
    : !hedef
    ? [$t('harita.panel_ozet')]
    : !yolVar
      ? [$t('harita.panel_kisa'), $t('harita.panel_ozet')]
      : [$t('harita.panel_kisa'), $t('harita.panel_ozet'), egim ? $t('egimProfili.tirmanislar') : $t('rotaRuzgari.simdiki_ruzgar')];
  const panel = usePanelKademesi({ ilk: 1, sayi: kademeAdlari.length, altBosluk: PANEL_ALT_BOSLUK, kapanir: true });
  // Kısa özet yalnızca en alttaki kademede, ayrıntı ondan sonrakilerde görünür ve dokunulur
  const kisaAcik = panel.kademe === 0;

  // Rota sayfasındaki "Bu rotayı başlat" (ve eski /kayit bağlantıları) buraya gelir: Egzersiz yap, rota seçili.
  // Parametre bir kez uygulanır, sonra silinir (sekmeye her dönüşte yeniden uygulanmasın)
  const parametre = useLocalSearchParams<{ rota?: string; egzersiz?: string }>();
  const istek = parametre.rota ?? parametre.egzersiz ?? null;
  const [uygulananIstek, setUygulananIstek] = useState<string | null>(null);
  // Geçiş çizim sırasında (React'in "önceki değere göre state ayarla" kalıbı); panel, rota ve parametre efektte
  if (istek !== uygulananIstek) {
    setUygulananIstek(istek);
    if (istek) setGorev('egzersiz');
  }
  useEffect(() => {
    if (!parametre.rota && !parametre.egzersiz) return;
    panel.ac();
    if (parametre.rota) {
      rotaGetir(parametre.rota)
        .then((r) => {
          setRota(r);
          egzersizTuruSec(r.activity);
        })
        .catch(() => undefined);
    }
    router.setParams({ rota: undefined, egzersiz: undefined });
  }, [parametre.rota, parametre.egzersiz, panel]);
  const gecis = panel.gecis;
  const kisaOpak = useMemo(() => gecis?.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' }), [gecis]);
  const ayrintiOpak = useMemo(() => gecis?.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1], extrapolate: 'clamp' }), [gecis]);
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
    // Arama kutusu açıkken haritaya dokunulursa klavye ve son aramalar kapansın
    Keyboard.dismiss();
    // Panel aşağı indirilmişken hedef seçilirse (haritaya dokunma, arama) yol bilgisi görünsün
    panel.ac();
    setHedef(h);
    setBaslangic(ben);
    setHata(null);
  }

  /** Arama kutusunun altındaki "Son aramalar"dan biri */
  function sonHedefSec(h: SonHedef) {
    Keyboard.dismiss();
    setAramaOdakta(false);
    sonHedefEkle(h);
    hedefSec({ c: h.c, ad: h.ad, ayrinti: h.ayrinti });
    setOdak({ c: h.c, z: 14 });
  }

  /** Arama kutusunun altındaki listeden silme: liste açık kalsın diye kutu yeniden odaklanır (web'de basış odağı alır) */
  function sonAramayiSil(h: SonHedef) {
    sonHedefSil(h);
    aramaKutusu.current?.focus();
  }

  function yerSec(y: YerSonucu) {
    Keyboard.dismiss();
    setQ('');
    setSonuclar([]);
    sonHedefEkle({ ad: y.ad, ayrinti: y.ayrinti, c: y.coord });
    hedefSec({ c: y.coord, ad: y.ad, ayrinti: y.ayrinti });
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
      // Araba ('car') "Egzersiz olarak da kaydet" seçiminden bağımsız, hiç kaydedilmez (kaydedici zorlar)
      await baslat(activity, { id: `tarif-${Date.now()}`, name: ad, points }, null, !kaydet);
      router.push('/kayit/canli');
    } catch (e) {
      setHata(e instanceof IzinHatasi || e instanceof Error ? e.message : $t('kayit.kayit_baslatilamadi'));
    } finally {
      setBasliyor(false);
    }
  }

  const hedefAdi = hedef?.ad ?? (hedef ? $t('harita.secilen_nokta', { lat: hedef.c[1].toFixed(4), lng: hedef.c[0].toFixed(4) }) : '');
  // Hedef adının altı: "Kaş, Antalya · bulunduğun yerden"
  const hedefAlti = !baslangic ? $t('harita.konum_bekleniyor') : [hedef?.ayrinti, $t('harita.bulundugun_yerden')].filter(Boolean).join(' · ');
  const ulasimAdi = araba ? $t('harita.araba') : ACTIVITY_LABELS[activity];
  const tercihAdi = TERCIHLER().find((m) => m.id === mod)?.label ?? '';

  /** Yola çık (süren kayıt varken ona dönüş): kısa özette küçük, ayrıntının altında büyük */
  const anaDugme = (buyuk: boolean) =>
    kayitta ? (
      <Button label={$t('harita.kayda_don')} icon="record" variant="dark" big={buyuk} onPress={() => router.push('/kayit')} style={buyuk ? styles.buyukDugme : styles.ozetDugme} />
    ) : (
      <Button
        label={basliyor ? $t('harita.basliyor') : $t('harita.yola_cik')}
        icon="navigation"
        variant="sea"
        big={buyuk}
        onPress={() => void yolaCik()}
        disabled={!stats || hesapliyor || basliyor}
        style={buyuk ? styles.buyukDugme : styles.ozetDugme}
      />
    );
  const hataYazisi = gorunenHata ? (
    <Txt accessibilityRole="alert" style={styles.hata}>
      {gorunenHata}
    </Txt>
  ) : null;

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
                ref={aramaKutusu}
                value={q}
                onChangeText={setQ}
                onFocus={() => aramaOdagi(true)}
                onBlur={() => aramaOdagi(false)}
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

      {/* Arama kutusuna dokununca, bir şey yazılmadan: son aramalar (yazınca yerini arama sonuçları alır) */}
      {yolculuk && aramaOdakta && !q.trim() && sonHedefler.length ? (
        <View style={[styles.results, { top: insets.top + 64 }]}>
          <View style={styles.resultsBaslik}>
            <Txt variant="caption" accessibilityRole="header" style={{ flex: 1 }}>
              {$t('harita.son_aramalar')}
            </Txt>
            <TemizleBag onPress={sonHedefleriTemizle} />
          </View>
          {sonHedefler.map((h) => (
            <View key={`${h.ad}|${h.c.join(',')}`} style={styles.sonAramaSatiri}>
              <Pressable accessibilityRole="button" onPress={() => sonHedefSec(h)} style={[styles.result, { flex: 1, paddingRight: 0 }]}>
                <Icon name="clock" size={18} color={colors.seaInk} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                    {h.ad}
                  </Txt>
                  {h.ayrinti ? (
                    <Txt variant="small" numberOfLines={1}>
                      {h.ayrinti}
                    </Txt>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={$t('harita.son_aramayi_sil', { ad: h.ad })}
                onPress={() => sonAramayiSil(h)}
                hitSlop={6}
                style={({ pressed }) => [styles.sil, pressed && { opacity: 0.6 }]}>
                <Icon name="close" size={16} color={colors.inkMuted} strokeWidth={2} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* Bilgi paneli: tek uzun sayfa, kademeler bölümleri (bkz. panelKademesi.ts). Başta hep Yolculuk / Egzersiz
          geçişi. Yol tarifinde 1: süre ve Yola çık, 2: ayrıntı, 3: yükselti, 4: tırmanışlar ve rüzgâr. Panel
          büyüdükçe aynı sayfanın aşağısı görünür; içerik değişmez. En altta yalnızca tutamaç kalır (kapalı) */}
      <Animated.View style={[styles.sheet, panel.stil]}>
        <View style={styles.sheetIc}>
          {/* Tutamaç: her durumda sürükleme alanı. Panel kapalıyken yalnızca bu görünür; dokununca panel açılır */}
          <View onLayout={panel.tutamac} {...panel.surukle.panHandlers}>
            <Pressable
              style={styles.tutamac}
              onPress={panel.ac}
              accessibilityRole="adjustable"
              accessibilityLabel={$t('harita.bilgi_paneli')}
              accessibilityValue={{ text: panel.kapali ? $t('harita.panel_kapali') : kademeAdlari[panel.kademe] }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? panel.buyut() : panel.kucult())}>
              <View style={styles.cizgi} />
              {kademeAdlari.length > 1 ? (
                <View style={styles.kademeNoktalari}>
                  {kademeAdlari.map((ad, k) => (
                    <View key={ad} style={[styles.kademeNoktasi, !panel.kapali && k <= panel.kademe && styles.kademeNoktasiDolu]} />
                  ))}
                </View>
              ) : null}
            </Pressable>
          </View>

          {/* 1. bölüm. Geçiş (ve yol tarifinde kısa özet) sürükleme alanı. Panel kapalıyken ekran okuyucuya gizli */}
          <View onLayout={panel.bolum[0]} aria-hidden={panel.kapali}>
            <View {...panel.surukle.panHandlers}>
              <ModGecisi mod={gorev} onMod={setGorev} />
            </View>

            {!yolculuk ? (
              // Panel aşağı çekilince en azından tür şeridi görünür; rota, canlı konum ve Başlat bir sonraki bölümde
              <EgzersizSeridi style={{ marginBottom: 0 }} />
            ) : !hedef ? (
              <>
                {/* Geçmiş yalnızca arama kutusunun altında (dokununca "Son aramalar") */}
                <Txt variant="small">{gercekHarita ? $t('harita.haritaya_dokun_ya_da_ara') : $t('harita.yukaridan_ara')}</Txt>
                {!ben ? (
                  <Txt variant="small" style={{ marginTop: 4, color: colors.inkMuted }}>
                    {$t('harita.konum_bekleniyor')}
                  </Txt>
                ) : null}
              </>
            ) : (
              // Kısa özet: panel aşağı çekilince geçişle birlikte yalnızca bu satır kalır; panel büyüyünce söner
              <Animated.View
                onLayout={(e) => setKisaH(e.nativeEvent.layout.height)}
                style={{ opacity: kisaOpak ?? (kisaAcik ? 1 : 0) }}
                pointerEvents={kisaAcik ? 'auto' : 'none'}
                aria-hidden={!kisaAcik}
                {...panel.surukle.panHandlers}>
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
                  {anaDugme(false)}
                </View>
                {!baslangic ? (
                  <Txt variant="small" style={{ marginTop: 8 }}>
                    {$t('harita.konum_bekleniyor')}
                  </Txt>
                ) : null}
                {hataYazisi}
              </Animated.View>
            )}
          </View>

          {/* Egzersiz 2. bölüm: rota, canlı konum, Başlat */}
          {!yolculuk ? (
            <View onLayout={panel.bolum[1]} style={styles.bolum} aria-hidden={panel.kapali || panel.kademe < 1}>
              <EgzersizAyrinti rota={rota} onRota={setRota} kayitDurumu={kayit.durum} onBasladi={() => router.push('/kayit/canli')} />
            </View>
          ) : null}

          {/* 2. bölüm: ayrıntı (tasarımdaki "Yol tarifi, panel açık"). Kısa özetin üstüne biner (eksi üst boşluk):
              açık panelde geçişin hemen altında hedef başlar, Yola çık en altta durur */}
          {yolculuk && hedef ? (
            <Animated.View
              onLayout={panel.bolum[1]}
              style={{ marginTop: -kisaH, opacity: ayrintiOpak ?? (kisaAcik ? 0 : 1) }}
              pointerEvents={kisaAcik || panel.kapali ? 'none' : 'auto'}
              aria-hidden={kisaAcik || panel.kapali}>
              <View style={styles.hedefSatiri} {...panel.surukle.panHandlers}>
                <View style={styles.hedefIkon}>
                  <Icon name="pin" size={22} color={colors.seaInk} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt accessibilityRole="header" style={styles.hedefAd} numberOfLines={1}>
                    {hedefAdi}
                  </Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {hedefAlti}
                  </Txt>
                </View>
                {hesapliyor && anahtar ? <ActivityIndicator color={colors.sea} /> : null}
                {ben && baslangic && (ben[0] !== baslangic[0] || ben[1] !== baslangic[1]) ? (
                  <IconButton icon="rotate" label={$t('harita.konumumdan_yeniden_hesapla')} onPress={() => setBaslangic(ben)} />
                ) : null}
              </View>

              {/* Ölçüler ve yükselti (rakım varsa): parmakla gezince haritada yeri görünür */}
              <View style={styles.olculer}>
                <View style={styles.olcuSatiri}>
                  <View style={styles.olcu}>
                    <Stat label={$t('ortak.mesafe')} size={18} value={stats ? `${formatKm(stats.distanceM)} ${kmUnit()}` : '–'} />
                  </View>
                  <View style={styles.olcu}>
                    <Stat label={$t('rota_olustur.tahmini_sure')} size={18} value={tahminiSure} />
                  </View>
                  <View style={styles.olcu}>
                    <Stat label={$t('ortak.tirmanis')} size={18} value={stats && rakimVar ? $t('rota_olustur.m', { meters: formatMeters(stats.gainM) }) : '–'} />
                  </View>
                </View>
                {yolVar && egim ? (
                  <View style={{ marginTop: 10 }}>
                    <EgimProfili egim={egim} width={width - space.lg * 2 - 28} height={44} imlec={imlec} onImlec={(v) => setSecim(v == null ? null : { points, v })} />
                  </View>
                ) : null}
              </View>

              {/* Ulaşım ve yol tercihi: basılınca seçenekleri altında açılır */}
              <View style={styles.haplar}>
                <Hap
                  icon={araba ? 'car' : TUR_IKONLARI[activity]}
                  baslik={$t('harita.ulasim')}
                  deger={ulasimAdi}
                  acik={acikSecim === 'ulasim'}
                  onPress={() => setAcikSecim((a) => (a === 'ulasim' ? null : 'ulasim'))}
                />
                <Hap
                  icon="route"
                  baslik={$t('harita.yol_tercihi')}
                  deger={tercihAdi}
                  acik={acikSecim === 'tercih'}
                  onPress={() => setAcikSecim((a) => (a === 'tercih' ? null : 'tercih'))}
                />
              </View>
              {acikSecim === 'ulasim' ? (
                <View style={styles.secenekler} accessibilityRole="radiogroup" accessibilityLabel={$t('harita.ulasim')}>
                  {ACTIVITY_TYPES.map((t) => (
                    <Chip
                      key={t}
                      label={ACTIVITY_LABELS[t]}
                      icon={TUR_IKONLARI[t]}
                      role="radio"
                      selected={t === activity}
                      onPress={() => {
                        setActivity(t);
                        setAcikSecim(null);
                      }}
                    />
                  ))}
                  <Chip
                    label={$t('harita.araba')}
                    icon="car"
                    role="radio"
                    selected={araba}
                    onPress={() => {
                      setActivity('car');
                      setAcikSecim(null);
                    }}
                  />
                </View>
              ) : null}
              {acikSecim === 'tercih' ? (
                <View style={styles.secenekler} accessibilityRole="radiogroup" accessibilityLabel={$t('harita.yol_tercihi')}>
                  {TERCIHLER().map((m) => (
                    <Chip
                      key={m.id}
                      label={m.label}
                      role="radio"
                      tone="sea"
                      selected={m.id === mod}
                      onPress={() => {
                        setMod(m.id);
                        setAcikSecim(null);
                      }}
                    />
                  ))}
                </View>
              ) : null}
              {/* Araba patikaya giremez: tercih yalnızca toprak yolları açar (bkz. yonlendirme.ts > profilEkleri) */}
              {araba && mod === 'patika' ? (
                <Txt variant="small" style={{ marginBottom: 12 }}>
                  {$t('harita.araba_patika_notu')}
                </Txt>
              ) : null}

              {/* Araba yolculuğu hiç kaydedilmez; süren kayıt varken de seçim anlamsız */}
              {araba || kayitta ? null : (
                <View style={styles.kayitAnahtari}>
                  <ToggleRow
                    title={$t('harita.egzersiz_olarak_kaydet')}
                    subtitle={kaydet ? $t('harita.egzersiz_olarak_kaydet_acik') : $t('harita.egzersiz_olarak_kaydet_kapali')}
                    value={kaydet}
                    onChange={kaydetSec}
                  />
                </View>
              )}

              {hataYazisi}
              {anaDugme(true)}
              {/* Bizde adım adım yönlendirme yok: araba için hedef telefonun harita uygulamasında da açılabilir */}
              {araba ? <Button label={$t('harita.haritalarda_ac')} icon="map" variant="outline" onPress={() => void haritalardaAc()} style={{ marginTop: 10 }} /> : null}
            </Animated.View>
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

/** "Son aramalar" başlığındaki "Temizle" */
function TemizleBag({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={$t('harita.son_aramalari_temizle')} onPress={onPress} hitSlop={8} style={styles.temizle}>
      <Txt style={styles.temizleYazi}>{$t('harita.temizle')}</Txt>
    </Pressable>
  );
}

/** Açılır hap: seçili değeri gösterir, basınca seçenekleri altında açılır */
function Hap({ icon, baslik, deger, acik, onPress }: { icon: IconName; baslik: string; deger: string; acik: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: acik }}
      accessibilityLabel={`${baslik}: ${deger}`}
      accessibilityHint={$t('kayit.degistir')}
      onPress={onPress}
      style={({ pressed }) => [styles.hap, acik && styles.hapAcik, pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={18} color={colors.ink} />
      <Txt numberOfLines={1} style={styles.hapYazi}>
        {deger}
      </Txt>
      <View style={{ transform: [{ rotate: acik ? '-90deg' : '90deg' }] }}>
        <Icon name="chevron" size={14} color={colors.inkMuted} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, alignSelf: 'stretch', paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  searchKapat: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  results: { position: 'absolute', left: space.md, right: space.md, borderRadius: 16, backgroundColor: colors.surface, paddingVertical: 4, borderWidth: 1, borderColor: colors.line },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 6 },
  resultsBaslik: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 6, paddingTop: 4 },
  sonAramaSatiri: { flexDirection: 'row', alignItems: 'center' },
  sil: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  temizle: { minHeight: 32, paddingHorizontal: 8, justifyContent: 'center' },
  temizleYazi: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.seaInk },
  resultsNote: { color: colors.inkMuted, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 6 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  // Panelin içi: iç boşluklar burada, panelin boyu bunun ölçüsünden (bkz. panelKademesi.ts)
  sheetIc: { paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: PANEL_ALT_BOSLUK },
  // Alt bölümler (yükselti, tırmanışlar): üst boşluk alt boşluk kadar, bir alttaki kademede bölümün başı
  // panelin alt boşluğuna taşmasın
  bolum: { paddingTop: PANEL_ALT_BOSLUK },
  // Parmakla tutması kolay olsun diye yüksek; ortada çizgi, (birden çok kademe varsa) altında hangi kademede
  // olduğunu gösteren noktalar. Panel kapalıyken yalnızca bu görünür: alttaki boşluk tutamağın içinde ki kapalı
  // durakta altındaki geçiş görünmesin (bkz. panelKademesi.ts > kapanir)
  tutamac: { alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 34, marginTop: -6, paddingBottom: 2 },
  cizgi: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  kademeNoktalari: { flexDirection: 'row', gap: 4 },
  kademeNoktasi: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.line },
  kademeNoktasiDolu: { backgroundColor: colors.inkMuted },
  hedefSatiri: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  hedefIkon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.seaSoft, alignItems: 'center', justifyContent: 'center' },
  hedefAd: { fontFamily: fontFamily.display, fontSize: 20, lineHeight: 24, color: colors.ink },
  olculer: { padding: 14, borderRadius: 18, backgroundColor: colors.ground, marginBottom: 12 },
  olcuSatiri: { flexDirection: 'row', columnGap: 8 },
  olcu: { flex: 1, minWidth: 0 },
  haplar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  hap: { flex: 1, minWidth: 0, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  hapAcik: { borderColor: colors.ink },
  hapYazi: { flexShrink: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.ink },
  secenekler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  kayitAnahtari: { paddingHorizontal: 4, marginTop: -6, marginBottom: 8 },
  hata: { color: colors.terra, fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginTop: 8, marginBottom: 8 },
  // Ayrıntının altındaki Yola çık: tam genişlik
  buyukDugme: { height: 56 },
  // Kısa özet satırı: solda süre ve mesafe, sağda Yola çık
  ozetSatiri: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sure: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 30, color: colors.ink, letterSpacing: -0.3 },
  ozetDugme: { maxWidth: '62%', paddingHorizontal: 22 },
}));
