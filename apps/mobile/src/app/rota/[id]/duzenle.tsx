import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, Chip, Label } from '@/components/ui';
import { rotaGuncelle, rotaSil, useRota, type Rota } from '@/data/rota';
import { useHesap } from '@/lib/giris';
import { colors, fontFamily, radius, space } from '@/theme';

const GORUNURLUKLER: [Rota['visibility'], string][] = [
  ['private', 'Sadece ben'],
  ['followers', 'Takipçilerim'],
  ['public', 'Herkes'],
];

/** Sahibi için: rotanın adı, notları, görünürlüğü ve silme */
export default function RotaDuzenleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { r, hata: yuklemeHatasi } = useRota(id);
  const hesap = useHesap();
  const insets = useSafeAreaInsets();
  const [ad, setAd] = useState<string | null>(null);
  const [not, setNot] = useState<string | null>(null);
  const [gorunurluk, setGorunurluk] = useState<Rota['visibility'] | null>(null);
  const [isliyor, setIsliyor] = useState<'kaydet' | 'sil' | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  if (!r) {
    return (
      <View style={[styles.root, { alignItems: 'center' }]}>
        <Header title="Rotayı düzenle" backIcon="close" center />
        {yuklemeHatasi ? <Txt variant="muted">{yuklemeHatasi}</Txt> : <ActivityIndicator color={colors.terra} style={{ marginTop: space.xl }} />}
      </View>
    );
  }
  const benim = !!hesap && r.ownerId === hesap.id;
  const degerAd = ad ?? r.name;
  const degerNot = not ?? r.notes ?? '';
  const degerGorunurluk = gorunurluk ?? r.visibility;
  const secenekler = r.visibility === 'groups' ? [...GORUNURLUKLER, ['groups', 'Gruplarım'] as [Rota['visibility'], string]] : GORUNURLUKLER;
  const degisti = ad !== null || not !== null || gorunurluk !== null;

  async function kaydet() {
    setHata(null);
    setIsliyor('kaydet');
    try {
      await rotaGuncelle(r!.id, { name: degerAd, notes: degerNot, visibility: degerGorunurluk });
      router.back();
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setIsliyor(null);
    }
  }

  function silmeyiSor() {
    Alert.alert('Rota silinsin mi?', `"${r!.name}" kalıcı olarak silinir. Gruplara paylaşımı da kalkar; bu rotayı kullanan etkinlikler rotasız kalır. Geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive' as const,
        onPress: async () => {
          setHata(null);
          setIsliyor('sil');
          try {
            await rotaSil(r!.id);
            router.dismissAll();
          } catch (e) {
            setHata(e instanceof Error ? e.message : 'Silinemedi');
            setIsliyor(null);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Rotayı düzenle" backIcon="close" center />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, gap: 18, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        {!benim ? (
          <Txt variant="muted">Yalnızca kendi rotanı düzenleyebilirsin.</Txt>
        ) : (
          <>
            <View>
              <Label>Rotanın adı</Label>
              <TextInput value={degerAd} onChangeText={setAd} placeholder="ör. Faralya – Kabak" placeholderTextColor={colors.inkMuted} maxLength={80} accessibilityLabel="Rotanın adı" style={styles.input} />
            </View>
            <View>
              <Label>Kimler görebilir</Label>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }} accessibilityRole="radiogroup">
                {secenekler.map(([v, etiket]) => (
                  <Chip key={v} label={etiket} role="radio" selected={v === degerGorunurluk} onPress={() => setGorunurluk(v)} />
                ))}
              </View>
            </View>
            <View>
              <Label>Notlar</Label>
              <TextInput
                value={degerNot}
                onChangeText={setNot}
                placeholder="ör. Su kaynağı 4. km'de, öğleden sonra gölgesiz"
                placeholderTextColor={colors.inkMuted}
                maxLength={1000}
                multiline
                accessibilityLabel="Notlar"
                style={[styles.input, { height: 110, paddingTop: 12, textAlignVertical: 'top' }]}
              />
            </View>
            <View style={styles.tehlike}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }}>Rotayı sil</Txt>
              <Txt variant="small" style={{ marginTop: 2, marginBottom: space.md }}>
                Rota kalıcı olarak silinir. Bu rotayla kaydettiğin aktiviteler silinmez.
              </Txt>
              <Button label={isliyor === 'sil' ? 'Siliniyor…' : 'Rotayı sil'} variant="outline" onPress={silmeyiSor} disabled={!!isliyor} />
            </View>
          </>
        )}
        {hata ? (
          <View style={styles.hata} accessibilityRole="alert">
            <Icon name="shield" size={18} color={colors.terraInk} />
            <Txt style={{ flex: 1, color: colors.terraInk }}>{hata}</Txt>
          </View>
        ) : null}
      </ScrollView>
      {benim ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <Button label={isliyor === 'kaydet' ? 'Kaydediliyor…' : 'Kaydet'} onPress={() => void kaydet()} disabled={!!isliyor || !degisti} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  input: { height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
  tehlike: { padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  hata: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: colors.terraSoft },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
