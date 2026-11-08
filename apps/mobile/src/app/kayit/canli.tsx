import { ACTIVITY_LABELS, formatDuration, formatKm, formatMeters, formatSpeedKmh } from '@lykiva/shared';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Stat } from '@/components/ui';
import { duraklat } from '@/kayit/kaydedici';
import { useCanliVeri, type RotaDurumu } from '@/kayit/istatistik';
import { colors, fontFamily, space } from '@/theme';

const n = colors.night;

export default function CanliTakipScreen() {
  const insets = useSafeAreaInsets();
  const { kayit, stats, anlikHiz, aktifS, iz, ben, gpsDogruluk, rota, simdi } = useCanliVeri();
  const [takip, setTakip] = useState(true);

  if (kayit.durum === 'bos') return <Redirect href="/kayit" />;
  if (kayit.durum === 'duraklatildi') return <Redirect href="/kayit/duraklatildi" />;

  const hiz = formatSpeedKmh(anlikHiz);
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
        style={{ height: 340 }}
        route={iz}
        plan={rota?.plan}
        markers={ben ? [{ id: 'me', coord: ben, kind: 'me' }] : []}
        follow={takip ? ben : null}
        padding={{ top: 110, bottom: 40 }}
        accessibilityLabel="Canlı kayıt haritası: şimdiye kadar gidilen yol"
      />
      <FloatingHeader
        left={
          <View style={styles.pill}>
            <View style={[styles.dot, { backgroundColor: n.recording }]} />
            <Txt style={styles.pillText}>Kayıtta · {ACTIVITY_LABELS[kayit.activity]}</Txt>
          </View>
        }
        right={
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: takip }}
            accessibilityLabel="Haritada beni takip et"
            onPress={() => setTakip((t) => !t)}
            style={styles.pill}>
            <Icon name="pin" size={16} color={takip ? n.accent : n.text} />
            <Txt style={styles.pillText}>{takip ? 'Takipte' : 'Serbest'}</Txt>
          </Pressable>
        }
      />

      <View style={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>
        {rota?.rotaDisinda ? (
          <View style={[styles.warn, { backgroundColor: '#3A1F17' }]} accessibilityRole="alert">
            <Txt style={[styles.warnText, { color: n.accentSoft }]}>Rotanın dışındasın · rotaya {formatMeters(rota.sapmaM)} m</Txt>
          </View>
        ) : null}
        {!kayit.arkaPlan ? (
          <View style={styles.warn} accessibilityRole="alert">
            <Txt style={styles.warnText}>Arka plan konum izni yok: uygulama açık ve ekran açıkken kaydediyor.</Txt>
          </View>
        ) : zayif ? (
          <View style={styles.warn} accessibilityLiveRegion="polite">
            <Txt style={styles.warnText}>GPS sinyali zayıf — açık gökyüzü gören bir yerde düzelir.</Txt>
          </View>
        ) : null}

        {rota ? <RotaSeridi rota={rota} simdi={simdi} /> : null}

        <View style={{ alignItems: 'center' }}>
          <Txt variant="label" color={n.textMuted}>
            Anlık hız
          </Txt>
          <Txt style={styles.hero} accessibilityLabel={`Anlık hız ${hiz} kilometre/saat`}>
            {hiz}
            <Txt style={styles.heroUnit}> km/sa</Txt>
          </Txt>
        </View>

        <View style={styles.grid}>
          <View style={styles.cell}><Stat label="Yapılan" value={formatKm(stats.distanceM)} unit="km" size={28} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label="Süre" value={formatDuration(aktifS)} size={28} color={n.accentSoft} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label="Ort. hız" value={formatSpeedKmh(stats.avgMovingSpeed)} size={28} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label="Maks. hız" value={formatSpeedKmh(stats.maxSpeed)} size={28} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label="Tırmanış" value={formatMeters(stats.gainM)} unit="m" size={28} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}>
            <Stat label="Rakım" value={kayit.sonKonum?.alt != null ? formatMeters(kayit.sonKonum.alt) : '–'} unit="m" size={28} color={n.text} muted={n.textMuted} />
          </View>
        </View>
        <Txt variant="small" color={n.textMuted} style={{ marginTop: 10 }}>
          Süre duraklatmaları içermez · ortalama yalnızca hareket hâlindeyken hesaplanır
        </Txt>

        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Duraklat" onPress={onDuraklat} style={styles.pause}>
            <Icon name="pause" size={34} color={n.ground} strokeWidth={3.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Takip edilen rota: kalan mesafe, tahmini süre ve varış saati */
function RotaSeridi({ rota, simdi }: { rota: RotaDurumu; simdi: number }) {
  const varis = rota.kalanS != null ? new Date(simdi + rota.kalanS * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null;
  const bitti = rota.remainingM < 30;
  return (
    <View
      style={styles.rota}
      accessible
      accessibilityLabel={
        bitti
          ? `${rota.ad} rotası tamamlandı`
          : `${rota.ad}: kalan ${formatKm(rota.remainingM)} kilometre${rota.kalanS != null ? `, tahmini ${formatDuration(rota.kalanS)}, varış ${varis}` : ''}`
      }>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: n.textMuted, flexShrink: 1 }} numberOfLines={1}>
          {rota.ad}
        </Txt>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: n.textMuted }}>{formatKm(rota.totalM)} km</Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14, marginTop: 2 }}>
        <Txt style={styles.rotaDeger}>
          {bitti ? 'Vardın' : formatKm(rota.remainingM)}
          {bitti ? null : <Txt style={styles.rotaBirim}> km kaldı</Txt>}
        </Txt>
        {!bitti && rota.kalanS != null ? (
          <Txt style={[styles.rotaDeger, { color: n.accentSoft }]}>
            ~{formatDuration(rota.kalanS)}
            <Txt style={styles.rotaBirim}> · {varis}</Txt>
          </Txt>
        ) : null}
      </View>
      <View style={styles.rotaBar}>
        <View style={{ width: `${Math.round(Math.min(1, rota.oran) * 100)}%`, height: '100%', backgroundColor: n.sea, borderRadius: 3 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rota: { padding: 12, borderRadius: 14, backgroundColor: n.surface, marginBottom: 12 },
  rotaDeger: { fontFamily: fontFamily.display, fontSize: 24, color: n.text, letterSpacing: -0.4 },
  rotaBirim: { fontFamily: fontFamily.bodyMedium, fontSize: 13, color: n.textMuted, letterSpacing: 0 },
  rotaBar: { height: 6, borderRadius: 3, backgroundColor: n.line, marginTop: 8, overflow: 'hidden' },
  root: { flex: 1, backgroundColor: n.ground },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(14,21,18,0.85)' },
  pillText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: n.text },
  dot: { width: 9, height: 9, borderRadius: 5 },
  panel: { flex: 1, marginTop: -26, backgroundColor: n.ground, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22 },
  warn: { padding: 10, borderRadius: 12, backgroundColor: '#2A2418', marginBottom: 10 },
  warnText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: n.paused },
  hero: { fontFamily: fontFamily.displayHeavy, fontSize: 72, lineHeight: 78, color: n.text, letterSpacing: -3 },
  heroUnit: { fontFamily: fontFamily.bodySemiBold, fontSize: 22, letterSpacing: 0, color: n.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 12 },
  cell: { width: '33.33%' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'auto', paddingTop: space.md },
  pause: { width: 80, height: 80, borderRadius: 40, backgroundColor: n.accent, alignItems: 'center', justifyContent: 'center' },
});
