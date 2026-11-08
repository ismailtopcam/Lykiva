import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { Header } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Chip, Label, ToggleRow } from '@/components/ui';
import { kasKalkan } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

const looks = [
  { name: 'Gece', bg: '#16201B', fg: '#F2EDE3', route: '#E07A4A', contour: '#33413A' },
  { name: 'Kireçtaşı', bg: '#F2EDE3', fg: '#16201B', route: '#B04E25', contour: '#D3C7B0' },
  { name: 'Deniz', bg: '#0B6A6A', fg: '#FFFFFF', route: '#F6D9A8', contour: '#2A8282' },
  { name: 'Kaya', bg: '#B04E25', fg: '#FFFFFF', route: '#FBF8F2', contour: '#C26A44' },
];

const statDefs = [
  ['mesafe', 'Mesafe'],
  ['sure', 'Süre'],
  ['tirmanis', 'Tırmanış'],
  ['maks', 'Maks. hız'],
  ['ort', 'Ort. hız'],
  ['mola', 'Molalar'],
  ['kisiler', 'Birlikte yaptıklarım'],
] as const;

const targets: { label: string; icon: IconName; bg: string; fg: string }[] = [
  { label: 'Hikâye', icon: 'image', bg: colors.ink, fg: colors.ground },
  { label: 'WhatsApp', icon: 'chat', bg: colors.sea, fg: '#FFFFFF' },
  { label: 'Lykiva akışı', icon: 'home', bg: colors.terra, fg: '#FFFFFF' },
  { label: 'Bağlantı', icon: 'link', bg: colors.sand, fg: colors.ink },
  { label: 'GPX / Görsel', icon: 'download', bg: colors.sand, fg: colors.ink },
];

export default function PaylasimStudyosuScreen() {
  const insets = useSafeAreaInsets();
  const [look, setLook] = useState(0);
  const [hide, setHide] = useState(true);
  const [on, setOn] = useState<Record<string, boolean>>({ mesafe: true, sure: true, tirmanis: true, maks: true, kisiler: true });
  const a = kasKalkan;
  const L = looks[look];

  const cardStats = [
    on.sure && ['Süre', '1:38'],
    on.tirmanis && ['Tırmanış', `${a.climbM} m`],
    on.maks && ['Maks.', a.maxSpeed],
    on.ort && ['Ort.', a.avgSpeed],
    on.mola && ['Mola', String(a.stops.length)],
  ].filter(Boolean).slice(0, 3) as [string, string][];

  return (
    <View style={styles.root}>
      <Header
        title="Paylaş"
        center
        right={
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={{ paddingHorizontal: 8, height: 44, justifyContent: 'center' }}>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15, color: colors.terra }}>Bitti</Txt>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}>
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <View style={[styles.card, { backgroundColor: L.bg }]} accessible accessibilityLabel={`Paylaşım kartı önizlemesi, ${L.name} şablonu`}>
            <Svg width={164} height={120}>
              <G fill="none" stroke={L.contour} strokeWidth={0.8}>
                <Ellipse cx={110} cy={40} rx={45} ry={28} />
                <Ellipse cx={110} cy={40} rx={28} ry={16} />
                <Ellipse cx={36} cy={78} rx={28} ry={20} />
              </G>
              <Path d="M8 100 C 26 92, 36 78, 56 80 S 82 92, 96 74 S 118 50, 132 62 S 148 84, 158 78" fill="none" stroke={L.route} strokeWidth={3.5} strokeLinecap="round" />
              {hide ? null : (
                <>
                  <Circle cx={8} cy={100} r={4} fill={L.route} />
                  <Circle cx={158} cy={78} r={4} fill="none" stroke={L.route} strokeWidth={2} />
                </>
              )}
            </Svg>
            <View>
              <Txt style={{ fontSize: 10, fontFamily: fontFamily.bodySemiBold, letterSpacing: 0.8, color: L.fg, opacity: 0.85 }}>BİSİKLET · KAŞ – KALKAN</Txt>
              {on.mesafe ? (
                <Txt style={{ fontFamily: fontFamily.displayHeavy, fontSize: 40, lineHeight: 44, color: L.fg, letterSpacing: -1.2 }}>{a.distanceKm} km</Txt>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                {cardStats.map(([l, v]) => (
                  <View key={l}>
                    <Txt style={{ fontSize: 10, color: L.fg, opacity: 0.85 }}>{l}</Txt>
                    <Txt style={{ fontSize: 13, fontFamily: fontFamily.bodyBold, color: L.fg }}>{v}</Txt>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Txt style={{ fontSize: 10, fontFamily: fontFamily.bodySemiBold, color: L.fg }}>{on.kisiler ? '@mert · @deniz · @can' : ''}</Txt>
                <Txt style={{ fontSize: 13, fontFamily: fontFamily.displayHeavy, color: L.fg }}>lykiva</Txt>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: space.lg }}>
          <Label>Şablon</Label>
          <View accessibilityRole="radiogroup" style={styles.row}>
            {looks.map((l, i) => (
              <Chip key={l.name} label={l.name} role="radio" selected={i === look} onPress={() => setLook(i)} />
            ))}
          </View>

          <Label>Kartta göster</Label>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {statDefs.map(([k, label]) => (
              <Chip key={k} label={label} role="checkbox" tone="sea" icon={on[k] ? undefined : 'plus'} selected={!!on[k]} onPress={() => setOn({ ...on, [k]: !on[k] })} />
            ))}
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: colors.lineStrong, marginTop: 4 }}>
            <ToggleRow title="Başlangıç ve bitişi gizle" subtitle="Evinin konumu haritada görünmez" value={hide} onChange={setHide} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.targets, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {targets.map((t) => (
            <Pressable key={t.label} accessibilityRole="button" accessibilityLabel={`${t.label} ile paylaş`} style={styles.target}>
              <View style={[styles.targetIcon, { backgroundColor: t.bg }]}>
                <Icon name={t.icon} color={t.fg} />
              </View>
              <Txt style={{ fontSize: 11, fontFamily: fontFamily.bodySemiBold }} numberOfLines={1}>
                {t.label}
              </Txt>
            </Pressable>
          ))}
        </View>
        <Txt variant="small" style={{ textAlign: 'center', marginTop: 8 }}>
          Diğer: Instagram gönderisi, X, Facebook, TikTok, Telegram…
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  card: { width: 196, height: 300, borderRadius: 18, padding: 16, justifyContent: 'space-between', shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  targets: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 8, paddingTop: 12 },
  target: { width: '20%', alignItems: 'center', gap: 6 },
  targetIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
