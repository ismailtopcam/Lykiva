import { formatDuration, formatKm, formatSpeedKmh } from '@lykiva/shared';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, Stat } from '@/components/ui';
import { bitir, devamEt, iptalEt } from '@/kayit/kaydedici';
import { useCanliVeri } from '@/kayit/istatistik';
import { colors, fontFamily } from '@/theme';

const n = colors.night;

export default function DuraklatildiScreen() {
  const insets = useSafeAreaInsets();
  const { kayit, stats, aktifS, simdi, rota } = useCanliVeri();
  const [kaydediyor, setKaydediyor] = useState(false);

  if (kayit.durum === 'bos' && !kaydediyor) return <Redirect href="/kayit" />;
  if (kayit.durum === 'kayitta') return <Redirect href="/kayit/canli" />;

  const molaS = kayit.duraklatmaBaslangic ? Math.max(0, (simdi - kayit.duraklatmaBaslangic) / 1000) : 0;
  const yetersiz = kayit.segments.flat().length < 2;

  async function onDevam() {
    await devamEt();
    router.replace('/kayit/canli');
  }

  async function onBitir() {
    setKaydediyor(true);
    const hedef = await bitir();
    if (hedef) router.replace({ pathname: '/aktivite/[id]', params: { id: hedef } });
    else router.replace('/');
  }

  function onSil() {
    const sil = async () => {
      await iptalEt();
      router.replace('/');
    };
    if (Platform.OS === 'web') {
      void sil();
      return;
    }
    Alert.alert('Kayıt silinsin mi?', 'Bu kayıt kaydedilmeden silinecek. Geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => void sil() },
    ]);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />
      <View style={{ alignItems: 'center' }}>
        <View style={styles.badge}>
          <Icon name="pause" size={14} color={n.paused} strokeWidth={3} />
          <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13, color: n.paused }}>Duraklatıldı</Txt>
        </View>
        <Txt style={styles.time} accessibilityLabel={`Süre ${formatDuration(aktifS)}`}>
          {formatDuration(aktifS)}
        </Txt>
        <Txt style={{ fontSize: 14, color: n.textMuted, fontFamily: fontFamily.body }}>
          Mola süresi <Txt style={{ color: n.paused, fontFamily: fontFamily.bodyBold }}>{formatDuration(molaS)}</Txt>
        </Txt>
      </View>

      <View style={styles.stats}>
        <Stat label="Yapılan" value={`${formatKm(stats.distanceM)} km`} color={n.text} muted={n.textMuted} />
        <Stat label="Ort. hız" value={formatSpeedKmh(stats.avgMovingSpeed)} color={n.text} muted={n.textMuted} />
        <Stat label="Maks. hız" value={formatSpeedKmh(stats.maxSpeed)} color={n.text} muted={n.textMuted} />
      </View>

      {rota ? (
        <Txt style={{ textAlign: 'center', fontSize: 14, color: n.text, fontFamily: fontFamily.bodySemiBold, marginTop: -8, marginBottom: 16 }}>
          {rota.ad}: {formatKm(rota.remainingM)} km kaldı
        </Txt>
      ) : null}

      <Txt variant="small" color={n.textMuted} style={{ textAlign: 'center' }}>
        Bu mola, kaydın “Hız & molalar” sayfasında yeriyle birlikte görünecek. Duraklatmadan verdiğin 1 dakikadan uzun molalar da otomatik bulunur.
      </Txt>

      <View style={{ marginTop: 'auto', gap: 10 }}>
        <Button label="Devam et" icon="play" variant="night" big onPress={onDevam} disabled={kaydediyor} />
        <Button
          label={kaydediyor ? 'Kaydediliyor…' : 'Bitir ve kaydet'}
          icon="stop"
          variant="nightOutline"
          onPress={onBitir}
          disabled={kaydediyor || yetersiz}
        />
        {yetersiz ? (
          <Txt variant="small" color={n.textMuted} style={{ textAlign: 'center' }}>
            Kaydetmek için henüz yeterli GPS noktası yok.
          </Txt>
        ) : null}
        <Button label="Kaydı sil" variant="nightOutline" onPress={onSil} disabled={kaydediyor} style={{ borderColor: 'transparent' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: n.ground, paddingHorizontal: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#2A2418' },
  time: { fontFamily: fontFamily.displayHeavy, fontSize: 72, lineHeight: 80, color: n.text, letterSpacing: -3, marginTop: 18 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', padding: 16, borderRadius: 18, backgroundColor: n.surface, marginVertical: 24 },
});
