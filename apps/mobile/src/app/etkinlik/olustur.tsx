import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, ListRow } from '@/components/ui';
import { colors, fontFamily, space } from '@/theme';

const levels = ['Kolay', 'Orta', 'Zor'];
const visibility = [
  ['Pedal Kaş grubu', '12 üye'],
  ['Bağlı topluluklar', 'Antalya Gravel'],
  ['Herkese açık', "Keşfet'te görünür"],
];

function Field({ icon, caption, value }: { icon: IconName; caption: string; value: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${caption}: ${value}`} style={styles.field}>
      <Icon name={icon} size={20} color={colors.inkMuted} />
      <View>
        <Txt style={{ fontSize: 11, color: colors.inkMuted }}>{caption}</Txt>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>{value}</Txt>
      </View>
    </Pressable>
  );
}

export default function EtkinlikOlusturScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('Gün doğumu sürüşü');
  const [level, setLevel] = useState(1);
  const [cap, setCap] = useState(15);
  const [vis, setVis] = useState(0);

  return (
    <View style={styles.root}>
      <Header title="Yeni etkinlik" backIcon="close" center />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, gap: 12, paddingBottom: insets.bottom + 100 }}>
        <View>
          <Txt variant="small">Etkinlik adı</Txt>
          <TextInput value={name} onChangeText={setName} accessibilityLabel="Etkinlik adı" style={styles.name} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field icon="calendar" caption="Tarih" value="Cmt, 14 Kasım" />
          </View>
          <View style={{ flex: 1 }}>
            <Field icon="clock" caption="Başlangıç" value="06:45" />
          </View>
        </View>
        <ListRow icon="pin" iconTone="sea" caption="Buluşma noktası" title="Kaş Cumhuriyet Meydanı" />
        <ListRow icon="route" iconTone="terra" caption="Rota" title="Kaş – Kalkan sahil yolu · 32 km" href="/rota/ornek" />

        <View>
          <Txt variant="small" style={{ marginBottom: 6 }}>
            Seviye
          </Txt>
          <View accessibilityRole="radiogroup" style={styles.seg}>
            {levels.map((l, i) => (
              <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: i === level }} onPress={() => setLevel(i)} style={[styles.segBtn, i === level && { backgroundColor: colors.ink }]}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: i === level ? colors.ground : colors.ink }}>{l}</Txt>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>Kontenjan</Txt>
            <Txt variant="small">Dolunca bekleme listesi açılır</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityRole="adjustable" accessibilityValue={{ now: cap, min: 2, max: 99 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Azalt" onPress={() => setCap(Math.max(2, cap - 1))} style={styles.step}>
              <Txt style={{ fontSize: 20, fontFamily: fontFamily.bodySemiBold }}>−</Txt>
            </Pressable>
            <Txt style={{ width: 44, textAlign: 'center', fontFamily: fontFamily.display, fontSize: 22 }}>{cap}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Artır" onPress={() => setCap(Math.min(99, cap + 1))} style={styles.step}>
              <Txt style={{ fontSize: 20, fontFamily: fontFamily.bodySemiBold }}>+</Txt>
            </Pressable>
          </View>
        </View>

        <View>
          <Txt variant="small" style={{ marginBottom: 6 }}>
            Kimler görebilir ve katılabilir?
          </Txt>
          <View accessibilityRole="radiogroup" style={{ gap: 6 }}>
            {visibility.map(([l, meta], i) => {
              const on = i === vis;
              return (
                <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setVis(i)} style={[styles.visRow, on && { borderColor: colors.sea, borderWidth: 1.5 }]}>
                  <View style={[styles.radio, on && { borderWidth: 6, borderColor: colors.sea }]} />
                  <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>{l}</Txt>
                  <Txt variant="small">{meta}</Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Etkinliği yayınla" href="/etkinlik/ornek" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  name: { fontFamily: fontFamily.display, fontSize: 24, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 60, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12 },
  seg: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: colors.land },
  segBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  step: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  visRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#9C9282' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
