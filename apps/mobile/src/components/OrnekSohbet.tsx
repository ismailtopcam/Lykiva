import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteThumb } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Avatar } from '@/components/ui';
import { groupMessages, kasKalkanRoute, people } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

export function OrnekSohbet() {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [mine, setMine] = useState<string[]>(['Cumartesi olur, ben varım!']);
  const [vote, setVote] = useState<number | null>(null);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMine([...mine, t]);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <IconButton icon="back" label="Geri" onPress={() => router.back()} />
        <Avatar initials="PK" tone="sea" square />
        <View style={{ flex: 1 }}>
          <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 16 }}>Pedal Kaş</Txt>
          <Txt style={{ fontSize: 12, fontFamily: fontFamily.bodySemiBold, color: colors.sea }}>2 kişi şu an yolda</Txt>
        </View>
        <IconButton icon="pin" label="Canlı haritayı aç" onPress={() => router.push('/canli-harita')} />
      </View>

      <Pressable accessibilityRole="link" onPress={() => router.push('/etkinlik/ornek')} style={styles.pinned}>
        <Icon name="calendar" size={18} color="#5E2810" />
        <Txt style={{ flex: 1, fontSize: 13, color: '#5E2810' }}>
          <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13, color: '#5E2810' }}>Sabitlendi:</Txt> Gün doğumu sürüşü · Cmt 06:45
        </Txt>
        <Txt style={{ fontSize: 13, fontFamily: fontFamily.bodyBold, color: '#5E2810' }}>9 katılımcı</Txt>
      </Pressable>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
        <Txt variant="caption" style={{ textAlign: 'center' }}>
          Bugün
        </Txt>
        {groupMessages.map((m, i) => {
          const p = people[m.from];
          const showName = i === 0 || groupMessages[i - 1].from !== m.from;
          return (
            <View key={i} style={styles.inRow}>
              <Avatar initials={p.initials} tone={p.tone} size={28} />
              <View style={{ maxWidth: 260 }}>
                {showName ? (
                  <Txt variant="small" style={{ marginLeft: 4, marginBottom: 3 }}>
                    {p.short}
                  </Txt>
                ) : null}
                {m.kind === 'text' ? (
                  <View style={styles.bubbleIn}>
                    <Txt style={{ fontSize: 14, lineHeight: 20 }}>{m.text}</Txt>
                  </View>
                ) : m.kind === 'route' ? (
                  <Pressable accessibilityRole="link" onPress={() => router.push('/rota/ornek')} style={[styles.bubbleIn, { padding: 0, width: 240, overflow: 'hidden' }]}>
                    <RouteThumb route={kasKalkanRoute} size={240} height={100} />
                    <View style={{ padding: 12 }}>
                      <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>{m.title}</Txt>
                      <Txt variant="small">{m.stats}</Txt>
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.poll}>
                    <Txt variant="label" color="#B9C2BA">
                      Anket
                    </Txt>
                    <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14, color: colors.night.text, marginVertical: 8 }}>{m.question}</Txt>
                    {m.options.map((o, k) => {
                      const votes = o.votes + (vote === k ? 1 : 0);
                      const total = m.options.reduce((s, x) => s + x.votes, 0) + (vote !== null ? 1 : 0);
                      return (
                        <Pressable
                          key={o.label}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: vote === k }}
                          onPress={() => setVote(k)}
                          style={styles.option}>
                          <View style={[styles.optionFill, { width: `${(votes / total) * 100}%`, backgroundColor: k === 0 ? colors.sea : '#3E4A44' }]} />
                          <Txt style={styles.optionText}>
                            {vote === k ? '✓ ' : ''}
                            {o.label}
                          </Txt>
                          <Txt style={styles.optionText}>{votes}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {mine.map((t, i) => (
          <View key={'m' + i} style={styles.bubbleOut}>
            <Txt style={{ fontSize: 14, lineHeight: 20, color: '#FFFFFF' }}>{t}</Txt>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
        <IconButton icon="plus" label="Rota, etkinlik veya konum ekle" style={{ backgroundColor: colors.ground }} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          placeholder="Mesaj yaz…"
          placeholderTextColor={colors.inkMuted}
          accessibilityLabel="Mesaj"
          returnKeyType="send"
          style={styles.input}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Gönder" onPress={send} style={styles.send}>
          <Icon name="send" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.sm, paddingBottom: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg, paddingVertical: 10, backgroundColor: colors.terraSoft },
  inRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  bubbleIn: { padding: 12, borderRadius: 16, borderBottomLeftRadius: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  bubbleOut: { alignSelf: 'flex-end', maxWidth: 260, padding: 12, borderRadius: 16, borderBottomRightRadius: 4, backgroundColor: colors.terra },
  poll: { width: 240, padding: 12, borderRadius: 16, borderBottomLeftRadius: 4, backgroundColor: colors.ink },
  option: { height: 36, borderRadius: 10, backgroundColor: '#2A3631', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 6 },
  optionFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optionText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.night.text },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, height: 44, borderRadius: 22, backgroundColor: colors.ground, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center' },
});
