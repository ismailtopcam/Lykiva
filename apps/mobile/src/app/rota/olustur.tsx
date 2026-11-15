import { ACTIVITY_LABELS, ACTIVITY_TYPES, DIFFICULTY_LABELS, estimateDifficulty, estimateDuration, formatKm, formatMeters, routeStats, type ActivityType, type RoutePoint, kmUnit } from '@lykiva/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EgimProfili, imlecKonumu, TirmanisListesi, useRotaEgim } from '@/components/EgimProfili';
import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { usePanelKademesi } from '@/components/panelKademesi';
import { RotaRuzgari } from '@/components/RotaRuzgari';
import { gercekHarita, TopoMap, type MapMarker } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button, Chip, Stat } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { rotaKaydet, type Rota } from '@/data/rota';
import { konumOnizlemeBaslat, useKayit } from '@/kayit/kaydedici';
import { yerAra, type YerSonucu } from '@/lib/yerArama';
import { CIZIM_MODLARI, rotaHesapla, type CizimModu, type HesaplananRota } from '@/lib/yonlendirme';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

const GORUNURLUK = (): { id: Rota['visibility']; label: string }[] => [
  { id: 'private', label: $t('ortak.sadece_ben') },
  { id: 'followers', label: $t('ortak.takipciler') },
  { id: 'public', label: $t('ortak.herkese_acik') },
];

/** Bilgi panelinin son bölümünün altındaki boşluk (alt güvenli alan buna eklenir) */
const PANEL_ALT_BOSLUK = 16;

/** "5 sa 10 dk" */
function sureMetni(s: number) {
  const dk = Math.round(s / 60);
  const sa = Math.floor(dk / 60);
  return sa > 0 ? $t('rota_olustur.sa_dk', { sa, a: dk % 60 }) : $t('rota_olustur.dk', { dk });
}

