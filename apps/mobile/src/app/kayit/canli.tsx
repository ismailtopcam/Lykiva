import { ACTIVITY_LABELS, formatDuration, formatKm, formatMeters, formatSpeedKmh, OFF_ROUTE_M, kmUnit, mUnit } from '@lykiva/shared';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { gercekHarita, TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Stat } from '@/components/ui';
import { duraklat } from '@/kayit/kaydedici';
import { kisaSure, rotaBilgisi, useCanliVeri } from '@/kayit/istatistik';
import { colors, fontFamily, space } from '@/theme';
import { $t } from '@/i18n';

const n = colors.night;

export default function CanliTakipScreen() {
  const insets = useSafeAreaInsets();
  const veri = useCanliVeri();
  const { kayit, stats, anlikHiz, aktifS, iz, ben, gpsDogruluk } = veri;
  const rb = rotaBilgisi(veri);
  const [takip, setTakip] = useState(true);
  const [ucBoyut, setUcBoyut] = useState(false);

  if (kayit.durum === 'bos') return <Redirect href="/kayit" />;
  if (kayit.durum === 'duraklatildi') return <Redirect href="/kayit/duraklatildi" />;

  const hiz = anlikHiz == null ? '—' : formatSpeedKmh(anlikHiz);
  const zayif = gpsDogruluk == null || gpsDogruluk > 30;

  async function onDuraklat() {
    await duraklat();
    router.replace('/kayit/duraklatildi');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <TopoMap
        dark
        style={{ flex: 1 }}
        route={kayit.rota ? kayit.rota.points.map((p) => [p.lng, p.lat] as [number, number]) : iz}
        progress={rb ? Math.max(0.001, rb.kesir) : undefined}
        markers={[
          ...(kayit.rota && kayit.rota.points.length > 1
            ? [{ id: 'end', coord: [kayit.rota.points[kayit.rota.points.length - 1].lng, kayit.rota.points[kayit.rota.points.length - 1].lat] as [number, number], kind: 'end' as const }]
            : []),
          ...(ben ? [{ id: 'me', coord: ben, kind: 'me' as const }] : []),
        ]}
        follow={takip ? ben : null}
        ucBoyut={ucBoyut}
        onKullaniciOynatti={() => setTakip(false)}
        katmanDugmesi={{ top: insets.top + 6 }}
        padding={{ top: 60, bottom: 40 }}
        accessibilityLabel={rb ? $t('kayit_canli.canli_rota_haritasi_tamamlanan', { ad: rb.ad }) : $t('kayit_canli.canli_kayit_haritasi_simdiye')}
      />
      <FloatingHeader
        left={
          <View style={styles.pill}>
            <View style={[styles.dot, { backgroundColor: n.recording }]} />
            <Txt style={styles.pillText}>{$t('kayit_canli.kayitta', { a: ACTIVITY_LABELS[kayit.activity] })}</Txt>
          </View>
        }
        // Sağ üst köşe haritanın katman düğmesinde; boş yer tutucu dokunmayı engellemesin
        right={<View />}
      />
      {gercekHarita ? (
        <View style={[styles.haritaDugmeleri, { top: insets.top + 6 + 44 + 8 }]} pointerEvents="box-none">
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: ucBoyut }}
            accessibilityLabel={$t('kayit_canli.uc_boyutlu_gorunum')}
            onPress={() => setUcBoyut((u) => !u)}
            hitSlop={4}
            style={({ pressed }) => [styles.haritaDugmesi, pressed && { opacity: 0.6 }]}>
            <Txt style={[styles.haritaDugmesiYazi, ucBoyut && { color: n.accent }]}>{ucBoyut ? '3D' : '2D'}</Txt>
          </Pressable>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: takip }}
            accessibilityLabel={$t('kayit_canli.konumum')}
            onPress={() => setTakip(true)}
            hitSlop={4}
            style={({ pressed }) => [styles.haritaDugmesi, pressed && { opacity: 0.6 }]}>
            <Icon name="target" size={22} color={takip ? n.accent : n.text} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.panel, { paddingBottom: insets.bottom + 8 }]}>
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
        {kayit.paylasim ? (
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

        <View style={{ alignItems: 'center' }}>
          <Txt variant="label" color={n.textMuted}>
            {$t('kayit_canli.anlik_hiz')}</Txt>
          <Txt style={[styles.hero, rb && { fontSize: 50, lineHeight: 54 }]} accessibilityLabel={anlikHiz == null ? $t('kayit_canli.anlik_hiz_bilinmiyor_gps') : $t('kayit_canli.anlik_hiz_kilometre_saat', { hiz })}>
            {hiz}
            <Txt style={styles.heroUnit}> {$t('kayit_canli.km_sa')}</Txt>
          </Txt>
        </View>

        {rb ? (
          <View style={{ marginTop: 6 }}>
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

        {rb ? (
          <View style={styles.grid}>
            <View style={styles.cell}><Stat label={$t('kayit_canli.yapilan')} value={formatKm(stats.distanceM)} unit={kmUnit()} size={26} color={n.text} muted={n.textMuted} /></View>
            <View style={styles.cell}><Stat label={$t('kayit_canli.kalan')} value={formatKm(rb.kalanM)} unit={kmUnit()} size={26} color={n.text} muted={n.textMuted} /></View>
            <View style={styles.cell}><Stat label={$t('kayit_canli.varisa')} value={kisaSure(rb.varisS).value} unit={kisaSure(rb.varisS).unit} size={26} color={n.accentSoft} muted={n.textMuted} /></View>
            <View style={styles.cell}><Stat label={$t('ortak.sure')} value={formatDuration(aktifS)} size={26} color={n.text} muted={n.textMuted} /></View>
            <View style={styles.cell}><Stat label={$t('ortak.ort_hiz')} value={formatSpeedKmh(stats.avgMovingSpeed)} size={26} color={n.text} muted={n.textMuted} /></View>
            <View style={styles.cell}><Stat label={$t('ortak.tirmanis')} value={formatMeters(stats.gainM)} unit={mUnit()} size={26} color={n.text} muted={n.textMuted} /></View>
          </View>
        ) : (
        <View style={styles.grid}>
          <View style={styles.cell}><Stat label={$t('kayit_canli.yapilan')} value={formatKm(stats.distanceM)} unit={kmUnit()} size={26} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label={$t('ortak.sure')} value={formatDuration(aktifS)} size={26} color={n.accentSoft} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label={$t('ortak.ort_hiz')} value={formatSpeedKmh(stats.avgMovingSpeed)} size={26} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label={$t('ortak.maks_hiz')} value={formatSpeedKmh(stats.maxSpeed)} size={26} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label={$t('ortak.tirmanis')} value={formatMeters(stats.gainM)} unit={mUnit()} size={26} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}>
            <Stat label={$t('kayit_canli.rakim')} value={kayit.sonKonum?.alt != null ? formatMeters(kayit.sonKonum.alt) : '–'} unit={mUnit()} size={26} color={n.text} muted={n.textMuted} />
          </View>
        </View>
        )}
        <Txt variant="small" color={n.textMuted} style={{ marginTop: 6, fontSize: 11, lineHeight: 14 }}>
          {rb
            ? $t('kayit_canli.varis_suresi_su_ana', { a: rb.varisSaati ? $t('kayit_canli.tahmini_varis', { varisSaati: rb.varisSaati }) : '' })
            : $t('kayit_canli.sure_duraklatmalari_icermez_ortalama')}
        </Txt>

        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel={$t('kayit_canli.duraklat')} onPress={onDuraklat} style={styles.pause}>
            <Icon name="pause" size={30} color={n.ground} strokeWidth={3.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paylasim: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 32, borderRadius: 10, backgroundColor: n.surface, marginBottom: 6 },
  root: { flex: 1, backgroundColor: n.ground },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(14,21,18,0.85)' },
  pillText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: n.text },
  dot: { width: 9, height: 9, borderRadius: 5 },
  haritaDugmeleri: { position: 'absolute', right: 16, gap: 8, zIndex: 10 },
  haritaDugmesi: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,21,18,0.85)',
    borderWidth: 1,
    borderColor: n.line,
  },
  haritaDugmesiYazi: { fontFamily: fontFamily.bodyBold, fontSize: 14, color: n.text },
  // Harita kalan bütün alanı alır; panel yalnızca içeriği kadar yer kaplar
  panel: { marginTop: -18, backgroundColor: n.ground, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10 },
  warn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#2A2418', marginBottom: 6 },
  warnText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: n.paused },
  hero: { fontFamily: fontFamily.displayHeavy, fontSize: 58, lineHeight: 62, color: n.text, letterSpacing: -2.5 },
  heroUnit: { fontFamily: fontFamily.bodySemiBold, fontSize: 18, letterSpacing: 0, color: n.textMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: '#24302B', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: n.accent, borderRadius: 3 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, marginTop: 6 },
  cell: { width: '33.33%' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: space.sm },
  pause: { width: 68, height: 68, borderRadius: 34, backgroundColor: n.accent, alignItems: 'center', justifyContent: 'center' },
});
