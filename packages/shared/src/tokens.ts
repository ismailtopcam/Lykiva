/**
 * Lykiva tasarım dili — Design canvas'ındaki değerlerin tek kaynağı.
 * Mobil (React Native) ve web (Next.js) aynı değerleri buradan okur.
 */

export const colors = {
  /** Kireçtaşı zemin */
  ground: '#F2EDE3',
  /** Kartlar, alt menü, sayfalar */
  surface: '#FBF8F2',
  /** Harita arazi tonu */
  land: '#E8E0CF',
  /** İnce çizgiler, kart kenarları */
  line: '#E3DACB',
  lineStrong: '#D3C9B7',
  /** Ana metin (çam siyahı) */
  ink: '#16201B',
  /** İkincil metin — zemin üzerinde 4.5:1 üstü kontrast */
  inkMuted: '#4F5751',

  /** Ana vurgu: Likya kaya mezarı kiremit rengi (beyaz yazı ile kullanılabilir) */
  terra: '#B04E25',
  terraPressed: '#8A3C1C',
  terraSoft: '#F1DCCD',
  terraInk: '#7A3416',

  /** İkinci vurgu: Akdeniz */
  sea: '#0B6A6A',
  seaSoft: '#D3E8E4',
  seaInk: '#0B4F4F',
  /** Harita deniz alanı */
  water: '#CBE1DC',

  /** Yükseklik renk skalası için ara ton */
  ochre: '#C08A2E',
  sand: '#E4D9C3',
  sandInk: '#4A3F2A',

  /** Canlı takip ekranlarının koyu teması */
  night: {
    ground: '#0E1512',
    surface: '#18221E',
    line: '#2E3B35',
    text: '#EDE7DB',
    textMuted: '#A3ACA5',
    accent: '#E07A4A',
    accentSoft: '#F09A6E',
    sea: '#4FB3AC',
    recording: '#E5484D',
    paused: '#E9C77B',
  },
} as const;

export const fonts = {
  /** Başlıklar ve büyük sayılar */
  display: 'Bricolage Grotesque',
  /** Gövde metni ve arayüz */
  body: 'Inter',
} as const;

/** 4 px tabanlı aralık ölçeği */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  sheet: 26,
  pill: 999,
} as const;

export const fontSize = {
  caption: 11,
  small: 12,
  body: 14,
  bodyLarge: 15,
  title: 19,
  heading: 22,
  display: 28,
  stat: 30,
  hero: 84,
} as const;

/** Dokunma hedefleri en az bu boyutta olmalı */
export const minTouchTarget = 44;
