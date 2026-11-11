/**
 * Grup meydan okuması başlat (grup sayfasından, `grup` parametresiyle). Grubun her üyesi açabilir; açan kendiliğinden katılır.
 * Herkese açık meydan okumalar yönetim panelinden açılır.
 */
import { ACTIVITY_LABELS, ACTIVITY_TYPES, OLCULER, donemAraligi, formatDecimal, type ActivityType, type Olcu } from '@lykiva/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { aralikMetni } from '@/components/MeydanOkumaKarti';
import { Txt } from '@/components/Txt';
import { Button, Chip, Label } from '@/components/ui';
import { girdiBirimi, girdidenDeger, olcuAdi, ONERILER } from '@/data/hedef';
import { meydanOkumaOlustur } from '@/data/meydanOkuma';
import { colors, fontFamily, radius, space } from '@/theme';
import { $t } from '@/i18n';

type Sure = 'bu_hafta' | 'bu_ay' | 'gun_7' | 'gun_30';
const SURELER: Sure[] = ['bu_hafta', 'bu_ay', 'gun_7', 'gun_30'];

function aralik(s: Sure, simdi: number): { bas: number; son: number } {
  if (s === 'bu_hafta') return donemAraligi('hafta', simdi);
  if (s === 'bu_ay') return donemAraligi('ay', simdi);
  const bugun = new Date(simdi);
  const bas = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
  const gun = s === 'gun_7' ? 7 : 30;
  return { bas: bas.getTime(), son: new Date(bas.getFullYear(), bas.getMonth(), bas.getDate() + gun).getTime() };
}

const sureAdi = (s: Sure) =>
  s === 'bu_hafta' ? $t('meydan.sure_bu_hafta') : s === 'bu_ay' ? $t('meydan.sure_bu_ay') : s === 'gun_7' ? $t('meydan.sure_gun', { n: 7 }) : $t('meydan.sure_gun', { n: 30 });

function sayiOku(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function MeydanOkumaOlusturScreen() {
  const { grup } = useLocalSearchParams<{ grup?: string }>();
  const insets = useSafeAreaInsets();
  const [simdi] = useState(() => Date.now());
  const [ad, setAd] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [olcu, setOlcu] = useState<Olcu>('mesafe');
  const [turler, setTurler] = useState<ActivityType[]>([]);
  const [sure, setSure] = useState<Sure>('bu_hafta');
  const [girdi, setGirdi] = useState('');
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const deger = sayiOku(girdi);
  const a = aralik(sure, simdi);
  const oneriDonemi = sure === 'bu_hafta' || sure === 'gun_7' ? 'hafta' : 'ay';

  function turSec(t: ActivityType) {
    setTurler((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  }

  async function baslat() {
    setHata(null);
    if (!grup) return setHata($t('meydan.grup_yok'));
    if (ad.trim().length < 2) return setHata($t('meydan.ad_ver'));
    if (deger == null || deger <= 0) return setHata($t('hedefler.deger_gir'));
    if (olcu === 'sayi' && !Number.isInteger(deger)) return setHata($t('hedefler.tam_sayi'));
    setKaydediyor(true);
    try {
      const id = await meydanOkumaOlustur({
        baslik: ad.trim(),
        aciklama: aciklama.trim(),
        olcu,
        hedef: girdidenDeger(olcu, deger),
        turler,
        baslangic: new Date(a.bas).toISOString(),
        bitis: new Date(a.son).toISOString(),
        group_id: grup,
      });
      router.replace({ pathname: '/meydan-okuma/[id]', params: { id } });
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={$t('meydan.yeni')} backIcon="close" center />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, gap: 18, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        <View>
          <Txt variant="small">{$t('meydan.ad')}</Txt>
          <TextInput
            value={ad}
            onChangeText={setAd}
            placeholder={$t('meydan.ad_ornek')}
            placeholderTextColor={colors.inkMuted}
            maxLength={80}
            accessibilityLabel={$t('meydan.ad')}
            style={styles.ad}
          />
        </View>

        <View>
          <Label>{$t('meydan.sure')}</Label>
          <View style={styles.sarmal} accessibilityRole="radiogroup">
            {SURELER.map((s) => (
              <Chip key={s} label={sureAdi(s)} role="radio" selected={s === sure} onPress={() => setSure(s)} />
            ))}
          </View>
          <Txt variant="small" style={{ marginTop: 6 }}>
            {aralikMetni(new Date(a.bas).toISOString(), new Date(a.son).toISOString())}
          </Txt>
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
            {ONERILER[olcu][oneriDonemi].map((n) => (
              <Chip key={n} label={`${formatDecimal(n, 0)} ${girdiBirimi(olcu)}`} selected={deger === n} onPress={() => setGirdi(String(n))} />
            ))}
          </View>
        </View>

        <View>
          <Label>{$t('meydan.hangi_turler')}</Label>
          <View style={styles.sarmal}>
            {ACTIVITY_TYPES.map((t) => (
              <Chip key={t} label={ACTIVITY_LABELS[t]} role="checkbox" tone="sea" selected={turler.includes(t)} onPress={() => turSec(t)} />
            ))}
          </View>
          <Txt variant="small" style={{ marginTop: 6 }}>
            {turler.length ? $t('meydan.yalnizca_secilenler') : $t('meydan.hepsi_sayilir')}
          </Txt>
        </View>

        <View>
          <Label>{$t('etkinlik_olustur.aciklama_istege_bagli')}</Label>
          <TextInput
            value={aciklama}
            onChangeText={setAciklama}
            placeholderTextColor={colors.inkMuted}
            maxLength={1000}
            multiline
            accessibilityLabel={$t('ortak.aciklama')}
            style={[styles.input, { height: 88, paddingTop: 12, textAlignVertical: 'top' }]}
          />
        </View>

        <Txt variant="small">{$t('meydan.olustur_notu')}</Txt>

        {hata ? (
          <View style={styles.hata} accessibilityRole="alert">
            <Icon name="shield" size={18} color={colors.terraInk} />
            <Txt style={{ flex: 1, color: colors.terraInk }}>{hata}</Txt>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.alt, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={kaydediyor ? $t('hedefler.kaydediliyor') : $t('meydan.baslat')} icon="flag" onPress={() => void baslat()} disabled={kaydediyor} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  ad: { fontFamily: fontFamily.display, fontSize: 24, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 6 },
  sarmal: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  girdiSatiri: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  girdi: { flex: 1, fontFamily: fontFamily.display, fontSize: 34, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 4 },
  input: { borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
  hata: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: colors.terraSoft },
  alt: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
