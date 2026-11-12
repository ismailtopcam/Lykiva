import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Avatar, Button, DateBadge, SectionHeader } from '@/components/ui';
import { events, groups } from '@/data/ornek';
import { colors, fontFamily, space, temaliStil } from '@/theme';

export function OrnekGruplar() {
  const next = events[0];
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <View style={styles.head}>
          <Txt variant="display" accessibilityRole="header">
            Gruplar
          </Txt>
          <Pressable accessibilityRole="button" style={styles.newBtn}>
            <Icon name="plus" size={16} strokeWidth={2.2} />
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>Yeni grup</Txt>
          </Pressable>
        </View>

        <Pressable accessibilityRole="link" onPress={() => router.push('/etkinlik/ornek')} style={styles.next}>
          <DateBadge month={next.month} day={next.day} />
          <View style={{ flex: 1 }}>
            <Txt variant="small">Sıradaki grup etkinliği</Txt>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15 }}>{next.title}</Txt>
            <Txt variant="small">
              {next.when} · {next.going} kişi
            </Txt>
          </View>
          <Icon name="chevron" size={20} color={colors.inkMuted} strokeWidth={2} />
        </Pressable>

        <SectionHeader title="Grupların ve toplulukların" />
        {groups.map((g) => (
          <Pressable key={g.id} accessibilityRole="link" onPress={() => router.push('/grup/ornek')} style={styles.row}>
            <Avatar initials={g.short} tone={g.tone} size={48} square />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                {g.name}
              </Txt>
              <Txt variant="small">{g.meta}</Txt>
            </View>
            {g.unread ? (
              <View style={styles.badge} accessibilityLabel={`${g.unread} okunmamış mesaj`}>
                <Txt style={{ color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 11 }}>{g.unread}</Txt>
              </View>
            ) : null}
          </Pressable>
        ))}

        <View style={{ marginTop: space.lg }}>
          <Button label="Etkinlik oluştur" icon="calendar" variant="outline" href="/etkinlik/olustur" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: colors.ink },
  next: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginBottom: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
}));
