import { ACTIVITY_LABELS } from '@lykiva/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Logo } from '@/components/Logo';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Avatar, AvatarStack, Card, Chip, Stat } from '@/components/ui';
import { kasKalkan, liveFriends, people } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

const filters = ['Takip ettiklerim', 'Gruplarım', 'Yakınımda'];

/** Sunucu anahtarı yokken gösterilen tasarım örneği (akış) */
export function OrnekAkis() {
  const [filter, setFilter] = useState(0);
  const a = kasKalkan;
  const owner = people[a.owner];

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <Logo />
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="search" label="Ara" onPress={() => router.push('/kesfet')} />
          <IconButton icon="chat" label="Mesajlar" onPress={() => router.push('/grup/ornek/sohbet')} />
          <IconButton icon="bell" label="Bildirimler" />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.liveHead}>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.inkMuted }}>
            Şu an yolda · {liveFriends.length} arkadaş
          </Txt>
          <Pressable accessibilityRole="link" onPress={() => router.push('/canli-harita')} hitSlop={8}>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.terra }}>Haritada izle</Txt>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveRow}>
          {liveFriends.map((f) => {
            const p = people[f.person];
            return (
              <Pressable
                key={f.person}
                accessibilityRole="link"
                accessibilityLabel={`${p.name}, ${f.activity}, canlı`}
                onPress={() => router.push('/canli-harita')}
                style={styles.liveItem}>
                <Avatar initials={p.initials} tone={p.tone} size={56} ring={f.paused ? colors.lineStrong : colors.terra} />
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 11 }}>{p.short}</Txt>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="link" onPress={() => router.push('/etkinlik/ornek')} style={styles.liveItem}>
            <View style={styles.eventBubble}>
              <Icon name="calendar" size={22} color={colors.inkMuted} />
            </View>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 11 }}>Cumartesi</Txt>
          </Pressable>
        </ScrollView>

        <View accessibilityRole="tablist" style={styles.filters}>
          {filters.map((f, i) => (
            <Chip key={f} label={f} role="tab" selected={i === filter} onPress={() => setFilter(i)} />
          ))}
        </View>

        <Card style={styles.post}>
          <View style={styles.postHead}>
            <Avatar initials={owner.initials} tone={owner.tone} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                {owner.name} <Txt style={{ color: colors.inkMuted }}>· {people[a.with[0]].short} ve {a.with.length - 1} kişiyle</Txt>
              </Txt>
              <Txt variant="small">Bugün 08:12 · {a.place}</Txt>
            </View>
            <View style={styles.typeBadge}>
              <Icon name="bike" size={15} color={colors.seaInk} strokeWidth={2} />
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.seaInk }}>{ACTIVITY_LABELS[a.type]}</Txt>
            </View>
          </View>

          <Pressable accessibilityRole="link" onPress={() => router.push('/aktivite/ornek')}>
            <Txt style={styles.postTitle}>{a.title}</Txt>
            <View style={styles.statRow}>
              <Stat label="Mesafe" value={a.distanceKm} unit="km" size={18} />
              <Stat label="Tırmanış" value={String(a.climbM)} unit="m" size={18} />
              <Stat label="Süre" value="1:38" size={18} />
              <Stat label="Ort. hız" value={a.avgSpeed} unit="km/sa" size={18} />
            </View>
            <TopoMap
              route={a.route}
              interactive={false}
              markers={[
                { id: 's', coord: a.route[0], kind: 'start' },
                { id: 'e', coord: a.route[a.route.length - 1], kind: 'end' },
              ]}
              padding={{ top: 24, bottom: 24 }}
              style={{ height: 176 }}
              accessibilityLabel={`${a.title} rotasının haritası`}
            />
          </Pressable>

          <View style={styles.together}>
            <AvatarStack items={a.with.map((id) => people[id])} size={26} />
            <Txt variant="small">Birlikte sürdüler · {a.stops.length} mola</Txt>
          </View>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Beğen, ${a.likes}`} style={styles.action}>
              <Icon name="heart" size={21} color={colors.terra} />
              <Txt style={[styles.actionText, { color: colors.terra }]}>{a.likes}</Txt>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Yorumlar, ${a.comments}`} style={styles.action}>
              <Icon name="chat" size={21} />
              <Txt style={styles.actionText}>{a.comments}</Txt>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push('/rota/ornek')} style={styles.action}>
              <Icon name="bookmark" size={21} />
              <Txt style={styles.actionText}>Rotayı kaydet</Txt>
            </Pressable>
            <IconButton icon="share" label="Paylaş" onPress={() => router.push('/aktivite/ornek/paylas')} />
          </View>
        </Card>

        <Card style={[styles.post, { marginTop: space.md }]}>
          <View style={styles.postHead}>
            <Avatar initials="LY" tone="ink" />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>
                Likya Yolu Yürüyüşçüleri <Txt style={{ color: colors.inkMuted }}>· yeni rota</Txt>
              </Txt>
              <Txt variant="small">Topluluk · 2 saat önce</Txt>
            </View>
          </View>
          <Pressable accessibilityRole="link" onPress={() => router.push('/rota/ornek')}>
            <Txt style={[styles.postTitle, { paddingBottom: space.lg }]}>Faralya – Kabak patikası</Txt>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.lg, paddingRight: space.sm, paddingBottom: space.sm },
  liveHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, marginBottom: 10, marginTop: 4 },
  liveRow: { paddingHorizontal: space.lg, gap: 14, paddingBottom: 14 },
  liveItem: { alignItems: 'center', gap: 6, width: 60 },
  eventBubble: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9C9282', alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  post: { marginHorizontal: space.md },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 10 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.seaSoft },
  postTitle: { fontFamily: fontFamily.display, fontSize: 21, paddingHorizontal: 14, paddingBottom: 10, color: colors.ink },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 },
  together: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 10 },
  actionText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.ink },
});
