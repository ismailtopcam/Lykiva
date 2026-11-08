import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { colors, fontFamily, radius, space } from '@/theme';

export type ShellLink = { label: string; href: Href };

type Props = {
  title: string;
  /** Bu ekranda ileride ne olacağı — Design canvas'ındaki karşılığı */
  plan: string[];
  /** Akışı denemek için ilgili ekranlara bağlantılar */
  links?: ShellLink[];
  /** Canlı takip ekranları koyu temada */
  dark?: boolean;
  /** Sekme ekranlarında geri butonu yok */
  showBack?: boolean;
  /** Başlığın sağına konacak öğe */
  right?: ReactNode;
  /** Başlığın yerine (örn. logo) */
  header?: ReactNode;
  children?: ReactNode;
};

/**
 * 1. aşama ekran kabuğu: başlık, geri butonu, ekranın planı ve
 * gezinme bağlantıları. İçerik sonraki aşamalarda doldurulacak.
 */
export function ScreenShell({ title, plan, links = [], dark, showBack = true, right, header, children }: Props) {
  const bg = dark ? colors.night.ground : colors.ground;
  const fg = dark ? colors.night.text : colors.ink;
  const muted = dark ? colors.night.textMuted : colors.inkMuted;
  const card = dark ? colors.night.surface : colors.surface;
  const line = dark ? colors.night.line : colors.line;

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={styles.header}>
        {showBack ? (
          <IconButton icon="back" label="Geri" color={fg} onPress={() => router.back()} />
        ) : null}
        <View style={{ flex: 1, paddingLeft: showBack ? 0 : space.sm }}>
          {header ?? (
            <Txt variant="heading" color={fg} accessibilityRole="header">
              {title}
            </Txt>
          )}
        </View>
        {right}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {children}

        <View style={[styles.card, { backgroundColor: card, borderColor: line }]}>
          <Txt variant="label" color={muted}>
            Bu ekranda olacaklar
          </Txt>
          {plan.map((item) => (
            <View key={item} style={styles.planRow}>
              <View style={[styles.dot, { backgroundColor: dark ? colors.night.accent : colors.terra }]} />
              <Txt color={fg} style={{ flex: 1 }}>
                {item}
              </Txt>
            </View>
          ))}
        </View>

        {links.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Txt variant="label" color={muted}>
              Gezinme
            </Txt>
            {links.map((l) => (
              <Pressable
                key={l.label}
                accessibilityRole="link"
                onPress={() => router.push(l.href)}
                style={({ pressed }) => [
                  styles.link,
                  { backgroundColor: card, borderColor: line },
                  pressed && { opacity: 0.7 },
                ]}>
                <Txt color={fg} style={{ flex: 1, fontFamily: fontFamily.bodySemiBold }}>
                  {l.label}
                </Txt>
                <Icon name="chevron" size={18} color={muted} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    minHeight: 52,
  },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 120 },
  card: { borderRadius: radius.xl, borderWidth: 1, padding: space.lg, gap: space.md },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  link: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
