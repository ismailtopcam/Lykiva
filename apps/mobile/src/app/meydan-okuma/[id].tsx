/**
 * Meydan okuma: hedef, tarih aralığı, ilerlemem, katıl / ayrıl, sıralama (ilk 50 + benim yerim).
 * Sıralamada yalnızca toplam görünür; katılırken bu söylenir (gizli aktiviteler de sayılır).
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { IlerlemeCubugu } from '@/components/IlerlemeCubugu';
import { aralikMetni, hedefMetni, zamanMetni } from '@/components/MeydanOkumaKarti';
import { Txt } from '@/components/Txt';
import { Avatar, Button, Card, SectionHeader } from '@/components/ui';
import { olcuMetni, olcuYazi } from '@/data/hedef';
import {
  durumu,
  meydanOkumaDetayi,
  meydanOkumadanAyril,
  meydanOkumaSil,
  meydanOkumayaKatil,
  tamamlandiMi,
  type MeydanOkumaDetayi,
  type SiralamaSatiri,
} from '@/data/meydanOkuma';
import { basHarfler } from '@/grup/gruplar';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export default function MeydanOkumaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [m, setM] = useState<MeydanOkumaDetayi | null | undefined>(undefined);
  const [simdi, setSimdi] = useState(0);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(async () => {
    try {
      const d = await meydanOkumaDetayi(id);
      setM(d);
      setSimdi(Date.now());
      setHata(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi'));
      setM((x) => (x === undefined ? null : x));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  async function islem(f: () => Promise<unknown>) {
    setMesgul(true);
    try {
      await f();
      await yukle();
    } catch (e) {
      Alert.alert($t('grup.yapilamadi'), e instanceof Error ? e.message : String(e));
    } finally {
      setMesgul(false);
    }
  }

  if (!m) {
    return (
      <View style={[styles.root, styles.center]}>
        <Header />
        {m === undefined && !hata ? <ActivityIndicator color={colors.terra} /> : <Txt variant="muted">{hata ?? $t('meydan.bulunamadi')}</Txt>}
      </View>
    );
  }

  const mo = m;
  const d = durumu(mo, simdi);
  const tamam = tamamlandiMi(mo);
  const deger = mo.degerim ?? 0;
  const dm = olcuMetni(mo.olcu, deger);
  const hm = olcuMetni(mo.olcu, mo.hedef);
  const benimSirada = mo.siralama.some((s) => s.ben);

  function katil() {
    Alert.alert($t('meydan.katilinsin_mi'), $t('meydan.gizlilik_notu'), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      { text: $t('meydan.katil'), onPress: () => void islem(() => meydanOkumayaKatil(mo.id)) },
    ]);
  }
  function ayril() {
    Alert.alert($t('meydan.ayrilinsin_mi'), $t('meydan.ayrilinca'), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      { text: $t('meydan.ayril'), style: 'destructive', onPress: () => void islem(() => meydanOkumadanAyril(mo.id)) },
    ]);
  }
  function sil() {
    Alert.alert($t('meydan.silinsin_mi'), $t('meydan.silinince'), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      {
        text: $t('ortak.sil'),
        style: 'destructive',
        onPress: () =>
          void islem(async () => {
            await meydanOkumaSil(mo.id);
            router.back();
          }),
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <Header title={mo.grup_adi ?? $t('meydan.herkese_acik')} right={mo.yonetebilir ? <IconButton icon="more" label={$t('meydan.meydan_okumayi_sil')} onPress={sil} /> : null} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40, gap: space.sm }}>
        <Card dark style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={tamam ? 'medal' : 'flag'} color={colors.night.accent} />
            <Txt variant="label" color="#B9C2BA" style={{ flex: 1 }}>
              {aralikMetni(mo.baslangic, mo.bitis)} · {zamanMetni(mo, simdi)}
            </Txt>
          </View>
          <Txt style={styles.baslik} accessibilityRole="header">
            {mo.baslik}
          </Txt>
          <Txt style={{ color: colors.night.text, fontSize: 15, fontFamily: fontFamily.bodySemiBold }}>{hedefMetni(mo)}</Txt>
          {mo.aciklama ? <Txt style={{ color: '#D9DED8', fontSize: 14, lineHeight: 20, marginTop: 8 }}>{mo.aciklama}</Txt> : null}

          {mo.katildim ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              <Txt style={{ fontFamily: fontFamily.displayHeavy, fontSize: 30, color: colors.night.text }}>
                {dm.value}
                <Txt style={{ fontFamily: fontFamily.bodyMedium, fontSize: 15, color: '#B9C2BA' }}>
                  {' '}
                  / {hm.value} {hm.unit}
                </Txt>
              </Txt>
              <IlerlemeCubugu oran={mo.hedef > 0 ? deger / mo.hedef : 0} renk={tamam ? colors.night.sea : colors.night.accent} zemin="#2E3B35" />
              <Txt style={{ color: '#B9C2BA', fontSize: 13 }}>
                {tamam ? $t('meydan.tamamladin') : $t('meydan.kalan', { kalan: olcuYazi(mo.olcu, mo.hedef - deger) })}
                {mo.benim ? ` · ${$t('meydan.siran', { sira: mo.benim.sira, n: mo.katilimci_sayisi })}` : ''}
              </Txt>
            </View>
          ) : null}
        </Card>

        {d !== 'bitti' ? (
          mo.katildim ? (
            <Button label={$t('meydan.ayril')} variant="outline" icon="close" onPress={ayril} disabled={mesgul} />
          ) : (
            <Button label={mesgul ? '…' : $t('meydan.katil')} icon="flag" onPress={katil} disabled={mesgul} />
          )
        ) : null}
        {!mo.katildim && d !== 'bitti' ? (
          <Txt variant="small" style={{ paddingHorizontal: space.sm }}>
            {$t('meydan.gizlilik_notu')}
          </Txt>
        ) : null}

        <SectionHeader title={$t('meydan.siralama', { n: mo.katilimci_sayisi })} />
        {mo.siralama.length === 0 ? (
          <Txt variant="muted" style={{ paddingHorizontal: space.sm }}>
            {$t('meydan.siralama_bos')}
          </Txt>
        ) : (
          <View style={styles.tablo}>
            {mo.siralama.map((s) => (
              <SiraSatiri key={s.user_id} s={s} olcu={mo.olcu} hedef={mo.hedef} />
            ))}
            {mo.benim && !benimSirada ? (
              <>
                <Txt variant="small" style={{ textAlign: 'center', paddingVertical: 4 }}>
                  ⋯
                </Txt>
                <SiraSatiri s={mo.benim} olcu={mo.olcu} hedef={mo.hedef} />
              </>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SiraSatiri({ s, olcu, hedef }: { s: SiralamaSatiri; olcu: MeydanOkumaDetayi['olcu']; hedef: number }) {
  const v = olcuMetni(olcu, s.deger);
  const tamam = s.deger >= hedef;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${s.sira}. ${s.display_name}${s.ben ? ` (${$t('ortak.sen')})` : ''}: ${v.value} ${v.unit}${tamam ? `, ${$t('meydan.tamamladi')}` : ''}`}
      onPress={() => router.push({ pathname: '/kisi/[id]', params: { id: s.user_id } })}
      style={({ pressed }) => [styles.satir, s.ben && { backgroundColor: colors.terraSoft }, pressed && { opacity: 0.8 }]}>
      <Txt style={[styles.sira, s.sira <= 3 && { color: colors.terraInk }]}>{s.sira}</Txt>
      <Avatar initials={basHarfler(s.display_name)} tone={s.ben ? 'terra' : 'sea'} size={36} uri={s.avatar_url} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
          {s.display_name}
          {s.ben ? ` · ${$t('ortak.sen')}` : ''}
        </Txt>
        <Txt variant="small" numberOfLines={1}>
          @{s.username}
        </Txt>
      </View>
      {tamam ? <Icon name="medal" size={18} color={colors.sea} /> : null}
      <Txt style={{ fontFamily: fontFamily.display, fontSize: 17 }}>
        {v.value}
        <Txt style={{ fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.inkMuted }}> {v.unit}</Txt>
      </Txt>
    </Pressable>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  center: { alignItems: 'center', justifyContent: 'center' },
  baslik: { fontFamily: fontFamily.displayHeavy, fontSize: 26, lineHeight: 30, color: colors.night.text, marginTop: 8, marginBottom: 4 },
  tablo: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sira: { width: 28, textAlign: 'center', fontFamily: fontFamily.display, fontSize: 17, color: colors.inkMuted },
}));
