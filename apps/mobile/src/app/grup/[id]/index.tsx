import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteThumb } from '@/components/charts';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Avatar, AvatarStack, DateBadge } from '@/components/ui';
import { events, kasKalkanRoute, people } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

const tabs = ['Akış', 'Rotalar', 'Etkinlikler', 'Üyeler'];

export default function GrupScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [going, setGoing] = useState(true);
  const e = events[0];

  const shortcuts: { label: string; icon: IconName; href: '/grup/ornek/sohbet' | '/etkinlik/olustur' | '/rota/ornek/paylas'; dark?: boolean; badge?: number }[] = [
    { label: 'Sohbet', icon: 'chat', href: '/grup/ornek/sohbet', dark: true, badge: 3 },
    { label: 'Etkinlik', icon: 'calendar', href: '/etkinlik/olustur' },
    { label: 'Rota paylaş', icon: 'route', href: '/rota/ornek/paylas' },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      <View style={[styles.hero, { paddingTop: insets.top + 6 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -8 }}>
          <IconButton icon="back" label="Geri" color="#FFFFFF" onPress={() => router.back()} />
          <IconButton icon="more" label="Grup ayarları" color="#FFFFFF" />
        </View>
        <Txt variant="label" color="#CFE8E5" style={{ marginTop: 6 }}>
          Bisiklet grubu · Kaş
        </Txt>
        <Txt style={styles.title} accessibilityRole="header">
          Pedal Kaş
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AvatarStack items={[people.mert, people.deniz, people.can]} size={30} bg={colors.sea} />
          <Txt style={{ fontSize: 13, color: '#E2F0EE' }}>12 üye · Özel grup</Txt>
        </View>
      </View>

      <View style={styles.shortcuts}>
        {shortcuts.map((s) => (
          <Pressable
            key={s.label}
            accessibilityRole="link"
            accessibilityLabel={s.badge ? `${s.label}, ${s.badge} okunmamış` : s.label}
            onPress={() => router.push(s.href)}
            style={[styles.shortcut, s.dark && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
            <Icon name={s.icon} color={s.dark ? colors.ground : colors.ink} />
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 12, color: s.dark ? colors.ground : colors.ink }}>{s.label}</Txt>
            {s.badge ? (
              <View style={styles.badge}>
                <Txt style={{ fontSize: 10, fontFamily: fontFamily.bodyBold, color: colors.ink }}>{s.badge}</Txt>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {tabs.map((t, i) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: i === tab }} onPress={() => setTab(i)} style={[styles.tab, i === tab && styles.tabOn]}>
            <Txt style={{ fontFamily: i === tab ? fontFamily.bodyBold : fontFamily.bodySemiBold, fontSize: 14, color: i === tab ? colors.ink : colors.inkMuted }}>{t}</Txt>
          </Pressable>
        ))}
      </View>

      <View style={{ padding: space.lg, gap: 10 }}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/etkinlik/ornek')} style={styles.card}>
          <DateBadge month={e.month} day={e.day} />
          <View style={{ flex: 1 }}>
            <Txt variant="small">Sıradaki grup etkinliği</Txt>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15 }}>{e.title}</Txt>
            <Txt variant="small">
              Cmt 06:45 · {e.going} kişi katılıyor
            </Txt>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: going }}
            onPress={() => setGoing(!going)}
            style={[styles.going, !going && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.lineStrong }]}>
            <Txt style={{ fontSize: 12, fontFamily: fontFamily.bodyBold, color: going ? '#FFFFFF' : colors.ink }}>{going ? 'Gidiyorum' : 'Katıl'}</Txt>
          </Pressable>
        </Pressable>

        <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <Avatar initials={people.mert.initials} tone={people.mert.tone} size={32} />
            <Txt style={{ fontSize: 13 }}>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>Mert</Txt> <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>bir rota paylaştı · 1 sa</Txt>
            </Txt>
          </View>
          <Pressable accessibilityRole="link" onPress={() => router.push('/rota/ornek')} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <RouteThumb route={kasKalkanRoute} size={56} />
            <View>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }}>Kaş – Patara sahil turu</Txt>
              <Txt variant="small">44 km · ↑ 610 m · Bisiklet</Txt>
            </View>
          </Pressable>
        </View>

        <View style={styles.month}>
          <Txt style={{ fontSize: 13, color: '#2E3631' }}>Bu ay grupça</Txt>
          <Txt style={{ fontFamily: fontFamily.display, fontSize: 18 }}>412 km · 7 sürüş</Txt>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  hero: { backgroundColor: colors.sea, paddingHorizontal: space.lg, paddingBottom: 18 },
  title: { fontFamily: fontFamily.displayHeavy, fontSize: 32, color: '#FFFFFF', letterSpacing: -0.6, marginVertical: 4 },
  shortcuts: { flexDirection: 'row', gap: 8, padding: space.lg },
  shortcut: { flex: 1, height: 64, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 4 },
  badge: { position: 'absolute', top: 8, right: 14, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.night.accent, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.ink },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  going: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.sea, justifyContent: 'center' },
  month: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: colors.land },
});
