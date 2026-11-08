import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Stat } from '@/components/ui';
import { kasKalkanRoute, people } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

const n = colors.night;
const PROGRESS = 0.41;

export default function CanliTakipScreen() {
  const insets = useSafeAreaInsets();
  const me = kasKalkanRoute[Math.round(PROGRESS * (kasKalkanRoute.length - 1))];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <TopoMap
        dark
        style={{ height: 400 }}
        route={kasKalkanRoute}
        progress={PROGRESS}
        markers={[
          { id: 'me', coord: me, kind: 'me' },
          { id: 'end', coord: kasKalkanRoute[kasKalkanRoute.length - 1], kind: 'end' },
        ]}
        padding={{ top: 110, bottom: 40 }}
        accessibilityLabel="Canlı rota haritası: tamamlanan ve kalan kısım"
      />
      <FloatingHeader
        left={
          <View style={styles.pill}>
            <View style={[styles.dot, { backgroundColor: n.recording }]} />
            <Txt style={styles.pillText}>Kayıtta · Bisiklet</Txt>
          </View>
        }
        right={
          <Pressable accessibilityRole="link" onPress={() => router.push('/canli-harita')} style={styles.pill}>
            <View style={{ flexDirection: 'row' }}>
              <View style={[styles.mini, { backgroundColor: n.sea }]} />
              <View style={[styles.mini, { backgroundColor: '#D9C08A', marginLeft: -6 }]} />
            </View>
            <Txt style={styles.pillText}>Grup yanında</Txt>
          </Pressable>
        }
      />

      <View style={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>
        <View style={{ alignItems: 'center' }}>
          <Txt variant="label" color={n.textMuted}>
            Anlık hız
          </Txt>
          <Txt style={styles.hero} accessibilityLabel="Anlık hız 24,6 kilometre/saat">
            24,6<Txt style={styles.heroUnit}> km/sa</Txt>
          </Txt>
        </View>

        <View style={{ marginVertical: 16 }}>
          <View style={styles.track} accessibilityLabel={`Rotanın yüzde ${Math.round(PROGRESS * 100)}'i tamamlandı`}>
            <View style={[styles.fill, { width: `${PROGRESS * 100}%` }]} />
          </View>
          <View style={styles.trackLabels}>
            <Txt variant="small" color={n.textMuted}>
              Kaş
            </Txt>
            <Txt variant="small" color={n.textMuted}>
              %{Math.round(PROGRESS * 100)}
            </Txt>
            <Txt variant="small" color={n.textMuted}>
              Kalkan
            </Txt>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.cell}><Stat label="Yapılan" value="11,2" unit="km" size={28} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label="Kalan" value="16,2" unit="km" size={28} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label="Varışa" value="58" unit="dk" size={28} color={n.accentSoft} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label="Süre" value="0:41:18" size={28} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label="Ort. hız" value="16,7" size={28} color={n.text} muted={n.textMuted} /></View>
          <View style={styles.cell}><Stat label="Tırmanış" value="186" unit="m" size={28} color={n.text} muted={n.textMuted} /></View>
        </View>
        <Txt variant="small" color={n.textMuted} style={{ marginTop: 10 }}>
          Varış süresi şu ana kadarki ortalama hızına göre hesaplanır · Tahmini varış 13:52
        </Txt>

        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Ekranı kilitle" style={styles.side}>
            <Icon name="lock" color={n.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Duraklat" onPress={() => router.replace('/kayit/duraklatildi')} style={styles.pause}>
            <Icon name="pause" size={34} color={n.ground} strokeWidth={3.2} />
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel={`Gruba mesaj (${people.mert.short} ve diğerleri)`} onPress={() => router.push('/grup/ornek/sohbet')} style={styles.side}>
            <Icon name="chat" color={n.text} />
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
  mini: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: n.ground },
  panel: { flex: 1, marginTop: -26, backgroundColor: n.ground, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22 },
  hero: { fontFamily: fontFamily.displayHeavy, fontSize: 84, lineHeight: 90, color: n.text, letterSpacing: -3 },
  heroUnit: { fontFamily: fontFamily.bodySemiBold, fontSize: 22, letterSpacing: 0, color: n.textMuted },
  track: { height: 8, borderRadius: 4, backgroundColor: '#24302B', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: n.accent, borderRadius: 4 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  cell: { width: '33.33%' },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: space.lg },
  side: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: n.line, backgroundColor: n.surface, alignItems: 'center', justifyContent: 'center' },
  pause: { width: 88, height: 88, borderRadius: 44, backgroundColor: n.accent, alignItems: 'center', justifyContent: 'center' },
});
