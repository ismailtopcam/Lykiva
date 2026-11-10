import { ACTIVITY_LABELS } from '@lykiva/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { birlikteKisileri, sunucuAktivitesiMi } from '@/akis/akis';
import { ElevationProfile } from '@/components/charts';
import { HavaKarti } from '@/components/HavaKarti';
import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { SikayetBaglantisi, useSikayet } from '@/components/SikayetPenceresi';
import { SosyalSatiri } from '@/components/SosyalSatiri';
import { Txt } from '@/components/Txt';
import { AvatarStack, Button } from '@/components/ui';
import { adListesi, birlikteKisiler, useAktivite } from '@/data/aktivite';
import type { Activity, BirlikteKisi } from '@/data/ornek';
import { aktivitedenRota } from '@/data/rota';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';

export default function AktiviteOzetiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { a, yukleniyor, hata, bekliyor } = useAktivite(id);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rotaDurumu, setRotaDurumu] = useState<'bos' | 'kaydediyor' | string>('bos');
  const sikayet = useSikayet();

  if (!a) {
    return (
      <View style={[styles.root, styles.center]}>
        <FloatingHeader />
        {yukleniyor ? <ActivityIndicator color={colors.terra} /> : <Txt variant="muted">{hata ?? 'Aktivite bulunamadı'}</Txt>}
      </View>
    );
  }

  const stopCoord = (at: number) => a.route[Math.round(at * (a.route.length - 1))];
  const hasRoute = a.route.length > 1;

  const cells: [string, string, boolean?][] = [
    ['Mesafe', `${a.distanceKm} km`],
    ['Hareket', a.durationMoving],
    ['Toplam süre', a.durationTotal],
    ['Maks. hız', a.maxSpeed, true],
    ['Ort. hız', a.avgSpeed],
    ['Min. hız*', a.minSpeed],
  ];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <TopoMap
          style={{ height: 300 + insets.top }}
          route={a.route}
          markers={
            hasRoute
              ? [
                  { id: 's', coord: a.route[0], kind: 'start' as const },
                  { id: 'e', coord: a.route[a.route.length - 1], kind: 'end' as const },
                  ...a.stops.map((s) => ({ id: 'm' + s.n, coord: s.coord ?? stopCoord(s.at), kind: 'stop' as const, text: String(s.n) })),
                ]
              : []
          }
          padding={{ top: insets.top + 70, bottom: 30 }}
          accessibilityLabel={`Rota haritası${a.stops.length ? `, ${a.stops.length} mola noktası işaretli` : ''}`}
        />
        <View style={{ padding: space.lg, paddingBottom: 0 }}>
          {!a.mine && a.ownerId && a.ownerName ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${a.ownerName} profili`}
              onPress={() => router.push({ pathname: '/kisi/[id]', params: { id: a.ownerId! } })}
              hitSlop={8}
              style={{ alignSelf: 'flex-start', marginBottom: 2 }}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.terra }}>{a.ownerName}</Txt>
            </Pressable>
          ) : null}
          <Txt variant="small">
            {a.when} · {ACTIVITY_LABELS[a.type]}
          </Txt>
          {bekliyor ? (
            <Txt variant="small" style={{ color: colors.terra, marginTop: 2 }}>
              Telefonda bekliyor · internet gelince gönderilecek
            </Txt>
          ) : null}
          <Txt variant="display" style={{ fontSize: 25, marginVertical: 2 }} accessibilityRole="header">
            {a.title}
          </Txt>
          <BirlikteSatiri a={a} />
        </View>

        <SosyalSatiri id={a.id} />
        {a.hava ? <HavaKarti hava={a.hava} iz={a.route} /> : null}

        <View style={styles.grid}>
          {cells.map(([l, v, hi]) => (
            <View key={l} style={styles.cell}>
              <Txt style={{ fontSize: 11, color: colors.inkMuted }}>{l}</Txt>
              <Txt style={{ fontFamily: fontFamily.display, fontSize: 21, color: hi ? colors.terra : colors.ink }}>{v}</Txt>
            </View>
          ))}
        </View>
        <Txt variant="small" style={{ paddingHorizontal: space.lg, marginTop: 6 }}>
          km/sa · *Min. hız yalnızca hareket hâlindeyken ölçülür
        </Txt>

        {a.hasElevation === false ? (
          <Txt variant="small" style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
            Bu kayıtta cihaz rakım bilgisi vermedi; yükseklik profili yok.
          </Txt>
        ) : (
        <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>Yükseklik</Txt>
            <Txt variant="small">
              ↑ {a.climbM} m · ↓ {a.descentM} m · en yüksek {a.maxElevationM} m
            </Txt>
          </View>
          <ElevationProfile
            values={a.elevation}
            width={width - space.lg * 2}
            markers={a.stops.map((s) => ({ at: s.at, n: s.n }))}
            label={`Yükseklik profili, en yüksek nokta ${a.maxElevationM} metre`}
          />
        </View>
        )}

        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/aktivite/[id]/uc-boyut', params: { id: a.id } })} style={styles.link3d}>
          <Icon name="mountain" color={colors.seaInk} />
          <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.seaInk }}>İnişli çıkışlı haritada gör (3B)</Txt>
          <Icon name="chevron" size={18} color={colors.seaInk} strokeWidth={2} />
        </Pressable>
        {a.mine ? (
          <Pressable
            accessibilityRole="button"
            disabled={rotaDurumu === 'kaydediyor'}
            onPress={async () => {
              setRotaDurumu('kaydediyor');
              try {
                const rid = await aktivitedenRota(a.id, a.title);
                setRotaDurumu('bos');
                router.push({ pathname: '/rota/[id]', params: { id: rid } });
              } catch (e) {
                setRotaDurumu(e instanceof Error ? e.message : 'Kaydedilemedi');
              }
            }}
            style={[styles.link3d, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginTop: space.sm }]}>
            <Icon name="route" color={colors.terra} />
            <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>
              {rotaDurumu === 'kaydediyor' ? 'Rota kaydediliyor…' : 'Bu aktiviteyi rota olarak kaydet'}
            </Txt>
            <Icon name="chevron" size={18} color={colors.inkMuted} strokeWidth={2} />
          </Pressable>
        ) : null}
        {!a.mine && supabaseHazir && sunucuAktivitesiMi(a.id) ? (
          <SikayetBaglantisi etiket="Bu aktiviteyi şikayet et" onPress={() => sikayet.ac('activity', a.id, `${a.title}${a.ownerName ? ` · ${a.ownerName}` : ''}`)} />
        ) : null}
        {rotaDurumu !== 'bos' && rotaDurumu !== 'kaydediyor' ? (
          <Txt accessibilityRole="alert" style={{ color: colors.terra, fontSize: 13, paddingHorizontal: space.lg, marginTop: 6 }}>
            {rotaDurumu}
          </Txt>
        ) : null}
      </ScrollView>

      <FloatingHeader
        right={
          a.mine && supabaseHazir && sunucuAktivitesiMi(a.id) ? (
            <IconButton floating icon="more" label="Aktiviteyi düzenle" onPress={() => router.push({ pathname: '/aktivite/[id]/duzenle', params: { id: a.id } })} />
          ) : undefined
        }
      />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Hız & molalar" icon="gauge" variant="outline" href={{ pathname: '/aktivite/[id]/hiz', params: { id: a.id } }} style={{ flex: 1 }} />
        <Button label="Paylaş" icon="share" href={{ pathname: '/aktivite/[id]/paylas', params: { id: a.id } }} style={{ flex: 1 }} />
      </View>
      {sikayet.pencere}
    </View>
  );
}

/** "Cem ve Burak ile birlikte" (dokununca kişi listesi / ekleme); kendi aktivitende kimse yoksa "Birlikte yaptığın kişileri ekle" */
function BirlikteSatiri({ a }: { a: Activity }) {
  const sunucu = supabaseHazir && sunucuAktivitesiMi(a.id);
  // Kişi ekleme ekranından dönünce liste tazelensin
  const [taze, setTaze] = useState<BirlikteKisi[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!sunucu) return;
      let acik = true;
      birlikteKisileri(a.id)
        .then((l) => acik && setTaze(l.map((k) => ({ id: k.user_id, ad: k.display_name, kisa: k.display_name.split(' ')[0], kullanici: k.username, me: k.me }))))
        .catch(() => undefined);
      return () => {
        acik = false;
      };
    }, [a.id, sunucu]),
  );
  const kisiler = taze ?? birlikteKisiler(a);
  if (!kisiler.length && !(a.mine && sunucu)) return null;
  const metin = kisiler.length ? `${adListesi(kisiler.map((k) => (k.me ? 'sen' : k.kisa)))} ile birlikte` : 'Birlikte yaptığın kişileri ekle';
  return (
    <Pressable
      accessibilityRole={sunucu ? 'link' : undefined}
      accessibilityLabel={sunucu ? `${metin}, kişileri aç` : metin}
      disabled={!sunucu}
      onPress={() => router.push({ pathname: '/aktivite/[id]/birlikte', params: { id: a.id } })}
      style={styles.birlikte}>
      {kisiler.length ? (
        <AvatarStack items={kisiler.slice(0, 4).map((k) => ({ initials: basHarfler(k.ad), tone: grupRengi(k.id ?? k.kullanici) }))} size={26} bg={colors.ground} />
      ) : (
        <Icon name="users" size={20} color={colors.terra} />
      )}
      <Txt style={{ flex: 1, fontSize: 14, fontFamily: kisiler.length ? fontFamily.body : fontFamily.bodySemiBold, color: kisiler.length ? colors.inkMuted : colors.terra }} numberOfLines={2}>
        {metin}
      </Txt>
      {sunucu ? <Icon name="chevron" size={18} color={colors.inkMuted} strokeWidth={2} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  birlikte: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, marginTop: 4 },
  root: { flex: 1, backgroundColor: colors.ground },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: space.lg, marginTop: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.lineStrong, gap: 1 },
  cell: { width: '33.1%', flexGrow: 1, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10 },
  link3d: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: space.lg, marginTop: space.lg, padding: 14, borderRadius: 16, backgroundColor: colors.seaSoft },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
