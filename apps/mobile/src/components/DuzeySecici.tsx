import { View } from 'react-native';

import { Chip } from '@/components/ui';
import { DUZEYLER, duzeyAdi, type Duzey } from '@/lib/gizlilik';

/** Herkes / Takipçiler / Hiç kimse seçimi (Gizlilik kontrolleri) */
export function DuzeySecici({ deger, etiket, onSec }: { deger: Duzey; etiket: string; onSec: (d: Duzey) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={etiket}>
      {DUZEYLER.map((d) => (
        <Chip key={d} label={duzeyAdi(d)} role="radio" selected={deger === d} onPress={() => onSec(d)} />
      ))}
    </View>
  );
}
