import type { RozetDurumu } from '@lykiva/shared';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { kademeRengi, rozetIkonu } from '@/data/rozet';
import { colors, temaliStil } from '@/theme';

/** Rozetin yuvarlak simgesi: kazanıldıysa kademe renginde, değilse soluk ve kilitli */
export function RozetSimgesi({ d, boyut = 64 }: { d: RozetDurumu; boyut?: number }) {
  const r = kademeRengi(d.tanim.kademe);
  return (
    <View
      style={[
        styles.simge,
        { width: boyut, height: boyut, borderRadius: boyut / 2 },
        d.kazanildi ? { backgroundColor: r.bg, borderColor: r.fg } : { backgroundColor: colors.sand, borderColor: colors.lineStrong, borderStyle: 'dashed' },
      ]}>
      <Icon name={rozetIkonu(d.tanim)} size={boyut * 0.45} color={d.kazanildi ? r.fg : colors.inkMuted} strokeWidth={d.kazanildi ? 2 : 1.6} />
      {!d.kazanildi ? (
        <View style={styles.kilit}>
          <Icon name="lock" size={12} color={colors.inkMuted} strokeWidth={2} />
        </View>
      ) : null}
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  simge: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  kilit: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
}));