export default function RotaOlusturScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const kayit = useKayit();
  const [mod, setMod] = useState<CizimModu>('patika');
  const [activity, setActivity] = useState<ActivityType>('hike');
  const [ad, setAd] = useState('');
  const [gorunurluk, setGorunurluk] = useState<Rota['visibility']>('private');
  const [duraklar, setDuraklar] = useState<LngLat[]>([]);
  const [sonuc, setSonuc] = useState<HesaplananRota | null>(null);
  const [hesapliyor, setHesapliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [q, setQ] = useState('');
  const [sonuclar, setSonuclar] = useState<YerSonucu[]>([]);
  const [odak, setOdak] = useState<{ c: LngLat; z: number } | null>(null);
  const ilkOdak = useRef(false);
  // Profilde seçilen nokta; rota değişince geçersiz olsun diye hangi rotaya ait olduğu da tutulur
  const [secim, setSecim] = useState<{ points: RoutePoint[]; v: number } | null>(null);

  // Başlangıçta haritayı bulunduğun yere getir
  useEffect(() => konumOnizlemeBaslat(), []);
  const sk = kayit.sonKonum;
  useEffect(() => {
    if (sk && !ilkOdak.current) {
      ilkOdak.current = true;
      setOdak({ c: [sk.lng, sk.lat], z: 14 });
    }
  }, [sk]);

  // Duraklar, mod veya aktivite değişince rotayı yeniden hesapla
  useEffect(() => {
    if (duraklar.length < 2) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      setHesapliyor(true);
      setHata(null);
      rotaHesapla(duraklar, mod, activity, ac.signal)
        .then((r) => setSonuc(r))
        .catch((e) => {
          if (e?.name !== 'AbortError') setHata(e instanceof Error ? e.message : $t('rota_olustur.rota_hesaplanamadi'));
        })
        .finally(() => !ac.signal.aborted && setHesapliyor(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [duraklar, mod, activity]);

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

  // İki noktadan azsa eski hesap/sonuç gösterilmez
  const yeterli = duraklar.length >= 2;
  const gorunenSonuclar = q.trim().length >= 2 ? sonuclar : [];
  const gorunenHata = yeterli ? hata : null;
  const points = useMemo(() => (yeterli && sonuc ? sonuc.points : []), [yeterli, sonuc]);
  const stats = useMemo(() => (points.length > 1 ? routeStats(points) : null), [points]);
  const zorluk = stats ? estimateDifficulty(activity, stats.distanceM, stats.gainM) : null;
  const rakimVar = points.some((p) => p.alt != null);
  const cizgi: LngLat[] = points.map((p) => [p.lng, p.lat]);
  const egim = useRotaEgim(points);
  const imlec = secim && secim.points === points ? secim.v : null;
  const imlecYeri = imlecKonumu(points, egim, imlec);

  // Bilgi paneli Harita sekmesindeki gibi parmakla sürüklenir (bkz. panelKademesi.ts). Açılışta en altta: kısa özet
  // ve Rotayı kaydet. Yukarı çekince ayrıntı (ad, etkinlik, ölçüler, profil, zemin, görünürlük), rota varsa en üstte
  // tırmanışlar ve rüzgâr. Aşağı çekince yalnızca tutamaç kalır, harita açılır.
  const kademeAdlari = points.length > 1
    ? [$t('harita.panel_kisa'), $t('harita.panel_ozet'), egim ? $t('egimProfili.tirmanislar') : $t('rotaRuzgari.simdiki_ruzgar')]
    : [$t('harita.panel_kisa'), $t('harita.panel_ozet')];
  const altBosluk = PANEL_ALT_BOSLUK + insets.bottom;
  const panel = usePanelKademesi({ ilk: 0, sayi: kademeAdlari.length, altBosluk, kapanir: true, kapaliAltBosluk: insets.bottom });
  // Harita kamerası panelin oturduğu yüksekliğe göre (sürüklerken değişmez)
  const panelH = panel.gorunenH || 160;
  // Çizim modları panelin üstünde yüzer, sürüklerken panelle birlikte kayar
  const modlarAlt = useMemo(() => Animated.add(panel.yukseklik, 12), [panel.yukseklik]);
  const tahminiSure = stats ? sureMetni(estimateDuration(activity, stats.distanceM, rakimVar ? stats.gainM : 0)) : '–';

  const markers: MapMarker[] = duraklar.map((c, i) => ({
    id: `d${i}`,
    coord: c,
    kind: i === 0 ? 'start' : i === duraklar.length - 1 && duraklar.length > 1 ? 'end' : 'stop',
    text: i > 0 && i < duraklar.length - 1 ? String(i) : undefined,
    // Duraklar büyük çizilir; üstüne dokununca kaldırılır
    basilir: true,
  }));
  if (imlecYeri) markers.push({ id: 'imlec', coord: imlecYeri, kind: 'cursor' });

  const zemin = yeterli ? sonuc?.surface : null;
  const zeminler = zemin
    ? [
        { label: $t('rota_olustur.asfalt'), pct: Math.round(zemin.asphalt * 100), color: colors.ink },
        { label: $t('rota_olustur.toprak_yol'), pct: Math.round(zemin.gravel * 100), color: colors.ochre },
        { label: $t('rota_olustur.patika'), pct: Math.round(zemin.trail * 100), color: colors.sea },
      ].filter((z) => z.pct > 0)
    : [];

  async function onKaydet() {
    if (!stats || !zorluk) return;
    setKaydediyor(true);
    setHata(null);
    try {
      const id = await rotaKaydet({
        name: ad.trim() || $t('rota_olustur.rotasi', { a: ACTIVITY_LABELS[activity] }),
        activity,
        points,
        difficulty: zorluk,
        surface: zemin ?? null,
        visibility: gorunurluk,
      });
      router.replace({ pathname: '/rota/[id]', params: { id } });
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('ortak.kaydedilemedi'));
      setKaydediyor(false);
    }
  }

  function yerSec(y: YerSonucu) {
    Keyboard.dismiss();
    setQ('');
    setSonuclar([]);
    setOdak({ c: y.coord, z: 15 });
  }

  return (
    <View style={styles.root}>
      <TopoMap
        style={StyleSheet.absoluteFill}
        route={cizgi.length > 1 ? cizgi : undefined}
        routeColors={egim?.renkler}
        markers={markers}
        follow={odak?.c ?? null}
        followZoom={odak?.z}
        onPress={(c) => setDuraklar((d) => [...d, c])}
        onMarkerPress={(id) => {
          const i = Number(id.slice(1));
          if (id.startsWith('d') && Number.isInteger(i)) setDuraklar((d) => d.filter((_c, k) => k !== i));
        }}
        katmanDugmesi={{ top: insets.top + 58 }}
        padding={{ top: 120, bottom: panelH + 40 }}
        accessibilityLabel={$t('rota_olustur.rota_cizim_haritasi_nokta', { length: duraklar.length })}
      />
      <FloatingHeader
        left={<IconButton floating icon="close" label={$t('ortak.kapat')} onPress={() => router.back()} />}
        middle={
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.inkMuted} strokeWidth={2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={$t('rota_olustur.yer_patika_veya_zirve')}
              placeholderTextColor={colors.inkMuted}
              accessibilityLabel={$t('rota_olustur.yer_ara')}
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
        }
        right={<IconButton floating icon="undo" label={$t('rota_olustur.son_noktayi_geri_al')} onPress={() => setDuraklar((d) => d.slice(0, -1))} />}
      />

      {gorunenSonuclar.length ? (
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

      <Animated.View style={[styles.modes, { bottom: modlarAlt }]} accessibilityRole="radiogroup">
        {CIZIM_MODLARI().map((m) => (
          <View key={m.id} style={styles.modeWrap}>
            <Chip label={m.label} role="radio" selected={m.id === mod} onPress={() => setMod(m.id)} />
          </View>
        ))}
      </Animated.View>

      <Animated.View style={[styles.sheet, panel.stil]}>
        <View style={[styles.sheetIc, { paddingBottom: altBosluk }]}>
          {/* Tutamaç: sürükleme alanı. Panel kapalıyken yalnızca bu görünür; dokununca panel açılır */}
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
              <View style={styles.kademeNoktalari}>
                {kademeAdlari.map((k, i) => (
                  <View key={k} style={[styles.kademeNoktasi, !panel.kapali && i <= panel.kademe && styles.kademeNoktasiDolu]} />
                ))}
              </View>
            </Pressable>
          </View>

          {/* 1. bölüm: kısa özet (ya da nasıl çizileceği) ve Rotayı kaydet; sürükleme alanı */}
          <View onLayout={panel.bolum[0]} aria-hidden={panel.kapali} {...panel.surukle.panHandlers}>
            {!gercekHarita ? (
              <Txt variant="small" style={styles.note}>
                {$t('rota_olustur.haritaya_dokunarak_rota_cizmek')}
              </Txt>
            ) : duraklar.length < 2 ? (
              <>
                <Txt variant="small" style={styles.note}>
                  {duraklar.length === 0 ? $t('rota_olustur.baslangic_noktasi_icin_haritaya') : $t('rota_olustur.sonraki_noktaya_dokun_patika')}
                </Txt>
                <Txt variant="small" style={[styles.note, { color: colors.inkMuted }]}>
                  {$t('rota_olustur.yalnizca_turkiye')}
                </Txt>
              </>
            ) : null}
            {gercekHarita && duraklar.length ? (
              <Txt variant="small" style={[styles.note, { color: colors.inkMuted }]}>
                {$t('rota_olustur.nokta_kaldir_ipucu')}
              </Txt>
            ) : null}
            {yeterli ? (
              <View style={styles.ozetSatiri}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={styles.ozetMesafe} numberOfLines={1} adjustsFontSizeToFit>
                    {stats ? `${formatKm(stats.distanceM)} ${kmUnit()}` : '–'}
                  </Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {[stats && rakimVar ? $t('rota_olustur.m', { meters: formatMeters(stats.gainM) }) : null, stats ? tahminiSure : $t('rota_olustur.tahmini_sure')].filter(Boolean).join(' · ')}
                  </Txt>
                </View>
                {hesapliyor ? <ActivityIndicator color={colors.terra} /> : null}
                <Button
                  label={kaydediyor ? $t('ortak.kaydediliyor') : $t('rota_olustur.rotayi_kaydet')}
                  icon="route"
                  onPress={onKaydet}
                  disabled={!stats || hesapliyor || kaydediyor}
                  style={styles.ozetDugme}
                />
              </View>
            ) : null}
            {gorunenHata ? (
              <Txt accessibilityRole="alert" style={{ color: colors.terra, fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginTop: 8 }}>
                {gorunenHata}
              </Txt>
            ) : null}
          </View>

          {/* 2. bölüm: ayrıntı */}
          <View onLayout={panel.bolum[1]} style={styles.bolum} aria-hidden={panel.kapali || panel.kademe < 1}>
            <TextInput value={ad} onChangeText={setAd} placeholder={$t('rota_olustur.rota_adi')} placeholderTextColor={colors.inkMuted} accessibilityLabel={$t('rota_olustur.rota_adi')} style={styles.nameInput} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 10 }} accessibilityRole="radiogroup">
              {ACTIVITY_TYPES.map((t) => (
                <Chip key={t} label={ACTIVITY_LABELS[t]} role="radio" selected={t === activity} onPress={() => setActivity(t)} />
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, columnGap: 10, marginBottom: 12 }}>
              <Stat label={$t('ortak.mesafe')} size={18} value={stats ? `${formatKm(stats.distanceM)} ${kmUnit()}` : '–'} />
              <Stat label={$t('ortak.tirmanis')} size={18} value={stats && rakimVar ? $t('rota_olustur.m', { meters: formatMeters(stats.gainM) }) : '–'} />
              <Stat label={$t('ortak.inis')} size={18} value={stats && rakimVar ? $t('rota_olustur.m_2', { meters: formatMeters(stats.lossM) }) : '–'} />
              <Stat label={$t('rota_olustur.tahmini_sure')} size={18} value={tahminiSure} />
            </View>

            {egim ? (
              <View style={{ marginBottom: 12 }}>
                <EgimProfili egim={egim} width={width - space.lg * 2} height={64} imlec={imlec} onImlec={(v) => setSecim(v == null ? null : { points, v })} />
              </View>
            ) : stats && mod === 'serbest' ? (
              <Txt variant="small" style={{ marginBottom: 12 }}>
                {$t('rota_olustur.serbest_cizimde_yukseklik_ve')}
              </Txt>
            ) : null}

            {zeminler.length ? (
              <>
                <View style={styles.bar} accessible accessibilityLabel={zeminler.map((z) => $t('rota_olustur.yuzde', { label: z.label, pct: z.pct })).join(', ')}>
                  {zeminler.map((z) => (
                    <View key={z.label} style={{ flex: z.pct, backgroundColor: z.color }} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                  {zeminler.map((z) => (
                    <View key={z.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: z.color }} />
                      <Txt variant="small">
                        {z.label} %{z.pct}
                      </Txt>
                    </View>
                  ))}
                  {zorluk ? <Txt variant="small">· {DIFFICULTY_LABELS[zorluk]}</Txt> : null}
                </View>
              </>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }} accessibilityRole="radiogroup">
              {GORUNURLUK().map((g) => (
                <Chip key={g.id} label={g.label} role="radio" tone="sea" selected={g.id === gorunurluk} onPress={() => setGorunurluk(g.id)} />
              ))}
            </View>
          </View>

          {/* 3. bölüm (rota varsa): tırmanışlar ve rüzgâr; uzunsa içi kayar, harita görünür kalır */}
          {points.length > 1 ? (
            <View onLayout={panel.bolum[2]} style={styles.bolum} aria-hidden={panel.kapali || panel.kademe < 2}>
              <ScrollView style={{ maxHeight: height * 0.4 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
  results: { position: 'absolute', left: space.md, right: space.md, borderRadius: 16, backgroundColor: colors.surface, paddingVertical: 4, borderWidth: 1, borderColor: colors.line },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 6 },
  resultsNote: { color: colors.inkMuted, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 6 },
  modes: { position: 'absolute', left: space.md, flexDirection: 'row', gap: 8 },
  modeWrap: { borderRadius: 18, backgroundColor: colors.surface },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  // Panelin içi: iç boşluklar burada, panelin boyu bunun ölçüsünden (bkz. panelKademesi.ts)
  sheetIc: { paddingHorizontal: space.lg, paddingTop: 10 },
  // Alt bölümler: üst boşluk alt boşluk kadar, bir alttaki kademede bölümün başı panelin alt boşluğuna taşmasın
  bolum: { paddingTop: PANEL_ALT_BOSLUK },
  // Harita sekmesindeki tutamaçla aynı: çizgi ve hangi kademede olduğunu gösteren noktalar
  tutamac: { alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 34, marginTop: -6, paddingBottom: 2 },
  cizgi: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  kademeNoktalari: { flexDirection: 'row', gap: 4 },
  kademeNoktasi: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.line },
  kademeNoktasiDolu: { backgroundColor: colors.inkMuted },
  ozetSatiri: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ozetMesafe: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 30, color: colors.ink, letterSpacing: -0.3 },
  ozetDugme: { maxWidth: '58%', paddingHorizontal: 20 },
  note: { marginBottom: 6 },
  nameInput: { fontFamily: fontFamily.display, fontSize: 22, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 6 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
}));
