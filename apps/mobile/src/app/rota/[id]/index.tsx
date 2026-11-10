import { ACTIVITY_LABELS, DIFFICULTY_LABELS, estimateDuration, formatKm, formatMeters } from '@lykiva/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ElevationProfile } from '@/components/charts';
import { FloatingHeader } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { AvatarStack, Button, Stat } from '@/components/ui';
import { faralyaKabak, people, type LngLat } from '@/data/ornek';
import { useRota } from '@/data/rota';
import { useHesap } from '@/lib/giris';
import { supabaseHazir } from '@/lib/supabase';
import { SikayetBaglantisi, useSikayet } from '@/components/SikayetPenceresi';
import { colors, fontFamily, space } from '@/theme';

function sureMetni(s: number) {
  const dk = Math.round(s / 60);
  const sa = Math.floor(dk / 60);
  return sa > 0 ? `${sa} sa ${dk % 60}` : `${dk} dk`;
}

/** Rakımları ~60 noktaya indirger (grafik için) */
function profil(alts: number[]): number[] {
  if (alts.length <= 60) return alts;
  return Array.from({ length: 60 }, (_, i) => alts[Math.round((i / 59) * (alts.length - 1))]);
}

export default function RotaDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { r, hata } = useRota(id);
  const hesap = useHesap();
  const sikayet = useSikayet();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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
  const alts = r.points.map((p) => p.alt).filter((a): a is number => a != null);
  const friends = faralyaKabak.friendsDone.map((f) => people[f]);
  const etiketler: [string, string, string][] = [
    ...(r.difficulty ? ([[`${DIFFICULTY_LABELS[r.difficulty]}${ornek ? ' zorluk' : ''}`, colors.terraSoft, colors.terraInk]] as [string, string, string][]) : []),
    [ACTIVITY_LABELS[r.activity], colors.seaSoft, colors.seaInk],
    [r.isLoop ? 'Döngü' : 'Tek yön', colors.sand, colors.sandInk],
  ];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <TopoMap
          style={{ height: 270 + insets.top }}
          route={route}
          markers={
            route.length > 1
              ? [
                  { id: 's', coord: route[0], kind: 'start' },
                  { id: 'e', coord: route[route.length - 1], kind: 'end' },
                ]
              : []
          }
          padding={{ top: insets.top + 70, bottom: 30 }}
          accessibilityLabel={`${r.name} rotasının haritası`}
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
            {ornek ? faralyaKabak.by : `${r.ownerName} · ${r.visibility === 'public' ? 'herkese açık' : r.visibility === 'followers' ? 'takipçilere açık' : 'sadece sen'}`}
          </Txt>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 }}>
            <Stat label="Mesafe" value={`${formatKm(r.distanceM)} km`} />
            <Stat label="Tırmanış" value={alts.length ? `↑ ${formatMeters(r.gainM)} m` : '–'} />
            <Stat label={ornek ? 'Ortalama süre' : 'Tahmini süre'} value={ornek ? faralyaKabak.avgTime : sureMetni(estimateDuration(r.activity, r.distanceM, r.gainM))} />
          </View>
          {alts.length > 1 ? (
            <ElevationProfile values={profil(alts)} width={width - space.lg * 2} height={56} color={colors.ink} label={`Yükseklik profili, en yüksek ${formatMeters(Math.max(...alts))} metre`} />
          ) : (
            <Txt variant="small">Bu rota serbest çizildiği için rakım bilgisi yok.</Txt>
          )}

          {ornek ? (
            <View style={styles.done}>
              <AvatarStack items={friends} size={30} bg={colors.ground} />
              <Txt style={{ fontSize: 13, flex: 1 }}>
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{friends.map((f) => f.short).join(' ve ')}</Txt>{' '}
                <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>dahil {faralyaKabak.doneBy.toLocaleString('tr-TR')} kişi bu rotayı yaptı</Txt>
              </Txt>
            </View>
          ) : null}

          {r.notes ? (
            <>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14, marginTop: 12, marginBottom: 6 }}>{ornek ? 'Topluluk notları' : 'Notlar'}</Txt>
              <Txt style={{ fontSize: 13, lineHeight: 20, color: '#2E3631' }}>{r.notes}</Txt>
            </>
          ) : null}
          {!ornek && supabaseHazir && r.ownerId && hesap && r.ownerId !== hesap.id ? (
            <SikayetBaglantisi etiket="Bu rotayı şikayet et" onPress={() => sikayet.ac('route', r.id, `${r.name} · ${r.ownerName}`)} />
          ) : null}
        </View>
      </ScrollView>
      {sikayet.pencere}

      <FloatingHeader
        right={
          ornek ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton floating icon="share" label="Rotayı paylaş" onPress={() => router.push('/rota/ornek/paylas')} />
            </View>
          ) : undefined
        }
      />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Bu rotayı başlat" icon="play" onPress={() => router.push({ pathname: '/kayit', params: { rota: r.id } })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  tag: { height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineStrong },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
