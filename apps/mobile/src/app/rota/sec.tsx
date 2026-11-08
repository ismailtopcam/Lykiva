import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { RotaSatiri } from '@/components/RotaSatiri';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { supabaseHazir } from '@/lib/supabase';
import { rotaDetayi, useRotalarim } from '@/rota/rotalar';
import { kayitRotasiOlustur, rotaSec } from '@/rota/secim';
import { colors, space } from '@/theme';

/** Kayıt başlatmadan önce takip edilecek rotayı seç */
export default function RotaSecScreen() {
  const insets = useSafeAreaInsets();
  const { liste, hata, yenile } = useRotalarim();
  const [aciliyor, setAciliyor] = useState<string | null>(null);
  const [secimHatasi, setSecimHatasi] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void yenile();
    }, [yenile]),
  );

  async function sec(id: string) {
    setSecimHatasi(null);
    setAciliyor(id);
    try {
      const r = await rotaDetayi(id);
      if (!r || r.koordinatlar.length < 2) throw new Error('Rota yüklenemedi');
      rotaSec(kayitRotasiOlustur(r));
      router.back();
    } catch (e) {
      setSecimHatasi(e instanceof Error ? e.message : 'Rota yüklenemedi');
    } finally {
      setAciliyor(null);
    }
  }

  return (
    <View style={styles.root}>
      <Header title="Rota seç" backIcon="close" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: insets.bottom + 24 }}>
        <Button label="Yeni rota çiz" icon="route" variant="dark" href="/rota/olustur" style={{ marginBottom: space.sm }} />

        {!supabaseHazir ? <Txt variant="muted">Sunucu anahtarı girilmemiş; rotalar sunucuda saklandığı için şu an listelenemiyor.</Txt> : null}
        {hata ? <Txt style={{ color: colors.terraInk }}>{hata}</Txt> : null}
        {secimHatasi ? (
          <Txt accessibilityRole="alert" style={{ color: colors.terraInk }}>
            {secimHatasi}
          </Txt>
        ) : null}

        {liste === null && supabaseHazir ? <ActivityIndicator color={colors.terra} style={{ marginTop: space.lg }} /> : null}
        {liste && liste.length === 0 && supabaseHazir ? (
          <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: space.lg }}>
            Henüz rotan yok. Haritada çizebilir ya da bir aktiviteni rota olarak kaydedebilirsin.
          </Txt>
        ) : null}
        {liste?.map((r) => <RotaSatiri key={r.id} rota={r} bekliyor={aciliyor === r.id} onPress={() => void sec(r.id)} />)}

        <Txt variant="small" style={{ marginTop: space.md }}>
          Seçilen rota telefona kaydedilir; kayıt sırasında internet olmasa da kalan mesafe hesaplanır.
        </Txt>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
});
