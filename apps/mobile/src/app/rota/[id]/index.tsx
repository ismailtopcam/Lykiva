import { ACTIVITY_LABELS, formatDuration, formatKm, kumulatifMesafe, toblerSuresi } from '@lykiva/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ElevationProfile } from '@/components/charts';
import { FloatingHeader } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { AvatarStack, Button, Stat } from '@/components/ui';
import { faralyaKabak, people, type LngLat } from '@/data/ornek';
import { useHesap } from '@/lib/giris';
import { rotaIdsiMi, rotaSil, useRota, type RotaDetayi } from '@/rota/rotalar';
import { kayitRotasiOlustur, rotaSec } from '@/rota/secim';
import { colors, fontFamily, space } from '@/theme';

export default function RotaDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return rotaIdsiMi(id) ? <GercekRota id={id} /> : <OrnekRota />;
}

const zeminRenk = { asfalt: colors.ink, toprak: colors.ochre, patika: colors.sea } as const;
const zeminAd = { asfalt: 'Asfalt', toprak: 'Toprak yol', patika: 'Patika' } as const;
const ayakla = (a: string) => a === 'walk' || a === 'hike' || a === 'run' || a === 'trail_run';

/** Yükseklik profili için mesafe ekseninde eşit aralıklı n değer (yükseklik yoksa boş) */
function yukseklikDegerleri(r: RotaDetayi, n = 60): number[] {
  const k = r.koordinatlar.filter((c) => c[2] != null);
  if (k.length < 2 || k.length < r.koordinatlar.length * 0.8) return [];
  const cum = kumulatifMesafe(k.map((c) => ({ lng: c[0], lat: c[1] })));
  const toplam = cum[cum.length - 1] || 1;
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const hedef = (i / (n - 1)) * toplam;
    while (j < cum.length - 1 && cum[j + 1] < hedef) j++;
    out.push(k[j][2] as number);
  }
  return out;
}

