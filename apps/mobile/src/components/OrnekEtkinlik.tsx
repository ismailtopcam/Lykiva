import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { AvatarStack } from '@/components/ui';
import { kasKalkanRoute, people } from '@/data/ornek';
import { colors, fontFamily, space, temaliStil } from '@/theme';

const rsvps = ['Katılıyorum', 'Belki', 'Gelemem'];

function InfoRow({ icon, title, sub, onPress, right }: { icon: IconName; title: string; sub: string; onPress?: () => void; right?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole={onPress ? 'link' : undefined} onPress={onPress} disabled={!onPress} style={styles.info}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>{title}</Txt>
        <Txt variant="small">{sub}</Txt>
      </View>
      {right}
    </Pressable>
  );
}

export function OrnekEtkinlik() {
  const insets = useSafeAreaInsets();
  const [rsvp, setRsvp] = useState(0);
  const going = rsvp === 0 ? 9 : 8;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <TopoMap
          style={{ height: 240 + insets.top }}
          route={kasKalkanRoute}
          markers={[{ id: 'm', coord: kasKalkanRoute[0], kind: 'meeting' }]}
          padding={{ top: insets.top + 70, bottom: 24 }}
          accessibilityLabel="Etkinlik rotası ve buluşma noktası haritası"
        />
        <View style={{ padding: space.lg }}>
          <Txt variant="label" color={colors.sea}>
            Pedal Kaş · Grup etkinliği
          </Txt>
          <Txt variant="display" style={{ marginTop: 4, marginBottom: 12 }} accessibilityRole="header">
            Gün doğumu sürüşü
          </Txt>
          <View style={{ gap: 10, marginBottom: 14 }}>
            <InfoRow
              icon="calendar"
              title="Cumartesi, 14 Kasım · 06:45"
              sub="Tahmini dönüş 09:30"
              right={
                <Pressable accessibilityRole="button" style={styles.cal}>
                  <Txt style={{ fontSize: 12, fontFamily: fontFamily.bodySemiBold }}>Takvime ekle</Txt>
                </Pressable>
              }
            />
            <InfoRow icon="pin" title="Kaş Cumhuriyet Meydanı" sub="Buluşma noktası" />
            <InfoRow
              icon="route"
              title="32 km · ↑ 450 m · Orta seviye"
              sub="Kaş – Kalkan sahil yolu, gidiş-dönüş"
              onPress={() => router.push('/rota/ornek')}
              right={<Icon name="chevron" size={18} color={colors.inkMuted} strokeWidth={2} />}
            />
          </View>

          <View style={styles.people}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <AvatarStack items={[people.mert, people.deniz, people.can]} size={32} bg={colors.ground} />
              <Txt style={{ fontSize: 13 }}>
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{going} / 15</Txt> <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>katılıyor</Txt>
              </Txt>
            </View>
            <Pressable accessibilityRole="link" onPress={() => router.push('/grup/ornek/sohbet')} hitSlop={8}>
              <Txt style={{ fontSize: 13, fontFamily: fontFamily.bodySemiBold, color: colors.terra }}>Sohbete git</Txt>
            </Pressable>
          </View>

          <View style={styles.note}>
            <Icon name="shield" size={20} color="#0B3F3F" />
            <Txt style={{ flex: 1, fontSize: 13, color: '#0B3F3F' }}>Etkinlik başlayınca katılımcılar birbirini canlı haritada görür.</Txt>
          </View>
        </View>
      </ScrollView>

      <FloatingHeader right={<IconButton floating icon="share" label="Etkinliği paylaş" />} />
      <View accessibilityRole="radiogroup" style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {rsvps.map((r, i) => {
          const on = i === rsvp;
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setRsvp(i)}
              style={[styles.rsvp, on && { backgroundColor: i === 0 ? colors.terra : colors.ink, borderColor: i === 0 ? colors.terra : colors.ink }]}>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15, color: on ? '#FFFFFF' : colors.ink }}>{r}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  cal: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: 'center' },
  people: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.lineStrong },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: colors.seaSoft },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
  rsvp: { flex: 1, height: 54, borderRadius: 27, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
}));
