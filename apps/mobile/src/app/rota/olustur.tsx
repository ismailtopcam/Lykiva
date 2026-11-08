import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button, Chip, Stat } from '@/components/ui';
import { faralyaKabakRoute } from '@/data/ornek';
import { colors, fontFamily, radius, space } from '@/theme';

const modes = ['Patikaya yapış', 'Yola yapış', 'Serbest çiz'];
const surface = [
  { label: 'Asfalt', pct: 18, color: colors.ink },
  { label: 'Toprak yol', pct: 34, color: colors.ochre },
  { label: 'Patika', pct: 48, color: colors.sea },
];

export default function RotaOlusturScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState(0);
  const [name, setName] = useState('Faralya – Kabak – Alınca');
  const [q, setQ] = useState('');
  const r = faralyaKabakRoute;

  return (
    <View style={styles.root}>
      <TopoMap
        style={StyleSheet.absoluteFill}
        route={r}
        markers={[
          { id: 'a', coord: r[0], kind: 'start' },
          { id: '1', coord: r[2], kind: 'stop', text: '1' },
          { id: '2', coord: r[4], kind: 'stop', text: '2' },
          { id: 'b', coord: r[r.length - 1], kind: 'end' },
        ]}
        padding={{ top: 120, bottom: 420 }}
        accessibilityLabel="Rota çizim haritası: dört noktalı patika rotası"
      />
      <FloatingHeader
        left={<IconButton floating icon="close" label="Kapat" onPress={() => router.back()} />}
        middle={
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.inkMuted} strokeWidth={2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Yer, patika veya zirve ara"
              placeholderTextColor={colors.inkMuted}
              accessibilityLabel="Yer ara"
              style={styles.searchInput}
            />
          </View>
        }
        right={<IconButton floating icon="undo" label="Son noktayı geri al" />}
      />

      <View style={[styles.modes, { bottom: 392 + insets.bottom }]} accessibilityRole="radiogroup">
        {modes.map((m, i) => (
          <View key={m} style={styles.modeWrap}>
            <Chip label={m} role="radio" selected={i === mode} onPress={() => setMode(i)} />
          </View>
        ))}
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grip} />
        <Txt variant="small">Rota adı</Txt>
        <TextInput value={name} onChangeText={setName} accessibilityLabel="Rota adı" style={styles.nameInput} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 }}>
          <Stat label="Mesafe" value="18,6 km" />
          <Stat label="Tırmanış" value="↑ 540 m" />
          <Stat label="Tahmini (yürüyüş)" value="5 sa 10 dk" />
        </View>
        <Txt variant="small" style={{ marginBottom: 6 }}>
          Zemin
        </Txt>
        <View style={styles.bar} accessible accessibilityLabel={surface.map((s) => `${s.label} yüzde ${s.pct}`).join(', ')}>
          {surface.map((s) => (
            <View key={s.label} style={{ flex: s.pct, backgroundColor: s.color }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {surface.map((s) => (
            <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
              <Txt variant="small">
                {s.label} %{s.pct}
              </Txt>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Kaydet" variant="outline" style={{ flex: 1 }} />
          <Button label="Kaydet ve paylaş" icon="share" href="/rota/ornek/paylas" style={{ flex: 1.4 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, alignSelf: 'stretch', paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  modes: { position: 'absolute', left: space.md, flexDirection: 'row', gap: 8 },
  modeWrap: { borderRadius: 18, backgroundColor: colors.surface },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: 10 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 12 },
  nameInput: { fontFamily: fontFamily.display, fontSize: 22, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 6 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
});
