import { ACTIVITY_LABELS, DIFFICULTY_LABELS, estimateDuration, formatKm, formatMeters, type RoutePoint, kmUnit } from '@lykiva/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CevrimdisiKarti } from '@/components/CevrimdisiKarti';
import { EgimProfili, imlecKonumu, TirmanisListesi, useRotaEgim } from '@/components/EgimProfili';
import { FloatingHeader } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { TopoMap, type MapMarker } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { AvatarStack, Button, Stat } from '@/components/ui';
import { faralyaKabak, people, type LngLat } from '@/data/ornek';
import { useRota } from '@/data/rota';
import { useHesap } from '@/lib/giris';
import { supabaseHazir } from '@/lib/supabase';
import { SikayetBaglantisi, useSikayet } from '@/components/SikayetPenceresi';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t, yerel } from '@/i18n';

function sureMetni(s: number) {
  const dk = Math.round(s / 60);
  const sa = Math.floor(dk / 60);
  return sa > 0 ? $t('rota.sa', { sa, a: dk % 60 }) : $t('rota.dk', { dk });
}

const BOS: RoutePoint[] = [];

export default function RotaDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { r, hata } = useRota(id);
  const hesap = useHesap();
  const sikayet = useSikayet();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const noktalar = r?.points ?? BOS;
  const egim = useRotaEgim(noktalar);
  // Profilde seçilen nokta; rota değişince geçersiz olsun diye hangi rotaya ait olduğu da tutulur
  const [secim, setSecim] = useState<{ points: RoutePoint[]; v: number } | null>(null);
  const imlec = secim && secim.points === noktalar ? secim.v : null;
  const imlecYeri = imlecKonumu(noktalar, egim, imlec);
  const imlecSec = (v: number | null) => setSecim(v == null ? null : { points: noktalar, v });

  if (!r) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: space.lg }]}>
        <FloatingHeader />
        {hata ? <Txt variant="muted">{hata}</Txt> : <ActivityIndicator color={colors.terra} />}
      </View>
    );
  }

  const ornek = r.id === 'ornek';
  const route: LngLat[] = r.points.map((p) => [p.lng, p.lat]);
  const isaretler: MapMarker[] =
    route.length > 1
      ? [
          { id: 's', coord: route[0], kind: 'start' },
          { id: 'e', coord: route[route.length - 1], kind: 'end' },
        ]
      : [];
  if (imlecYeri) isaretler.push({ id: 'imlec', coord: imlecYeri, kind: 'cursor' });
  const friends = faralyaKabak.friendsDone.map((f) => people[f]);
  const etiketler: [string, string, string][] = [
    ...(r.difficulty ? ([[`${DIFFICULTY_LABELS[r.difficulty]}${ornek ? $t('rota.zorluk') : ''}`, colors.terraSoft, colors.terraInk]] as [string, string, string][]) : []),
    [ACTIVITY_LABELS[r.activity], colors.seaSoft, colors.seaInk],
    [r.isLoop ? $t('rota.dongu') : $t('rota.tek_yon'), colors.sand, colors.sandInk],
  ];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <TopoMap
          style={{ height: 270 + insets.top }}
          route={route}
          routeColors={egim?.renkler}
          markers={isaretler}
          katmanDugmesi={{ top: insets.top + 58 }}
          padding={{ top: insets.top + 70, bottom: 30 }}
          accessibilityLabel={$t('rota.rotasinin_haritasi', { name: r.name })}
        />
        <View style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {etiketler.map(([t, bg, fg]) => (
              <View key={t} style={[styles.tag, { backgroundColor: bg }]}>
                <Txt style={{ fontSize: 12, fontFamily: fontFamily.bodyBold, color: fg }}>{t}</Txt>
              </View>
            ))}
          </View>
          <Txt variant="display" style={{ fontSize: 27 }} accessibilityRole="header">
            {r.name}
          </Txt>
          <Txt variant="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {ornek ? faralyaKabak.by : `${r.ownerName} · ${r.visibility === 'public' ? $t('rota.herkese_acik') : r.visibility === 'followers' ? $t('rota.takipcilere_acik') : $t('rota.sadece_sen')}`}
          </Txt>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, columnGap: 10, marginVertical: 14 }}>
            <Stat label={$t('ortak.mesafe')} size={18} value={`${formatKm(r.distanceM)} ${kmUnit()}`} />
            <Stat label={$t('ortak.tirmanis')} size={18} value={egim ? $t('rota.m', { meters: formatMeters(r.gainM) }) : '–'} />
            <Stat label={$t('ortak.inis')} size={18} value={egim ? $t('rota.m_2', { meters: formatMeters(r.lossM) }) : '–'} />
            <Stat label={ornek ? $t('rota.ortalama_sure') : $t('rota.tahmini_sure')} size={18} value={ornek ? faralyaKabak.avgTime : sureMetni(estimateDuration(r.activity, r.distanceM, r.gainM))} />
          </View>
          {egim ? (
            <>
              <EgimProfili egim={egim} width={width - space.lg * 2} height={80} imlec={imlec} onImlec={imlecSec} />
              <TirmanisListesi egim={egim} onSec={imlecSec} />
            </>
          ) : (
            <Txt variant="small">{$t('rota.bu_rota_serbest_cizildigi')}</Txt>
          )}

          <CevrimdisiKarti rota={r} />

          {ornek ? (
            <View style={styles.done}>
              <AvatarStack items={friends} size={30} bg={colors.ground} />
              <Txt style={{ fontSize: 13, flex: 1 }}>
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{friends.map((f) => f.short).join(' ve ')}</Txt>{' '}
                <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>{$t('rota.dahil_kisi_bu_rotayi', { string: faralyaKabak.doneBy.toLocaleString(yerel()) })}</Txt>
              </Txt>
            </View>
          ) : null}

          {r.notes ? (
            <>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14, marginTop: 12, marginBottom: 6 }}>{ornek ? $t('rota.topluluk_notlari') : $t('rota.notlar')}</Txt>
              <Txt style={{ fontSize: 13, lineHeight: 20, color: colors.ink }}>{r.notes}</Txt>
            </>
          ) : null}
          {!ornek && supabaseHazir && r.ownerId && hesap && r.ownerId !== hesap.id ? (
            <SikayetBaglantisi etiket={$t('rota.bu_rotayi_sikayet_et')} onPress={() => sikayet.ac('route', r.id, `${r.name} · ${r.ownerName}`)} />
          ) : null}
        </View>
      </ScrollView>
      {sikayet.pencere}

      <FloatingHeader
        right={
          ornek ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton floating icon="share" label={$t('rota.rotayi_paylas')} onPress={() => router.push('/rota/ornek/paylas')} />
            </View>
          ) : !ornek && supabaseHazir && hesap && r.ownerId === hesap.id ? (
            <IconButton floating icon="more" label={$t('rota.rotayi_duzenle')} onPress={() => router.push({ pathname: '/rota/[id]/duzenle', params: { id: r.id } })} />
          ) : undefined
        }
      />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={$t('rota.bu_rotayi_baslat')} icon="play" onPress={() => router.push({ pathname: '/kayit', params: { rota: r.id } })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  tag: { height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineStrong },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
}));
