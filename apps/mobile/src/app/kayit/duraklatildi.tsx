import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, Label, Stat } from '@/components/ui';
import { colors, fontFamily, space } from '@/theme';

const n = colors.night;
const quick = ['Mola veriyorum', 'Beni bekleyin', 'Önden gidin', 'Teknik sorun var'];

export default function DuraklatildiScreen() {
  const insets = useSafeAreaInsets();
  const [sent, setSent] = useState<string | null>(null);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />
      <View style={{ alignItems: 'center' }}>
        <View style={styles.badge}>
          <Icon name="pause" size={14} color={n.paused} strokeWidth={3} />
          <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13, color: n.paused }}>Duraklatıldı</Txt>
        </View>
        <Txt style={styles.time}>0:41:18</Txt>
        <Txt style={{ fontSize: 14, color: n.textMuted, fontFamily: fontFamily.body }}>
          Hareket süresi · mola <Txt style={{ color: n.paused, fontFamily: fontFamily.bodyBold }}>3:24</Txt>{" dk'dır sürüyor"}
        </Txt>
      </View>

      <View style={styles.stats}>
        <Stat label="Yapılan" value="11,2 km" color={n.text} muted={n.textMuted} />
        <Stat label="Kalan" value="16,2 km" color={n.text} muted={n.textMuted} />
        <Stat label="Ort. hız" value="16,7" color={n.text} muted={n.textMuted} />
      </View>

      <Label dark>Gruba hızlı mesaj</Label>
      <View style={styles.quick}>
        {quick.map((q, i) => {
          const warn = i === quick.length - 1;
          const on = sent === q;
          return (
            <Pressable
              key={q}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setSent(q)}
              style={[styles.q, warn && styles.qWarn, on && styles.qOn]}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: on ? n.ground : warn ? n.accentSoft : n.text }}>
                {on ? '✓ ' : ''}
                {q}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <Pressable accessibilityRole="button" style={styles.note}>
        <Icon name="camera" color={n.text} />
        <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: n.text }}>Bu molaya fotoğraf veya not ekle</Txt>
        <Txt variant="small" color={n.textMuted}>
          Haritaya işlenir
        </Txt>
      </Pressable>

      <View style={{ marginTop: 'auto', gap: 10 }}>
        <Button label="Devam et" icon="play" variant="night" big onPress={() => router.replace('/kayit/canli')} />
        <Button label="Bitir ve kaydet" icon="stop" variant="nightOutline" onPress={() => router.replace('/aktivite/ornek')} />
        <Txt variant="small" color={n.textMuted} style={{ textAlign: 'center' }}>
          Otomatik duraklatma açık · 2 dk hareketsizlikte devreye girer
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: n.ground, paddingHorizontal: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#2A2418' },
  time: { fontFamily: fontFamily.displayHeavy, fontSize: 72, lineHeight: 80, color: n.text, letterSpacing: -3, marginTop: 18 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', padding: 16, borderRadius: 18, backgroundColor: n.surface, marginVertical: 24 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  q: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: n.line, backgroundColor: n.surface, justifyContent: 'center' },
  qWarn: { borderColor: '#5A3A2A', backgroundColor: '#2A1C15' },
  qOn: { backgroundColor: n.sea, borderColor: n.sea },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, borderRadius: 16, borderWidth: 1, borderColor: n.line, paddingHorizontal: space.lg },
});
