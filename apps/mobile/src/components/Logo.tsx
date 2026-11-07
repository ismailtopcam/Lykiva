import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Txt } from '@/components/Txt';
import { colors, fontFamily } from '@/theme';

/** Likya kaya mezarı kemerinden esinlenen işaret + "lykiva" yazısı */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Lykiva" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Path d="M6 28V14C6 8 11 4 16 3c5 1 10 5 10 11v14" fill="none" stroke={colors.terra} strokeWidth={2.8} strokeLinecap="round" />
        <Path d="M11 28c0-6 3-9 5-13 2 4 5 7 5 13" fill="none" stroke={colors.sea} strokeWidth={2.8} strokeLinecap="round" />
      </Svg>
      <Txt style={{ fontFamily: fontFamily.displayHeavy, fontSize: size * 0.9, letterSpacing: -0.8 }}>lykiva</Txt>
    </View>
  );
}