function GercekRota({ id }: { id: string }) {
  const { rota, yukleniyor, hata } = useRota(id);
  const hesap = useHesap();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [siliniyor, setSiliniyor] = useState(false);

  if (!rota) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: space.lg }]}>
        <FloatingHeader />
        {yukleniyor ? <ActivityIndicator color={colors.terra} /> : <Txt variant="muted">{hata ?? 'Rota bulunamadı'}</Txt>}
      </View>
    );
  }

  const r = rota;
  const yol = r.koordinatlar.map((c) => [c[0], c[1]] as LngLat);
  const benim = hesap?.id === r.ownerId;
  const yukseklik = yukseklikDegerleri(r);
  const sure = ayakla(r.activity) ? toblerSuresi(r.koordinatlar.map((c) => ({ lng: c[0], lat: c[1], ele: c[2] }))) : null;
  const etiketler: [string, string, string][] = [
    [ACTIVITY_LABELS[r.activity], colors.seaSoft, colors.seaInk],
    [r.dongu ? 'Döngü' : 'Tek yön', colors.sand, colors.sandInk],
    [r.gorunurluk === 'public' ? 'Herkese açık' : r.gorunurluk === 'private' ? 'Yalnızca sen' : 'Paylaşılan', colors.terraSoft, colors.terraInk],
  ];

  function baslat() {
    rotaSec(kayitRotasiOlustur(r));
    router.push('/kayit');
  }

  function sil() {
    Alert.alert('Rota silinsin mi?', `"${r.ad}" kalıcı olarak silinecek. Bu rotayla yapılan aktiviteler silinmez.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setSiliniyor(true);
          try {
            await rotaSil(r.id);
            router.back();
          } catch (e) {
            Alert.alert('Silinemedi', e instanceof Error ? e.message : String(e));
          } finally {
            setSiliniyor(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <TopoMap
          style={{ height: 270 + insets.top }}
          route={yol}
          markers={[
            { id: 's', coord: yol[0], kind: 'start' },
            { id: 'e', coord: yol[yol.length - 1], kind: 'end' },
          ]}
          padding={{ top: insets.top + 70, bottom: 30 }}
          accessibilityLabel={`${r.ad} rotasının haritası`}
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
            {r.ad}
          </Txt>
          <Txt variant="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {benim ? 'Senin rotan' : r.sahipAdi}
          </Txt>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 }}>
            <Stat label="Mesafe" value={`${formatKm(r.mesafeM)} km`} />
            <Stat label="Tırmanış" value={r.tirmanisM != null ? `↑ ${Math.round(r.tirmanisM)} m` : '–'} />
            <Stat label={sure != null ? 'Tahmini (yürüyüş)' : 'İniş'} value={sure != null ? formatDuration(sure) : r.inisM != null ? `↓ ${Math.round(r.inisM)} m` : '–'} />
          </View>
          {yukseklik.length ? (
            <ElevationProfile values={yukseklik} width={width - space.lg * 2} height={56} color={colors.ink} label="Yükseklik profili" />
          ) : null}

          {r.zemin ? (
            <View style={{ marginTop: 14 }}>
              <View style={styles.bar}>
                {(Object.keys(zeminAd) as (keyof typeof zeminAd)[]).map((k) =>
                  r.zemin![k] > 0 ? <View key={k} style={{ flex: r.zemin![k], backgroundColor: zeminRenk[k] }} /> : null,
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                {(Object.keys(zeminAd) as (keyof typeof zeminAd)[]).map((k) => (
                  <Txt key={k} variant="small">
                    {zeminAd[k]} %{Math.round(r.zemin![k] * 100)}
                  </Txt>
                ))}
              </View>
            </View>
          ) : null}

          {r.yapilmaSayisi > 0 ? (
            <Txt style={{ fontSize: 13, marginTop: 14 }}>
              Bu rotayla <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{r.yapilmaSayisi}</Txt> aktivite kaydedildi.
            </Txt>
          ) : null}
          {r.notlar ? <Txt style={{ fontSize: 13, lineHeight: 20, marginTop: 12, color: '#2E3631' }}>{r.notlar}</Txt> : null}
        </View>
      </ScrollView>

      <FloatingHeader right={benim ? <IconButton floating icon="more" label="Rotayı sil" onPress={sil} /> : undefined} />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={siliniyor ? 'Siliniyor…' : 'Bu rotayı başlat'} icon="play" onPress={baslat} disabled={siliniyor} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function OrnekRota() {
  const r = faralyaKabak;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const friends = r.friendsDone.map((id) => people[id]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <TopoMap
          style={{ height: 270 + insets.top }}
          route={r.route}
          markers={[
            { id: 's', coord: r.route[0], kind: 'start' },
            { id: 'e', coord: r.route[r.route.length - 1], kind: 'end' },
          ]}
          padding={{ top: insets.top + 70, bottom: 30 }}
          accessibilityLabel={`${r.title} rotasının haritası`}
        />
        <View style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {[
              [r.difficulty, colors.terraSoft, colors.terraInk],
              [r.type, colors.seaSoft, colors.seaInk],
              [r.direction, colors.sand, colors.sandInk],
            ].map(([t, bg, fg]) => (
              <View key={t} style={[styles.tag, { backgroundColor: bg }]}>
                <Txt style={{ fontSize: 12, fontFamily: fontFamily.bodyBold, color: fg }}>{t}</Txt>
              </View>
            ))}
          </View>
          <Txt variant="display" style={{ fontSize: 27 }} accessibilityRole="header">
            {r.title}
          </Txt>
          <Txt variant="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {r.by}
          </Txt>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 }}>
            <Stat label="Mesafe" value={`${r.distanceKm} km`} />
            <Stat label="Tırmanış" value={`↑ ${r.climbM} m`} />
            <Stat label="Ortalama süre" value={r.avgTime} />
          </View>
          <ElevationProfile values={r.elevation} width={width - space.lg * 2} height={56} color={colors.ink} label="Yükseklik profili" />

          <View style={styles.done}>
            <AvatarStack items={friends} size={30} bg={colors.ground} />
            <Txt style={{ fontSize: 13, flex: 1 }}>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{friends.map((f) => f.short).join(' ve ')}</Txt>{' '}
              <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>dahil {r.doneBy.toLocaleString('tr-TR')} kişi bu rotayı yaptı</Txt>
            </Txt>
          </View>

          <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14, marginTop: 12, marginBottom: 6 }}>Topluluk notları</Txt>
          <Txt style={{ fontSize: 13, lineHeight: 20, color: '#2E3631' }}>{r.notes}</Txt>
        </View>
      </ScrollView>

      <FloatingHeader
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton floating icon="download" label="Çevrimdışı kullanım için indir" />
            <IconButton floating icon="bookmark" label="Rotayı kaydet" />
            <IconButton floating icon="share" label="Rotayı paylaş" onPress={() => router.push('/rota/ornek/paylas')} />
          </View>
        }
      />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Grupla planla" icon="users" variant="outline" href="/etkinlik/olustur" style={{ flex: 1 }} />
        <Button label="Bu rotayı başlat" icon="play" href="/kayit" style={{ flex: 1.2 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  tag: { height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineStrong },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
