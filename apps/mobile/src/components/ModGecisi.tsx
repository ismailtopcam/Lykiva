import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { aktifSema, colors, fontFamily, temaliStil } from '@/theme';
import { $t } from '@/i18n';

/** Harita sekmesinin iki işi: bir yere gitmek (yol tarifi) ya da egzersiz kaydetmek */
export type HaritaModu = 'yolculuk' | 'egzersiz';

/** Panelin başındaki ikili geçiş. Yolculuk deniz renginde, egzersiz kiremit renginde: düğmeler de aynı rengi taşır */
export function ModGecisi({ mod, onMod }: { mod: HaritaModu; onMod: (m: HaritaModu) => void }) {
  const secenekler = [
    { id: 'yolculuk' as const, label: $t('harita.yolculuk_yap'), icon: 'navigation' as const, bg: colors.sea, fg: aktifSema() === 'koyu' ? colors.ground : '#FFFFFF' },
    { id: 'egzersiz' as const, label: $t('harita.egzersiz_yap'), icon: 'pulse' as const, bg: colors.terra, fg: '#FFFFFF' },
  ];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={$t('kayit.ne_yapiyorsun')} style={styles.kap}>
      {secenekler.map((s) => {
        const on = s.id === mod;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onMod(s.id)}
            style={({ pressed }) => [styles.secenek, on && { backgroundColor: s.bg }, pressed && !on && { opacity: 0.6 }]}>
            <Icon name={s.icon} size={16} color={on ? s.fg : colors.ink} strokeWidth={2.2} />
            <Txt numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, fontFamily: on ? fontFamily.bodyBold : fontFamily.bodySemiBold, fontSize: 14, color: on ? s.fg : colors.ink }}>
              {s.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  kap: { flexDirection: 'row', gap: 4, height: 48, padding: 4, borderRadius: 24, backgroundColor: colors.ground, marginBottom: 14 },
  secenek: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 8 },
}));
