/**
 * Kişisel rekorlar: en uzun mesafe, en uzun süre, en yüksek hız, en çok tırmanış (türe göre) ve toplamlar.
 * Hesap: packages/shared/src/rekor.ts. Veri: data/rekor.ts (sunucudaki kendi aktivitelerim + telefonda bekleyenler).
 */
import {
  ACTIVITY_LABELS,
  formatDuration,
  formatKm,
  formatMeters,
  formatSpeedKmh,
  kisiselRekorlar,
  kmUnit,
  mUnit,
  REKOR_TURLERI,
  speedUnit,
  toplamlar,
  yapilanTurler,
  type ActivityType,
  type Rekor,
  type RekorAktivitesi,
  type RekorTuru,
} from '@lykiva/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Card, Chip } from '@/components/ui';
import { rekorAdi, rekorAktiviteleri } from '@/data/rekor';
import { oturumuSagla, supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';
import { $t, yerel } from '@/i18n';

const IKON: Record<RekorTuru, IconName> = { mesafe: 'route', sure: 'clock', hiz: 'gauge', tirmanis: 'mountain' };

function degerMetni(r: Rekor): { value: string; unit?: string } {
  switch (r.tur) {
    case 'mesafe':
      return { value: formatKm(r.deger), unit: kmUnit() };
    case 'sure':
      return { value: formatDuration(r.deger) };
    case 'hiz':
      return { value: formatSpeedKmh(r.deger), unit: speedUnit() };
    case 'tirmanis':
      return { value: formatMeters(r.deger), unit: mUnit() };
  }
}

export default function RekorlarScreen() {
  const insets = useSafeAreaInsets();
  const [liste, setListe] = useState<RekorAktivitesi[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [tur, setTur] = useState<ActivityType | null>(null);

  useFocusEffect(
    useCallback(() => {
      let acik = true;
      (async () => {
        try {
          const uid = supabaseHazir ? await oturumuSagla().catch(() => null) : null;
          const l = await rekorAktiviteleri(uid);
          if (acik) {
            setListe(l);
            setHata(null);
          }
        } catch (e) {
          if (acik) setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi'));
        }
      })();
      return () => {
        acik = false;
      };
    }, []),
  );

  const turler = liste ? yapilanTurler(liste) : [];
  // Seçili tür artık listede yoksa (aktivite silindi) hepsine dön
  const secili = tur && turler.includes(tur) ? tur : null;
  const rekorlar = liste ? kisiselRekorlar(liste, secili ?? undefined) : {};
  const yilBasi = new Date(new Date().getFullYear(), 0, 1).getTime();
  const buYil = liste ? toplamlar(liste, secili ?? undefined, yilBasi) : null;
  const tumu = liste ? toplamlar(liste, secili ?? undefined) : null;

  return (
    <View style={styles.root}>
      <Header title={$t('rekorlar.baslik')} />
      {!liste ? (
        <View style={styles.center}>
          {hata ? <Txt variant="muted">{hata}</Txt> : <ActivityIndicator color={colors.terra} />}
        </View>
      ) : liste.length === 0 ? (
        <View style={styles.center}>
          <Icon name="trophy" size={40} color={colors.inkMuted} />
          <Txt variant="muted" style={{ textAlign: 'center', marginTop: space.md }}>
            {$t('rekorlar.henuz_yok')}
          </Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {turler.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
              <Chip label={$t('rekorlar.hepsi')} role="tab" selected={!secili} onPress={() => setTur(null)} />
              {turler.map((t) => (
                <Chip key={t} label={ACTIVITY_LABELS[t]} role="tab" selected={secili === t} onPress={() => setTur(t)} />
              ))}
            </ScrollView>
          ) : null}

          {buYil && tumu ? (
            <Card dark style={styles.toplam}>
              <Txt variant="label" color="#B9C2BA">
                {$t('rekorlar.bu_yil', { yil: new Date().getFullYear() })}
              </Txt>
              <View style={styles.toplamSatir}>
                <Buyuk value={formatKm(buYil.mesafeM)} unit={kmUnit()} />
                <Buyuk value={String(Math.floor(buYil.sureS / 3600))} unit={$t('ortak.birim_sa')} />
                <Buyuk value={String(buYil.sayi)} unit={$t('rekorlar.aktivite', { n: buYil.sayi })} />
              </View>
              <Txt variant="small" color="#B9C2BA">
                {$t('rekorlar.tum_zamanlar', {
                  km: `${formatKm(tumu.mesafeM)} ${kmUnit()}`,
                  sayi: $t('rekorlar.aktivite_sayisi', { n: tumu.sayi }),
                  tirmanis: `${formatMeters(tumu.tirmanisM)} ${mUnit()}`,
                })}
              </Txt>
            </Card>
          ) : null}

          <View style={{ paddingHorizontal: space.md, gap: space.sm }}>
            {REKOR_TURLERI.map((r) => (
              <RekorKarti key={r} tur={r} rekor={rekorlar[r]} turGoster={!secili && turler.length > 1} />
            ))}
          </View>
          <Txt variant="small" style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
            {$t('rekorlar.hiz_notu')}
          </Txt>
        </ScrollView>
      )}
    </View>
  );
}

function Buyuk({ value, unit }: { value: string; unit: string }) {
  return (
    <Txt style={{ fontFamily: fontFamily.displayHeavy, fontSize: 28, color: colors.night.text, letterSpacing: -0.6 }}>
      {value}
      <Txt style={{ fontFamily: fontFamily.bodyMedium, fontSize: 14, color: colors.night.text }}> {unit}</Txt>
    </Txt>
  );
}

function RekorKarti({ tur, rekor, turGoster }: { tur: RekorTuru; rekor?: Rekor; turGoster: boolean }) {
  const ad = rekorAdi(tur);
  if (!rekor) {
    return (
      <View style={styles.kart}>
        <View style={styles.ikon}>
          <Icon name={IKON[tur]} color={colors.inkMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="small">{ad}</Txt>
          <Txt variant="muted" style={{ fontSize: 14 }}>
            {$t('rekorlar.deger_yok')}
          </Txt>
        </View>
      </View>
    );
  }
  const d = degerMetni(rekor);
  const a = rekor.aktivite;
  const tarih = new Date(a.startedAt).toLocaleDateString(yerel(), { day: 'numeric', month: 'long', year: 'numeric' });
  const baslik = a.title || ACTIVITY_LABELS[a.activity];
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${ad}: ${d.value}${d.unit ? ' ' + d.unit : ''}, ${baslik}, ${tarih}`}
      onPress={() => router.push({ pathname: '/aktivite/[id]', params: { id: a.id } })}
      style={({ pressed }) => [styles.kart, pressed && { opacity: 0.8 }]}>
      <View style={[styles.ikon, { backgroundColor: colors.terraSoft }]}>
        <Icon name={IKON[tur]} color={colors.terraInk} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="small">{ad}</Txt>
        <Txt style={{ fontFamily: fontFamily.display, fontSize: 24, color: colors.ink }}>
          {d.value}
          {d.unit ? <Txt style={{ fontFamily: fontFamily.bodyMedium, fontSize: 14 }}> {d.unit}</Txt> : null}
        </Txt>
        <Txt variant="small" numberOfLines={1}>
          {baslik} · {tarih}
          {turGoster && a.title ? ` · ${ACTIVITY_LABELS[a.activity]}` : ''}
        </Txt>
      </View>
      <Icon name="chevron" size={18} color={colors.inkMuted} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  chips: { gap: 8, paddingHorizontal: space.md, paddingBottom: space.md },
  toplam: { marginHorizontal: space.md, padding: space.lg, marginBottom: space.md },
  toplamSatir: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4, marginVertical: 8 },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ikon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
});
