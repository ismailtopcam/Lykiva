import { colors, radius } from '@lykiva/shared';
import type { CSSProperties } from 'react';

/**
 * Ortak tasarım değerlerini CSS değişkenlerine çevirir.
 * Değerlerin tek kaynağı packages/shared/src/tokens.ts.
 */
export const themeVars = {
  '--ground': colors.ground,
  '--surface': colors.surface,
  '--land': colors.land,
  '--line': colors.line,
  '--line-strong': colors.lineStrong,
  '--ink': colors.ink,
  '--ink-muted': colors.inkMuted,
  '--terra': colors.terra,
  '--terra-pressed': colors.terraPressed,
  '--terra-soft': colors.terraSoft,
  '--terra-ink': colors.terraInk,
  '--sea': colors.sea,
  '--sea-soft': colors.seaSoft,
  '--sea-ink': colors.seaInk,
  '--water': colors.water,
  '--sand': colors.sand,
  '--night': colors.night.ground,
  '--night-text': colors.night.text,
  '--night-muted': colors.night.textMuted,
  '--night-accent': colors.night.accent,
  '--radius-md': `${radius.md}px`,
  '--radius-lg': `${radius.lg}px`,
  '--radius-xl': `${radius.xl}px`,
} as CSSProperties;
