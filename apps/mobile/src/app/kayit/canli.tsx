import { ACTIVITY_LABELS, formatDuration, formatKm, formatMeters, formatSpeedKmh, OFF_ROUTE_M, kmUnit, mUnit, type RoutePoint } from '@lykiva/shared';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnaSayfaDugmesi } from '@/components/AnaSayfaDugmesi';
import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { useKoyuHarita } from '@/components/map/gunduzGece';
import { useHaritaTuru } from '@/components/map/haritaTurleri';
import { YolHaritasi } from '@/components/map/YolHaritasi';
import { Txt } from '@/components/Txt';
import { Stat } from '@/components/ui';
import { bitir, duraklat, iptalEt } from '@/kayit/kaydedici';
import { kisaSure, rotaBilgisi, useCanliVeri } from '@/kayit/istatistik';
import { colors, fontFamily, space } from '@/theme';
import { $t } from '@/i18n';

const n = colors.night;
const BOS: RoutePoint[] = [];

/** Bilgi panelinin boyu: küçük (tek satır), normal, tam ekran (harita kapanır) */
type PanelBoyu = 'kucuk' | 'normal' | 'tam';
const BOYLAR: PanelBoyu[] = ['kucuk', 'normal', 'tam'];

type Deger = { label: string; value: string; unit?: string; vurgu?: boolean };

