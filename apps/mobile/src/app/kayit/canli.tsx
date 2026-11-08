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
import { useCanliVeri } from '@/kayit/istatistik';
import { colors, fontFamily, space } from '@/theme';

const n = colors.night;

export default function CanliTakipScreen() {
  const insets = useSafeAreaInsets();
  const { kayit, stats, anlikHiz, aktifS, iz, ben, gpsDogruluk } = useCanliVeri();
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
        {!kayit.arkaPlan ? (
          <View style={styles.warn} accessibilityRole="alert">
            <Txt style={styles.warnText}>Arka plan konum izni yok: uygulama açık ve ekran açıkken kaydediyor.</Txt>
          </View>
        ) : zayif ? (
          <View style={styles.warn} accessibilityLiveRegion="polite">
            <Txt style={styles.warnText}>GPS sinyali zayıf — açık gökyüzü gören bir yerde düzelir.</Txt>
          </View>
        ) : null}

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

const styles = StyleSheet.create({
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
