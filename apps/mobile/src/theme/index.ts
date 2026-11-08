import { colors, fontSize, radius, space } from '@lykiva/shared';

export { colors, fontSize, radius, space, minTouchTarget } from '@lykiva/shared';

/**
 * React Native'de her ağırlık ayrı bir font ailesi adıyla yüklenir.
 * Bu adlar src/app/_layout.tsx içindeki useFonts çağrısıyla eşleşmelidir.
 */
export const fontFamily = {
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
} as const;

export const theme = { colors, fontSize, radius, space, fontFamily };
