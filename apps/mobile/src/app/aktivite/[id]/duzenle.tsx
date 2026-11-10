import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sunucuAktivitesiMi } from '@/akis/akis';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, Label } from '@/components/ui';
import { aktiviteSil, aktiviteYenidenAdlandir, useAktivite } from '@/data/aktivite';
import { colors, fontFamily, radius, space } from '@/theme';

/** Sahibi için: aktiviteyi yeniden adlandır ya da sil. Görünürlük "Paylaş" ekranında. */
export default function AktiviteDuzenleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { a } = useAktivite(id);
  const insets = useSafeAreaInsets();
  const [baslik, setBaslik] = useState<string | null>(null);
  const [isliyor, setIsliyor] = useState<'kaydet' | 'sil' | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  if (!a) {
    return (
      <View style={[styles.root, { alignItems: 'center' }]}>
        <Header title="Aktiviteyi düzenle" backIcon="close" center />
        <ActivityIndicator color={colors.terra} style={{ marginTop: space.xl }} />
      </View>
    );
  }
  const duzenlenebilir = a.mine && sunucuAktivitesiMi(a.id);
  const deger = baslik ?? a.title;

  async function kaydet() {
    setHata(null);
    setIsliyor('kaydet');
    try {
      await aktiviteYenidenAdlandir(a!.id, deger);
      router.back();
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setIsliyor(null);
    }
  }

  function silmeyiSor() {
    Alert.alert('Aktivite silinsin mi?', `"${a!.title}" kalıcı olarak silinir. Molaları, beğenileri, yorumları ve paylaşım bağlantısı da gider; geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive' as const,
        onPress: async () => {
          setHata(null);
          setIsliyor('sil');
          try {
            await aktiviteSil(a!.id);
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
      <Header title="Aktiviteyi düzenle" backIcon="close" center />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, gap: 18, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        {!duzenlenebilir ? (
          <Txt variant="muted">Yalnızca sunucuya gönderilmiş kendi aktiviteni düzenleyebilirsin.</Txt>
        ) : (
          <>
            <View>
              <Label>Başlık</Label>
              <TextInput value={deger} onChangeText={setBaslik} placeholder="ör. Kaş sahil turu" placeholderTextColor={colors.inkMuted} maxLength={80} accessibilityLabel="Aktivitenin başlığı" style={styles.input} />
              <Txt variant="small" style={{ marginTop: 4 }}>
                Kimlerin görebileceğini aktivitenin Paylaş ekranından değiştirebilirsin.
              </Txt>
            </View>
            <View style={styles.tehlike}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }}>Aktiviteyi sil</Txt>
              <Txt variant="small" style={{ marginTop: 2, marginBottom: space.md }}>
                Kayıt, molalar, beğeniler ve yorumlar kalıcı olarak silinir. Bu aktiviteden kaydettiğin rota silinmez.
              </Txt>
              <Button label={isliyor === 'sil' ? 'Siliniyor…' : 'Aktiviteyi sil'} variant="outline" onPress={silmeyiSor} disabled={!!isliyor} />
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
      {duzenlenebilir ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <Button label={isliyor === 'kaydet' ? 'Kaydediliyor…' : 'Kaydet'} onPress={() => void kaydet()} disabled={!!isliyor || baslik === null} />
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
