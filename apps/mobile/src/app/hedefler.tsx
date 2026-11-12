/**
 * Hedefler: haftalık / aylık / yıllık mesafe, süre, aktivite sayısı ya da tırmanış hedefi ve bu dönemdeki ilerleme.
 * Hedefler sunucuda (data/hedef.ts), ilerleme telefonda kişisel rekorlarla aynı veriden (packages/shared/src/hedef.ts).
 */
import { ACTIVITY_LABELS, hedefIlerlemesi, hedefSirala, plandaMi, type Hedef, type RekorAktivitesi } from '@lykiva/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { IlerlemeCubugu } from '@/components/IlerlemeCubugu';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { donemAdi, hedeflerim, hedefSil, olcuAdi, olcuMetni, olcuYazi } from '@/data/hedef';
import { rekorAktiviteleri } from '@/data/rekor';
import { oturumuSagla, supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export default function HedeflerScreen() {
  const insets = useSafeAreaInsets();
  const [hedefler, setHedefler] = useState<Hedef[] | null>(null);
  const [liste, setListe] = useState<RekorAktivitesi[]>([]);
  const [simdi, setSimdi] = useState(0);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const uid = await oturumuSagla();
      const [h, l] = await Promise.all([hedeflerim(), rekorAktiviteleri(uid).catch(() => [])]);
      setHedefler(hedefSirala(h));
      setListe(l);
      setSimdi(Date.now());
      setHata(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (supabaseHazir) void yukle();
    }, [yukle]),
  );

  function secenekler(h: Hedef) {
    Alert.alert(hedefBasligi(h), olcuYazi(h.olcu, h.hedef), [
      {
        text: $t('hedefler.duzenle'),
        onPress: () => router.push({ pathname: '/hedef-ekle', params: { id: h.id, donem: h.donem, olcu: h.olcu, activity: h.activity ?? '', hedef: String(h.hedef) } }),
      },
      {
        text: $t('ortak.sil'),
        style: 'destructive',
        onPress: () =>
          void hedefSil(h.id)
            .then(yukle)
            .catch((e: unknown) => Alert.alert($t('ortak.yuklenemedi'), e instanceof Error ? e.message : String(e))),
      },
      { text: $t('ortak.vazgec'), style: 'cancel' },
    ]);
  }

  const ekle = hedefler && hedefler.length < 12 ? <IconButton icon="plus" label={$t('hedefler.hedef_ekle')} onPress={() => router.push('/hedef-ekle')} /> : null;

  return (
    <View style={styles.root}>
      <Header title={$t('hedefler.baslik')} right={ekle} />
      {!supabaseHazir ? (
        <View style={styles.center}>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            {$t('basari.sunucu_yok')}
          </Txt>
        </View>
      ) : !hedefler ? (
        <View style={styles.center}>{hata ? <Txt variant="muted" style={{ textAlign: 'center' }}>{hata}</Txt> : <ActivityIndicator color={colors.terra} />}</View>
      ) : hedefler.length === 0 ? (
        <View style={styles.center}>
          <Icon name="target" size={44} color={colors.inkMuted} />
          <Txt variant="heading" style={{ marginTop: space.md, textAlign: 'center' }}>
            {$t('hedefler.bos_baslik')}
          </Txt>
          <Txt variant="muted" style={{ textAlign: 'center', marginTop: 6, marginBottom: space.lg }}>
            {$t('hedefler.bos_metin')}
          </Txt>
          <Button label={$t('hedefler.hedef_koy')} icon="target" href="/hedef-ekle" style={{ alignSelf: 'stretch' }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: insets.bottom + 40 }}>
          {hedefler.map((h) => (
            <HedefKarti key={h.id} hedef={h} liste={liste} simdi={simdi} onPress={() => secenekler(h)} />
          ))}
          <Txt variant="small" style={{ paddingHorizontal: space.sm, marginTop: space.sm }}>
            {$t('hedefler.not')}
          </Txt>
        </ScrollView>
      )}
    </View>
  );
}

function hedefBasligi(h: Hedef): string {
  return h.activity ? `${donemAdi(h.donem)} · ${ACTIVITY_LABELS[h.activity]}` : donemAdi(h.donem);
}

function HedefKarti({ hedef, liste, simdi, onPress }: { hedef: Hedef; liste: RekorAktivitesi[]; simdi: number; onPress: () => void }) {
  const i = hedefIlerlemesi(liste, hedef, simdi);
  const d = olcuMetni(hedef.olcu, i.deger);
  const h = olcuMetni(hedef.olcu, hedef.hedef);
  const plan = plandaMi(i);
  const durum = i.tamam
    ? $t('hedefler.tamamlandi')
    : $t('hedefler.kalan', { kalan: olcuYazi(hedef.olcu, i.kalan), gun: $t('hedefler.gun', { n: i.kalanGun }) });
  const planMetni = plan === 'onde' ? $t('hedefler.plan_onde') : plan === 'geride' ? $t('hedefler.plan_geride') : $t('hedefler.plan_planda');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${hedefBasligi(hedef)}, ${olcuAdi(hedef.olcu)}: ${d.value} / ${h.value} ${h.unit}. ${durum}. ${i.tamam ? '' : planMetni}`}
      accessibilityHint={$t('hedefler.duzenle_ya_da_sil')}
      onPress={onPress}
      style={({ pressed }) => [styles.kart, i.tamam && { borderColor: colors.sea }, pressed && { opacity: 0.85 }]}>
      <View style={styles.ust}>
        <Txt variant="label" style={{ flex: 1 }} numberOfLines={1}>
          {hedefBasligi(hedef)} · {olcuAdi(hedef.olcu)}
        </Txt>
        {i.tamam ? (
          <View style={[styles.etiket, { backgroundColor: colors.seaSoft }]}>
            <Icon name="star" size={13} color={colors.seaInk} strokeWidth={2.2} />
            <Txt style={[styles.etiketYazi, { color: colors.seaInk }]}>{$t('hedefler.tamam')}</Txt>
          </View>
        ) : (
          <View style={[styles.etiket, { backgroundColor: plan === 'geride' ? colors.terraSoft : plan === 'onde' ? colors.seaSoft : colors.sand }]}>
            <Txt style={[styles.etiketYazi, { color: plan === 'geride' ? colors.terraInk : plan === 'onde' ? colors.seaInk : colors.sandInk }]}>{planMetni}</Txt>
          </View>
        )}
      </View>
      <Txt style={{ fontFamily: fontFamily.display, fontSize: 26, color: colors.ink, marginTop: 4 }}>
        {d.value}
        <Txt style={{ fontFamily: fontFamily.bodyMedium, fontSize: 15, color: colors.inkMuted }}>
          {' '}
          / {h.value} {h.unit}
        </Txt>
      </Txt>
      <View style={{ marginTop: 10, marginBottom: 8 }}>
        <IlerlemeCubugu oran={i.oran} isaret={i.tamam ? undefined : i.gecen} renk={i.tamam ? colors.sea : colors.terra} />
      </View>
      <Txt variant="small">{durum}</Txt>
    </Pressable>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  kart: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  etiket: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  etiketYazi: { fontFamily: fontFamily.bodyBold, fontSize: 11 },
}));