export default function CanliTakipScreen() {
  const insets = useSafeAreaInsets();
  const veri = useCanliVeri();
  const { kayit, stats, anlikHiz, aktifS, iz, ben, gpsDogruluk } = veri;
  const rb = rotaBilgisi(veri);
  const [takip, setTakip] = useState(true);
  const [boy, setBoy] = useState<PanelBoyu>('normal');
  const [kaydediyor, setKaydediyor] = useState(false);
  const haritaTuru = useHaritaTuru();
  const koyuHarita = useKoyuHarita() && haritaTuru !== 'kis';

  const buyut = () => setBoy((b) => BOYLAR[Math.min(BOYLAR.indexOf(b) + 1, BOYLAR.length - 1)]);
  const kucult = () => setBoy((b) => BOYLAR[Math.max(BOYLAR.indexOf(b) - 1, 0)]);
  // Tutamacı yukarı kaydır: büyüt, aşağı kaydır: küçült
  const [surukle] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -30) buyut();
        else if (g.dy > 30) kucult();
      },
    }),
  );

  if (kaydediyor) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <StatusBar style="light" />
        <ActivityIndicator color={n.accent} />
        <Txt style={styles.pillText}>{$t('ortak.kaydediliyor')}</Txt>
      </View>
    );
  }
  if (kayit.durum === 'bos') return <Redirect href="/kayit" />;
  if (kayit.durum === 'duraklatildi') return <Redirect href="/kayit/duraklatildi" />;

  const hiz = anlikHiz == null ? '—' : formatSpeedKmh(anlikHiz);
  const zayif = gpsDogruluk == null || gpsDogruluk > 30;
  const tam = boy === 'tam';
  const kucuk = boy === 'kucuk';
  const yetersiz = kayit.segments.flat().length < 2;

  const yapilan: Deger = { label: $t('kayit_canli.yapilan'), value: formatKm(stats.distanceM), unit: kmUnit() };
  const sure: Deger = { label: $t('ortak.sure'), value: formatDuration(aktifS) };
  const ortHiz: Deger = { label: $t('ortak.ort_hiz'), value: formatSpeedKmh(stats.avgMovingSpeed) };
  const tirmanis: Deger = { label: $t('ortak.tirmanis'), value: formatMeters(stats.gainM), unit: mUnit() };
  const kalan: Deger | null = rb ? { label: $t('kayit_canli.kalan'), value: formatKm(rb.kalanM), unit: kmUnit() } : null;
  const degerler: Deger[] =
    rb && kalan
      ? [yapilan, kalan, { label: $t('kayit_canli.varisa'), ...kisaSure(rb.varisS), vurgu: true }, sure, ortHiz, tirmanis]
      : [
          yapilan,
          { ...sure, vurgu: true },
          ortHiz,
          { label: $t('ortak.maks_hiz'), value: formatSpeedKmh(stats.maxSpeed) },
          tirmanis,
          { label: $t('kayit_canli.rakim'), value: kayit.sonKonum?.alt != null ? formatMeters(kayit.sonKonum.alt) : '–', unit: mUnit() },
        ];
  // Küçük panelde tek satır: mesafe (rotada kalan), süre, anlık hız
  const kucukDegerler: Deger[] = [kalan ?? yapilan, sure, { label: $t('kayit_canli.anlik_hiz'), value: hiz, unit: $t('kayit_canli.km_sa') }];
  const degerBoyu = tam ? 38 : kucuk ? 24 : 26;

  async function onDuraklat() {
    await duraklat();
    router.replace('/kayit/duraklatildi');
  }

  async function kaydet() {
    setKaydediyor(true);
    const hedef = await bitir();
    if (hedef) router.replace({ pathname: '/aktivite/[id]', params: { id: hedef } });
    else router.replace('/');
  }

  async function sil() {
    await iptalEt();
    router.replace('/');
  }

  function onBitir() {
    if (Platform.OS === 'web') {
      void (yetersiz ? sil() : kaydet());
      return;
    }
    if (yetersiz) {
      Alert.alert($t('kayit_canli.kayit_bitirilsin_mi'), $t('kayit_duraklatildi.kaydetmek_icin_henuz_yeterli'), [
        { text: $t('ortak.vazgec'), style: 'cancel' },
        { text: $t('kayit_duraklatildi.kaydi_sil'), style: 'destructive', onPress: () => void sil() },
      ]);
      return;
    }
    Alert.alert($t('kayit_canli.kayit_bitirilsin_mi'), $t('kayit_canli.kayit_kaydedilip_aktivite'), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      { text: $t('kayit_duraklatildi.bitir_ve_kaydet'), onPress: () => void kaydet() },
    ]);
  }

  // Sol üst: ana sayfaya dönüş (kayıt sürer; iOS'ta geri hareketi kapalı) + kayıt rozeti
  const kayittaRozeti = (
    <View style={styles.solUst}>
      <AnaSayfaDugmesi />
      <View style={styles.pill}>
        <View style={[styles.dot, { backgroundColor: n.recording }]} />
        <Txt style={styles.pillText}>{$t('kayit_canli.kayitta', { a: ACTIVITY_LABELS[kayit.activity] })}</Txt>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Harita görünüm ayarına göre açık ya da koyu; durum çubuğu üstünde okunsun */}
      <StatusBar style={tam || koyuHarita || haritaTuru === 'uydu' || haritaTuru === 'hibrit' ? 'light' : 'dark'} />
      {/* Harita sekmesiyle ortak harita: kalan yol eğime göre renkli, 3B/2B ve konum (takip) düğmeleri */}
      <YolHaritasi
        koyu
        style={{ flex: 1 }}
        points={kayit.rota?.points ?? BOS}
        iz={iz}
        progress={rb ? Math.max(0.001, rb.kesir) : undefined}
        ben={ben}
        markers={
          kayit.rota && kayit.rota.points.length > 1
            ? [
                { id: 'start', coord: [kayit.rota.points[0].lng, kayit.rota.points[0].lat], kind: 'start' },
                { id: 'end', coord: [kayit.rota.points[kayit.rota.points.length - 1].lng, kayit.rota.points[kayit.rota.points.length - 1].lat], kind: 'end' },
              ]
            : []
        }
        onKonum={() => setTakip(true)}
        konumSecili={takip}
        ustBosluk={insets.top + 6}
        follow={takip ? ben : null}
        onKullaniciOynatti={() => setTakip(false)}
        padding={{ top: 60, bottom: 40 }}
        accessibilityLabel={rb ? $t('kayit_canli.canli_rota_haritasi_tamamlanan', { ad: rb.ad }) : $t('kayit_canli.canli_kayit_haritasi_simdiye')}
      />
      {tam ? null : (
        <FloatingHeader
          left={kayittaRozeti}
          // Sağ üst köşe haritanın katman düğmesinde; boş yer tutucu dokunmayı engellemesin
          right={<View />}
        />
      )}

      <View style={[styles.panel, tam && [styles.panelTam, { paddingTop: insets.top + 6 }], { paddingBottom: insets.bottom + 8 }]}>
        <View
          {...surukle.panHandlers}
          style={styles.tutamac}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={$t('kayit_canli.bilgi_paneli')}
          accessibilityValue={{ text: tam ? $t('kayit_canli.panel_tam') : kucuk ? $t('kayit_canli.panel_kucuk') : $t('kayit_canli.panel_normal') }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? buyut() : kucult())}>
          <View style={styles.tutamacSol}>{tam ? kayittaRozeti : null}</View>
          <View style={styles.cizgi} />
          <View style={styles.tutamacSag}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={$t('kayit_canli.paneli_kucult')}
              disabled={kucuk}
              onPress={kucult}
              hitSlop={6}
              style={[styles.boyDugmesi, kucuk && { opacity: 0.3 }]}>
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <Icon name="chevron" size={18} color={n.text} strokeWidth={2.4} />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={$t('kayit_canli.paneli_buyut')}
              disabled={tam}
              onPress={buyut}
              hitSlop={6}
              style={[styles.boyDugmesi, tam && { opacity: 0.3 }]}>
              <View style={{ transform: [{ rotate: '-90deg' }] }}>
                <Icon name="chevron" size={18} color={n.text} strokeWidth={2.4} />
              </View>
            </Pressable>
          </View>
        </View>

        {rb && rb.sapmaM > OFF_ROUTE_M ? (
          <View style={[styles.warn, { backgroundColor: '#3A1D17' }]} accessibilityRole="alert">
            <Txt style={[styles.warnText, { color: n.accentSoft }]}>{$t('kayit_canli.rotadan_m_uzaktasin', { meters: formatMeters(rb.sapmaM) })}</Txt>
          </View>
        ) : !kayit.arkaPlan ? (
          <View style={styles.warn} accessibilityRole="alert">
            <Txt style={styles.warnText}>{$t('kayit_canli.arka_plan_konum_izni')}</Txt>
          </View>
        ) : zayif ? (
          <View style={styles.warn} accessibilityLiveRegion="polite">
            <Txt style={styles.warnText}>{$t('kayit_canli.gps_sinyali_zayif_acik')}</Txt>
          </View>
        ) : null}
        {kayit.paylasim && !kucuk ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={$t('kayit_canli.konumun_grubuyla_canli_paylasiliyor', { ad: kayit.paylasim.ad })}
            onPress={() => router.push({ pathname: '/canli-harita', params: { grup: kayit.paylasim!.id } })}
            style={styles.paylasim}>
            <View style={[styles.dot, { backgroundColor: n.sea }]} />
            <Txt style={[styles.pillText, { flex: 1 }]} numberOfLines={1}>
              {$t('kayit_canli.canli_paylasiliyor', { ad: kayit.paylasim.ad })}</Txt>
            <Txt style={[styles.pillText, { color: n.sea }]}>{$t('kayit_canli.harita')}</Txt>
          </Pressable>
        ) : null}

        {kucuk ? (
          <View style={styles.grid}>
            {kucukDegerler.map((d) => (
              <View key={d.label} style={styles.cell}>
                <Stat label={d.label} value={d.value} unit={d.unit} size={degerBoyu} color={d.vurgu ? n.accentSoft : n.text} muted={n.textMuted} />
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={[{ alignItems: 'center' }, tam && { marginTop: 'auto' }]}>
              <Txt variant="label" color={n.textMuted}>
                {$t('kayit_canli.anlik_hiz')}</Txt>
              <Txt
                style={[styles.hero, tam ? styles.heroTam : rb ? { fontSize: 50, lineHeight: 54 } : null]}
                accessibilityLabel={anlikHiz == null ? $t('kayit_canli.anlik_hiz_bilinmiyor_gps') : $t('kayit_canli.anlik_hiz_kilometre_saat', { hiz })}>
                {hiz}
                <Txt style={[styles.heroUnit, tam && { fontSize: 24 }]}> {$t('kayit_canli.km_sa')}</Txt>
              </Txt>
            </View>

            {rb ? (
              <View style={{ marginTop: tam ? 16 : 6 }}>
                <View style={styles.track} accessibilityLabel={$t('kayit_canli.rotanin_yuzde_i_tamamlandi', { round: Math.round(rb.kesir * 100) })}>
                  <View style={[styles.fill, { width: `${Math.min(100, rb.kesir * 100)}%` }]} />
                </View>
                <View style={styles.trackLabels}>
                  <Txt variant="small" color={n.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                    {rb.ad}
                  </Txt>
                  <Txt variant="small" color={n.textMuted}>
                    %{Math.round(rb.kesir * 100)}
                  </Txt>
                </View>
              </View>
            ) : null}

            <View style={[styles.grid, tam && styles.gridTam]}>
              {degerler.map((d) => (
                <View key={d.label} style={tam ? styles.cellTam : styles.cell}>
                  <Stat label={d.label} value={d.value} unit={d.unit} size={degerBoyu} color={d.vurgu ? n.accentSoft : n.text} muted={n.textMuted} />
                </View>
              ))}
            </View>
            <Txt variant="small" color={n.textMuted} style={{ marginTop: 6, fontSize: 11, lineHeight: 14 }}>
              {rb
                ? $t('kayit_canli.varis_suresi_su_ana', { a: rb.varisSaati ? $t('kayit_canli.tahmini_varis', { varisSaati: rb.varisSaati }) : '' })
                : $t('kayit_canli.sure_duraklatmalari_icermez_ortalama')}
            </Txt>
          </>
        )}

        <View style={[styles.controls, tam && { marginTop: 'auto' }]}>
          <View style={styles.kontrol}>
            <Pressable accessibilityRole="button" accessibilityLabel={$t('kayit_canli.duraklat')} onPress={onDuraklat} style={[styles.dugme, styles.duraklat]}>
              <Icon name="pause" size={26} color={n.ground} strokeWidth={3.2} />
            </Pressable>
            <Txt style={styles.kontrolYazi}>{$t('kayit_canli.duraklat')}</Txt>
          </View>
          <View style={styles.kontrol}>
            <Pressable accessibilityRole="button" accessibilityLabel={$t('kayit_canli.bitir')} onPress={onBitir} style={[styles.dugme, styles.bitir]}>
              <Icon name="stop" size={22} color={n.recording} />
            </Pressable>
            <Txt style={styles.kontrolYazi}>{$t('kayit_canli.bitir')}</Txt>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paylasim: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 32, borderRadius: 10, backgroundColor: n.surface, marginBottom: 6 },
  root: { flex: 1, backgroundColor: n.ground },
  solUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(14,21,18,0.85)' },
  pillText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: n.text },
  dot: { width: 9, height: 9, borderRadius: 5 },
  // Harita kalan bütün alanı alır; panel yalnızca içeriği kadar yer kaplar
  panel: { marginTop: -18, backgroundColor: n.ground, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 4 },
  // Tam ekran: haritanın üstünü kaplar (harita yerinde kalır, yeniden yüklenmez)
  panelTam: { ...StyleSheet.absoluteFill, marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, zIndex: 20 },
  tutamac: { flexDirection: 'row', alignItems: 'center', minHeight: 36, marginBottom: 2 },
  tutamacSol: { flex: 1, alignItems: 'flex-start' },
  cizgi: { width: 40, height: 4, borderRadius: 2, backgroundColor: n.line },
  tutamacSag: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  boyDugmesi: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: n.surface },
  warn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#2A2418', marginBottom: 6 },
  warnText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: n.paused },
  hero: { fontFamily: fontFamily.displayHeavy, fontSize: 58, lineHeight: 62, color: n.text, letterSpacing: -2.5 },
  heroTam: { fontSize: 104, lineHeight: 110, letterSpacing: -4 },
  heroUnit: { fontFamily: fontFamily.bodySemiBold, fontSize: 18, letterSpacing: 0, color: n.textMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: '#24302B', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: n.accent, borderRadius: 3 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, marginTop: 6 },
  gridTam: { rowGap: 20, marginTop: 24 },
  cell: { width: '33.33%' },
  cellTam: { width: '50%' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 40, paddingTop: space.sm },
  kontrol: { alignItems: 'center', gap: 4 },
  kontrolYazi: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: n.textMuted },
  dugme: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  duraklat: { backgroundColor: n.accent },
  bitir: { backgroundColor: n.surface, borderWidth: 2, borderColor: n.recording },
});
