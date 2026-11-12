/**
 * Hedef koy / düzenle. Aynı dönem + ölçü + tür için tek hedef var; yeniden kaydedince değeri güncellenir.
 * Düzenlerken parametreler: id, donem, olcu, activity ('' = hepsi), hedef (birimde: m, sn, adet).
 */
import { ACTIVITY_LABELS, ACTIVITY_TYPES, DONEMLER, OLCULER, formatDecimal, type ActivityType, type Donem, type Olcu } from '@lykiva/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, Chip, Label } from '@/components/ui';
import { degerdenGirdi, donemAdi, girdiBirimi, girdidenDeger, hedefKaydet, hedefSil, olcuAdi, ONERILER } from '@/data/hedef';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

const donemMi = (x: unknown): x is Donem => DONEMLER.includes(x as Donem);
const olcuMu = (x: unknown): x is Olcu => OLCULER.includes(x as Olcu);
const turMu = (x: unknown): x is ActivityType => ACTIVITY_TYPES.includes(x as ActivityType);

/** "12,5" ya da "12.5" → 12.5 */
function sayiOku(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function HedefEkleScreen() {
  const p = useLocalSearchParams<{ id?: string; donem?: string; olcu?: string; activity?: string; hedef?: string }>();
  const insets = useSafeAreaInsets();
  const duzenleme = donemMi(p.donem) && olcuMu(p.olcu);
  const [donem, setDonem] = useState<Donem>(donemMi(p.donem) ? p.donem : 'hafta');
  const [olcu, setOlcu] = useState<Olcu>(olcuMu(p.olcu) ? p.olcu : 'mesafe');
  const [tur, setTur] = useState<ActivityType | null>(turMu(p.activity) ? p.activity : null);
  const [girdi, setGirdi] = useState(() => {
    const h = Number(p.hedef);
    if (!duzenleme || !Number.isFinite(h) || h <= 0) return '';
    const g = degerdenGirdi(p.olcu as Olcu, h);
    return String(Math.round(g * 10) / 10);
  });
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const deger = sayiOku(girdi);

  async function kaydet() {
    setHata(null);
    if (deger == null || deger <= 0) return setHata($t('hedefler.deger_gir'));
    if (olcu === 'sayi' && !Number.isInteger(deger)) return setHata($t('hedefler.tam_sayi'));
    setKaydediyor(true);
    try {
      const yeni = await hedefKaydet(donem, olcu, girdidenDeger(olcu, deger), tur);
      // Düzenlerken dönem / ölçü / tür değiştiyse yeni hedef açıldı; eskisi kalmasın
      if (p.id && yeni !== p.id) await hedefSil(p.id).catch(() => undefined);
      router.back();
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={duzenleme ? $t('hedefler.hedefi_duzenle') : $t('hedefler.yeni_hedef')} backIcon="close" center />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, gap: 18, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        <View>
          <Label>{$t('hedefler.donem')}</Label>
          <View accessibilityRole="radiogroup" style={styles.seg}>
            {DONEMLER.map((d) => (
              <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: d === donem }} onPress={() => setDonem(d)} style={[styles.segBtn, d === donem && { backgroundColor: colors.ink }]}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: d === donem ? colors.ground : colors.ink }} numberOfLines={1}>
                  {donemAdi(d)}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Label>{$t('hedefler.olcu')}</Label>
          <View style={styles.sarmal} accessibilityRole="radiogroup">
            {OLCULER.map((o) => (
              <Chip key={o} label={olcuAdi(o)} role="radio" selected={o === olcu} onPress={() => setOlcu(o)} />
            ))}
          </View>
        </View>

        <View>
          <Label>{$t('hedefler.aktivite_turu')}</Label>
          <View style={styles.sarmal} accessibilityRole="radiogroup">
            <Chip label={$t('rekorlar.hepsi')} role="radio" tone="sea" selected={tur === null} onPress={() => setTur(null)} />
            {ACTIVITY_TYPES.map((t) => (
              <Chip key={t} label={ACTIVITY_LABELS[t]} role="radio" tone="sea" selected={tur === t} onPress={() => setTur(t)} />
            ))}
          </View>
        </View>

        <View>
          <Label>{$t('hedefler.hedef')}</Label>
          <View style={styles.girdiSatiri}>
            <TextInput
              value={girdi}
              onChangeText={setGirdi}
              keyboardType={olcu === 'sayi' ? 'number-pad' : 'decimal-pad'}
              placeholder="0"
              placeholderTextColor={colors.inkMuted}
              maxLength={7}
              accessibilityLabel={`${$t('hedefler.hedef')} (${girdiBirimi(olcu)})`}
              style={styles.girdi}
            />
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 18, color: colors.inkMuted }}>{girdiBirimi(olcu)}</Txt>
          </View>
          <View style={[styles.sarmal, { marginTop: 10 }]}>
            {ONERILER[olcu][donem].map((n) => (
              <Chip key={n} label={`${formatDecimal(n, 0)} ${girdiBirimi(olcu)}`} selected={deger === n} onPress={() => setGirdi(String(n))} />
            ))}
          </View>
        </View>

        {hata ? (
          <View style={styles.hata} accessibilityRole="alert">
            <Icon name="shield" size={18} color={colors.terraInk} />
            <Txt style={{ flex: 1, color: colors.terraInk }}>{hata}</Txt>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.alt, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={kaydediyor ? $t('hedefler.kaydediliyor') : $t('hedefler.kaydet')} icon="target" onPress={() => void kaydet()} disabled={kaydediyor} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  seg: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: colors.land },
  segBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  sarmal: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  girdiSatiri: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  girdi: { flex: 1, fontFamily: fontFamily.display, fontSize: 34, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 4 },
  hata: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: colors.terraSoft },
  alt: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
}));
