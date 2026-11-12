import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from '@lykiva/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, Chip, Label, ToggleRow } from '@/components/ui';
import { grupOlustur } from '@/grup/gruplar';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

const turler = (): { id: 'ozel' | 'acik'; ad: string; aciklama: string; icon: IconName }[] => [
  { id: 'ozel', ad: $t('grup_olustur.ozel_grup'), aciklama: $t('grup_olustur.arkadaslar_ekip_yalnizca_davet'), icon: 'lock' },
  { id: 'acik', ad: $t('grup_olustur.acik_topluluk'), aciklama: $t('grup_olustur.kulup_sehir_toplulugu_kesfette'), icon: 'users' },
];

export default function GrupOlusturScreen() {
  const insets = useSafeAreaInsets();
  const [ad, setAd] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [sehir, setSehir] = useState('');
  const [aktivite, setAktivite] = useState<ActivityType | null>(null);
  // Keşfet'teki "Topluluk kur" açık topluluğu seçili açar
  const { tur: turParam } = useLocalSearchParams<{ tur?: string }>();
  const [tur, setTur] = useState<'ozel' | 'acik'>(turParam === 'acik' ? 'acik' : 'ozel');
  const [onay, setOnay] = useState(false);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function olustur() {
    if (ad.trim().length < 2) {
      setHata($t('grup_olustur.grup_adi_en_az'));
      return;
    }
    setKaydediyor(true);
    setHata(null);
    try {
      const id = await grupOlustur({
        name: ad.trim(),
        description: aciklama.trim(),
        city: sehir.trim(),
        primary_activity: aktivite,
        is_private: tur === 'ozel',
        is_community: tur === 'acik',
        requires_approval: tur === 'acik' && onay,
      });
      router.replace({ pathname: '/grup/[id]', params: { id } });
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('grup_olustur.grup_olusturulamadi'));
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={$t('grup_olustur.yeni_grup')} backIcon="close" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 24, gap: space.md }} keyboardShouldPersistTaps="handled">
        <View>
          <Label>{$t('grup_olustur.grup_adi')}</Label>
          <TextInput value={ad} onChangeText={setAd} placeholder={$t('grup_olustur.or_pedal_kas')} placeholderTextColor={colors.inkMuted} maxLength={60} accessibilityLabel={$t('grup_olustur.grup_adi')} style={styles.input} />
        </View>
        <View>
          <Label>{$t('grup_olustur.aciklama_istege_bagli')}</Label>
          <TextInput
            value={aciklama}
            onChangeText={setAciklama}
            placeholder={$t('grup_olustur.ne_yaparsiniz_ne_siklikla')}
            placeholderTextColor={colors.inkMuted}
            maxLength={500}
            multiline
            accessibilityLabel={$t('ortak.aciklama')}
            style={[styles.input, { height: 88, textAlignVertical: 'top', paddingTop: 12 }]}
          />
        </View>
        <View>
          <Label>{$t('grup_olustur.sehir_istege_bagli')}</Label>
          <TextInput value={sehir} onChangeText={setSehir} placeholder={$t('grup_olustur.or_kas')} placeholderTextColor={colors.inkMuted} maxLength={60} accessibilityLabel={$t('ortak.sehir')} style={styles.input} />
        </View>
        <View>
          <Label>{$t('grup_olustur.ana_aktivite')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
            {ACTIVITY_TYPES.map((t) => (
              <Chip key={t} label={ACTIVITY_LABELS[t]} role="radio" selected={aktivite === t} onPress={() => setAktivite(aktivite === t ? null : t)} />
            ))}
          </View>
        </View>

        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          <Label>{$t('grup_olustur.grup_turu')}</Label>
          {turler().map((t) => {
            const on = t.id === tur;
            return (
              <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setTur(t.id)} style={[styles.tur, on && styles.turOn]}>
                <Icon name={t.icon} color={on ? colors.seaInk : colors.ink} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15 }}>{t.ad}</Txt>
                  <Txt variant="small">{t.aciklama}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
        {tur === 'acik' ? <ToggleRow title={$t('grup_olustur.katilim_onayli_olsun')} subtitle={$t('grup_olustur.katilmak_isteyenleri_sen_onaylarsin')} value={onay} onChange={setOnay} /> : null}

        {!supabaseHazir ? <Txt variant="muted">{$t('grup_olustur.sunucu_anahtari_girilmemis_grup')}</Txt> : null}
        {hata ? (
          <Txt accessibilityRole="alert" style={{ color: colors.terraInk }}>
            {hata}
          </Txt>
        ) : null}
        <Button label={kaydediyor ? $t('grup_olustur.kuruluyor') : $t('grup_olustur.grubu_kur')} icon="users" onPress={() => void olustur()} disabled={kaydediyor || !supabaseHazir} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  input: { height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
  tur: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  turOn: { borderColor: colors.sea, backgroundColor: colors.seaSoft },
}));
