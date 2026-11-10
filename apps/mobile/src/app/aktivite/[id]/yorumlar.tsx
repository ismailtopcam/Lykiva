/**
 * Aktivitenin yorumları: beğeni, yorum listesi ve yorum yazma.
 * Kendi yorumunu ya da kendi aktivitendeki her yorumu basılı tutarak silebilirsin.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  aktiviteDegisti,
  aktiviteYorumlari,
  akisZamani,
  begen,
  sunucuAktivitesiMi,
  YORUM_SINIRI,
  yorumSil,
  yorumYaz,
  type Yorum,
  type YorumSayfasi,
} from '@/akis/akis';
import { Header } from '@/components/Header';
import { useSikayet } from '@/components/SikayetPenceresi';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Avatar } from '@/components/ui';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';

export default function YorumlarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!supabaseHazir || !sunucuAktivitesiMi(id)) {
    return (
      <View style={styles.root}>
        <Header title="Yorumlar" />
        <Txt variant="muted" style={{ textAlign: 'center', padding: space.xl }}>
          {id?.startsWith('yerel-')
            ? 'Bu kayıt henüz telefonda bekliyor. Sunucuya gönderilince yorum yazılabilir.'
            : 'Yorumlar sunucuya bağlıyken çalışır.'}
        </Txt>
      </View>
    );
  }
  return <Yorumlar id={id} />;
}

function Yorumlar({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const [sayfa, setSayfa] = useState<YorumSayfasi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [taslak, setTaslak] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [gonderHatasi, setGonderHatasi] = useState<string | null>(null);
  const liste = useRef<FlatList<Yorum>>(null);
  const ilkKaydirma = useRef(false);
  const sikayet = useSikayet();

  const yukle = useCallback(async () => {
    try {
      const s = await aktiviteYorumlari(id);
      if (!s) {
        setHata('Aktivite bulunamadı ya da görme iznin yok');
        return;
      }
      setHata(null);
      setSayfa(s);
      aktiviteDegisti(id, { like_count: s.like_count, comment_count: s.comment_count, liked: s.liked });
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yorumlar yüklenemedi');
    }
  }, [id]);

  // Açılışta ve ekrana her dönüşte (ör. kişi sayfasından) yenile
  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  async function yolla() {
    const metin = taslak.trim();
    if (!metin || gonderiliyor) return;
    setGonderiliyor(true);
    setGonderHatasi(null);
    try {
      const y = await yorumYaz(id, metin);
      setTaslak('');
      setSayfa((s) => (s ? { ...s, comments: [...s.comments, y], comment_count: s.comment_count + 1 } : s));
      aktiviteDegisti(id, { comment_count: (sayfa?.comment_count ?? 0) + 1 });
      setTimeout(() => liste.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      setGonderHatasi(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setGonderiliyor(false);
    }
  }

  async function begeniDegistir() {
    if (!sayfa) return;
    const onceki = { liked: sayfa.liked, like_count: sayfa.like_count };
    const yeni = { liked: !onceki.liked, like_count: Math.max(0, onceki.like_count + (onceki.liked ? -1 : 1)) };
    setSayfa((s) => (s ? { ...s, ...yeni } : s));
    aktiviteDegisti(id, yeni);
    try {
      await begen(id, yeni.liked);
    } catch {
      setSayfa((s) => (s ? { ...s, ...onceki } : s));
      aktiviteDegisti(id, onceki);
    }
  }

  function secenekler(y: Yorum) {
    if (!sayfa) return;
    const silebilir = y.mine || sayfa.i_own_activity;
    Alert.alert(y.mine ? 'Yorumun' : `${y.display_name} yorumu`, undefined, [
      ...(!y.mine ? [{ text: 'Şikayet et', onPress: () => sikayet.ac('comment', y.id, `${y.display_name}: ${y.body.slice(0, 80)}`) }] : []),
      ...(!silebilir ? [] : [{
        text: 'Sil',
        style: 'destructive' as const,
        onPress: () =>
          void yorumSil(y.id)
            .then((silindi) => {
              if (!silindi) return void yukle();
              setSayfa((s) => (s ? { ...s, comments: s.comments.filter((c) => c.id !== y.id), comment_count: Math.max(0, s.comment_count - 1) } : s));
              aktiviteDegisti(id, { comment_count: Math.max(0, sayfa.comment_count - 1) });
            })
            .catch((e: unknown) => Alert.alert('Silinemedi', e instanceof Error ? e.message : String(e))),
      }]),
      { text: 'Vazgeç', style: 'cancel' as const },
    ]);
  }

  const kalan = YORUM_SINIRI - taslak.length;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Yorumlar" />

      {sayfa ? (
        <View style={styles.ozet}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: sayfa.liked }}
            accessibilityLabel={`${sayfa.liked ? 'Beğeniyi geri al' : 'Beğen'}, ${sayfa.like_count} beğeni`}
            onPress={() => void begeniDegistir()}
            style={styles.begen}>
            <Icon name="heart" size={20} color={sayfa.liked ? colors.terra : colors.ink} />
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: sayfa.liked ? colors.terra : colors.ink }}>{sayfa.like_count} beğeni</Txt>
          </Pressable>
          <Txt variant="small">{sayfa.comment_count} yorum</Txt>
        </View>
      ) : null}

      <FlatList
        ref={liste}
        data={sayfa?.comments ?? []}
        keyExtractor={(y) => y.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          // İlk açılışta en yeni yoruma in
          if (sayfa && !ilkKaydirma.current) {
            ilkKaydirma.current = true;
            liste.current?.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={
          hata ? (
            <Txt accessibilityRole="alert" style={{ color: colors.terraInk, textAlign: 'center', marginTop: space.lg }}>
              {hata}
            </Txt>
          ) : sayfa ? (
            <Txt variant="muted" style={{ textAlign: 'center', marginTop: space.lg }}>
              Henüz yorum yok. İlk yorumu sen yaz.
            </Txt>
          ) : (
            <ActivityIndicator color={colors.terra} style={{ marginTop: space.lg }} />
          )
        }
        renderItem={({ item: y }) => (
          <Pressable
            onLongPress={() => secenekler(y)}
            accessibilityLabel={`${y.mine ? 'Sen' : y.display_name}, ${akisZamani(y.created_at)}: ${y.body}`}
            accessibilityHint={y.mine || sayfa?.i_own_activity ? 'Silmek için basılı tut' : 'Şikayet etmek için basılı tut'}
            style={styles.yorum}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${y.display_name} profili`}
              onPress={() => (y.mine ? router.navigate('/profil') : router.push({ pathname: '/kisi/[id]', params: { id: y.user_id } }))}
              hitSlop={4}>
              <Avatar initials={basHarfler(y.display_name)} tone={grupRengi(y.user_id)} size={34} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={{ fontSize: 13 }} numberOfLines={1}>
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{y.mine ? 'Sen' : y.display_name}</Txt>
                <Txt variant="small"> · {akisZamani(y.created_at)}</Txt>
              </Txt>
              <Txt style={styles.metin}>{y.body}</Txt>
            </View>
          </Pressable>
        )}
      />

      {gonderHatasi ? (
        <Txt accessibilityRole="alert" style={{ color: colors.terraInk, paddingHorizontal: space.lg, paddingBottom: 4 }}>
          {gonderHatasi}
        </Txt>
      ) : null}
      {kalan < 100 ? <Txt style={[styles.sayac, kalan < 0 && { color: colors.terraInk }]}>{kalan}</Txt> : null}
      <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          value={taslak}
          onChangeText={setTaslak}
          placeholder="Yorum yaz…"
          placeholderTextColor={colors.inkMuted}
          accessibilityLabel="Yorum"
          maxLength={YORUM_SINIRI}
          multiline
          editable={!!sayfa}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gönder"
          accessibilityState={{ disabled: !taslak.trim() || gonderiliyor, busy: gonderiliyor }}
          onPress={() => void yolla()}
          disabled={!taslak.trim() || gonderiliyor}
          style={[styles.send, (!taslak.trim() || gonderiliyor) && { opacity: 0.5 }]}>
          {gonderiliyor ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Icon name="send" size={20} color="#FFFFFF" />}
        </Pressable>
      </View>
      {sikayet.pencere}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  ozet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingRight: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  begen: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 6 },
  yorum: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  metin: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 2 },
  sayac: { alignSelf: 'flex-end', paddingHorizontal: space.lg, paddingBottom: 4, fontSize: 12, color: colors.inkMuted },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: colors.ground,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fontFamily.body,
    fontSize: 15,
    color: colors.ink,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center' },
});
