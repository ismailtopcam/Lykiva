import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Avatar, Button, Chip, DateBadge, SectionHeader } from '@/components/ui';
import { communities, events } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

const tabs = ['Tümü', 'Rotalar', 'Topluluklar', 'Etkinlikler'];

export default function KesfetScreen() {
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [joined, setJoined] = useState<Record<string, boolean>>({});

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.head}>
          <Txt variant="display" accessibilityRole="header">
            Keşfet
          </Txt>
          <Pressable accessibilityRole="button" style={styles.newBtn}>
            <Icon name="plus" size={16} strokeWidth={2.2} />
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>Topluluk kur</Txt>
          </Pressable>
        </View>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.inkMuted} strokeWidth={2} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Rota, topluluk, etkinlik, kişi"
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel="Ara"
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={styles.tabs}>
          {tabs.map((t, i) => (
            <Chip key={t} label={t} role="tab" selected={i === tab} onPress={() => setTab(i)} />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: space.lg }}>
          <SectionHeader title="Yakınında bu hafta" action="Tümü" onAction={() => router.push('/etkinlik/ornek')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: 10, paddingBottom: space.lg }}>
          {events.map((e, i) => (
            <Pressable
              key={e.id}
              accessibilityRole="link"
              onPress={() => router.push('/etkinlik/ornek')}
              style={[styles.eventCard, i === 0 ? styles.eventDark : styles.eventLight]}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <DateBadge month={e.month} day={e.day} tone={i === 0 ? 'night' : 'sea'} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15, color: i === 0 ? colors.night.text : colors.ink }}>{e.title}</Txt>
                  <Txt style={{ fontSize: 12, color: i === 0 ? '#B9C2BA' : colors.inkMuted }}>{e.when}</Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <Txt style={{ fontSize: 12, color: i === 0 ? '#B9C2BA' : colors.inkMuted }}>{e.stats}</Txt>
                <Txt style={{ fontSize: 12, fontFamily: fontFamily.bodySemiBold, color: i === 0 ? colors.night.text : colors.ink }}>
                  {e.going} / {e.capacity} kişi
                </Txt>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: space.lg }}>
          <SectionHeader title="Sana uygun topluluklar" />
          {communities.map((c) => {
            const isMember = c.state === 'member' || joined[c.id];
            return (
              <View key={c.id} style={styles.community}>
                <Avatar initials={c.short} tone={c.tone} size={48} square />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                    {c.name}
                  </Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {c.meta}
                  </Txt>
                </View>
                {isMember ? (
                  <Button label="Üyesin" variant="outline" href="/grup/ornek" style={styles.smallBtn} />
                ) : c.state === 'request' ? (
                  <Button label="İstek gönder" variant="outline" onPress={() => setJoined({ ...joined, [c.id]: true })} style={styles.smallBtn} />
                ) : (
                  <Button label="Katıl" onPress={() => setJoined({ ...joined, [c.id]: true })} style={styles.smallBtn} />
                )}
              </View>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: space.lg, marginTop: space.lg, gap: space.sm }}>
          <Button label="Rota oluştur" icon="route" variant="dark" href="/rota/olustur" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.sm, marginBottom: space.md },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: colors.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, marginHorizontal: space.lg, paddingHorizontal: space.lg, borderRadius: 23, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  tabs: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 14 },
  eventCard: { width: 250, padding: 14, borderRadius: 18 },
  eventDark: { backgroundColor: colors.ink },
  eventLight: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  community: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
  smallBtn: { height: 38, paddingHorizontal: 14 },
});
