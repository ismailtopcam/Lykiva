import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fontFamily, fontSize } from '@/theme';

type Variant = 'body' | 'muted' | 'small' | 'caption' | 'label' | 'title' | 'heading' | 'display' | 'stat';

type Props = TextProps & { variant?: Variant; color?: string };

/** Lykiva metin bileşeni — tasarımdaki yazı stillerini tek yerden uygular. */
export function Txt({ variant = 'body', color, style, ...rest }: Props) {
  return <Text {...rest} style={[styles[variant], color ? { color } : null, style]} />;
}

const styles = StyleSheet.create({
  body: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.ink },
  muted: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.inkMuted },
  small: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.inkMuted },
  caption: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.caption, color: colors.inkMuted },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.small,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: { fontFamily: fontFamily.display, fontSize: fontSize.title, color: colors.ink },
  heading: { fontFamily: fontFamily.display, fontSize: fontSize.heading, color: colors.ink },
  display: { fontFamily: fontFamily.displayHeavy, fontSize: fontSize.display, color: colors.ink, letterSpacing: -0.5 },
  stat: { fontFamily: fontFamily.display, fontSize: fontSize.stat, color: colors.ink, letterSpacing: -0.5 },
});
