/**
 * Aktivite detayında beğeni ve yorum satırı: kalbe dokununca beğen, yoruma dokununca yorumlar açılır.
 * Yalnızca sunucudaki aktivitelerde gösterilir.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { aktiviteDegisti, aktiviteSosyal, begen, sunucuAktivitesiMi, type Sosyal } from '@/akis/akis';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';

export function SosyalSatiri({ id }: { id: string }) {
  const [s, setS] = useState<Sosyal | null>(null);
  const gecerli = supabaseHazir && sunucuAktivitesiMi(id);

  // Yorumlardan dönünce sayılar yenilensin
  useFocusEffect(
    useCallback(() => {
      if (!gecerli) return;
      let acik = true;
      aktiviteSosyal(id)
        .then((x) => acik && setS(x))
        .catch(() => undefined);
      return () => {
        acik = false;
      };
    }, [id, gecerli]),
  );

  if (!gecerli || !s) return null;

  async function begeniDegistir() {
    if (!s) return;
    const onceki = { liked: s.liked, like_count: s.like_count };
    const yeni = { liked: !s.liked, like_count: Math.max(0, s.like_count + (s.liked ? -1 : 1)) };
    setS({ ...s, ...yeni });
    aktiviteDegisti(id, yeni);
    try {
      await begen(id, yeni.liked);
    } catch {
      setS((x) => (x ? { ...x, ...onceki } : x));
      aktiviteDegisti(id, onceki);
    }
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: s.liked }}
        accessibilityLabel={`${s.liked ? 'Beğeniyi geri al' : 'Beğen'}, ${s.like_count} beğeni`}
        onPress={() => void begeniDegistir()}
        style={styles.item}>
        <Icon name="heart" size={20} color={s.liked ? colors.terra : colors.ink} />
        <Txt style={[styles.text, s.liked && { color: colors.terra }]}>{s.like_count} beğeni</Txt>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${s.comment_count} yorum, yorumları aç`}
        onPress={() => router.push({ pathname: '/aktivite/[id]/yorumlar', params: { id } })}
        style={[styles.item, { flex: 1, justifyContent: 'flex-end' }]}>
        <Icon name="chat" size={20} />
        <Txt style={styles.text}>{s.comment_count ? `${s.comment_count} yorum` : 'Yorum yaz'}</Txt>
        <Icon name="chevron" size={18} color={colors.inkMuted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 8 },
  text: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.ink },
});
