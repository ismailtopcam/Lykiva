import { ACTIVITY_LABELS, kmUnit } from '@lykiva/shared';
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
import { rekorAdi, useAktiviteRekorlari } from '@/data/rekor';
import { rozetAdi, useAktiviteRozetleri } from '@/data/rozet';
import type { Activity, BirlikteKisi } from '@/data/ornek';
import { aktivitedenRota } from '@/data/rota';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export default function AktiviteOzetiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { a, yukleniyor, hata, bekliyor } = useAktivite(id);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rotaDurumu, setRotaDurumu] = useState<'bos' | 'kaydediyor' | string>('bos');
  const sikayet = useSikayet();
  const rekorlar = useAktiviteRekorlari(a?.id, a?.mine ? (a.ownerId ?? null) : null, !!a && (!!a.mine || a.id.startsWith('yerel-')));
  const rozetler = useAktiviteRozetleri(a?.id, a?.mine ? (a.ownerId ?? null) : null, !!a && (!!a.mine || a.id.startsWith('yerel-')));

  if (!a) {
    return (
      <View style={[styles.root, styles.center]}>
        <FloatingHeader />
        {yukleniyor ? <ActivityIndicator color={colors.terra} /> : <Txt variant="muted">{hata ?? $t('aktivite.aktivite_bulunamadi')}</Txt>}
      </View>
    );
  }

  const stopCoord = (at: number) => a.route[Math.round(at * (a.route.length - 1))];
  const hasRoute = a.route.length > 1;

  const cells: [string, string, boolean?][] = [
    [$t('ortak.mesafe'), `${a.distanceKm} ${kmUnit()}`],
    [$t('aktivite.hareket'), a.durationMoving],
    [$t('aktivite.toplam_sure'), a.durationTotal],
    [$t('ortak.maks_hiz'), a.maxSpeed, true],
    [$t('ortak.ort_hiz'), a.avgSpeed],
    [$t('aktivite.min_hiz'), a.minSpeed],
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
          katmanDugmesi={{ top: insets.top + 58 }}
          padding={{ top: insets.top + 70, bottom: 30 }}
          accessibilityLabel={$t('aktivite.rota_haritasi', { a: a.stops.length ? $t('aktivite.mola_noktasi_isaretli', { length: a.stops.length }) : '' })}
        />
        <View style={{ padding: space.lg, paddingBottom: 0 }}>
          {!a.mine && a.ownerId && a.ownerName ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={$t('aktivite.profili', { ownerName: a.ownerName })}
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
              {$t('aktivite.telefonda_bekliyor_internet_gelince')}</Txt>
          ) : null}
          <Txt variant="display" style={{ fontSize: 25, marginVertical: 2 }} accessibilityRole="header">
            {a.title}
          </Txt>
          <BirlikteSatiri a={a} />
          {rekorlar.length ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/rekorlar')} style={styles.rekor} hitSlop={6}>
              <Icon name="trophy" size={18} color={colors.terraInk} strokeWidth={2} />
              <Txt style={{ flex: 1, fontSize: 13, color: colors.terraInk }}>
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13, color: colors.terraInk }}>{$t('rekorlar.kisisel_rekor')}</Txt>
                {' · '}
                {rekorlar.map(rekorAdi).join(' · ')}
              </Txt>
            </Pressable>
          ) : null}
          {rozetler.length ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/rozetler')} style={styles.rozet} hitSlop={6}>
              <Icon name="medal" size={18} color={colors.seaInk} strokeWidth={2} />
              <Txt style={{ flex: 1, fontSize: 13, color: colors.seaInk }}>
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13, color: colors.seaInk }}>{$t('rozet.yeni_rozet', { n: rozetler.length })}</Txt>
                {' · '}
                {rozetler.map((r) => rozetAdi(r.tanim)).join(' · ')}
              </Txt>
            </Pressable>
          ) : null}
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
          {$t('aktivite.km_sa_min_hiz')}</Txt>

        {a.hasElevation === false ? (
          <Txt variant="small" style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
            {$t('aktivite.bu_kayitta_cihaz_rakim')}</Txt>
        ) : (
        <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>{$t('aktivite.yukseklik')}</Txt>
            <Txt variant="small">
              {$t('aktivite.m_m_en_yuksek', { climbM: a.climbM, descentM: a.descentM, maxElevationM: a.maxElevationM })}</Txt>
          </View>
          <ElevationProfile
            values={a.elevation}
            width={width - space.lg * 2}
            markers={a.stops.map((s) => ({ at: s.at, n: s.n }))}
            label={$t('aktivite.yukseklik_profili_en_yuksek', { maxElevationM: a.maxElevationM })}
          />
        </View>
        )}

        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/aktivite/[id]/uc-boyut', params: { id: a.id } })} style={styles.link3d}>
          <Icon name="mountain" color={colors.seaInk} />
          <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.seaInk }}>{$t('aktivite.inisli_cikisli_haritada_gor')}</Txt>
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
                setRotaDurumu(e instanceof Error ? e.message : $t('ortak.kaydedilemedi'));
              }
            }}
            style={[styles.link3d, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginTop: space.sm }]}>
            <Icon name="route" color={colors.terra} />
            <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>
              {rotaDurumu === 'kaydediyor' ? $t('aktivite.rota_kaydediliyor') : $t('aktivite.bu_aktiviteyi_rota_olarak')}
            </Txt>
            <Icon name="chevron" size={18} color={colors.inkMuted} strokeWidth={2} />
          </Pressable>
        ) : null}
        {!a.mine && supabaseHazir && sunucuAktivitesiMi(a.id) ? (
          <SikayetBaglantisi etiket={$t('aktivite.bu_aktiviteyi_sikayet_et')} onPress={() => sikayet.ac('activity', a.id, `${a.title}${a.ownerName ? ` · ${a.ownerName}` : ''}`)} />
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
            <IconButton floating icon="more" label={$t('aktivite.aktiviteyi_duzenle')} onPress={() => router.push({ pathname: '/aktivite/[id]/duzenle', params: { id: a.id } })} />
          ) : undefined
        }
      />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={$t('aktivite.hiz_molalar')} icon="gauge" variant="outline" href={{ pathname: '/aktivite/[id]/hiz', params: { id: a.id } }} style={{ flex: 1 }} />
        <Button label={$t('ortak.paylas')} icon="share" href={{ pathname: '/aktivite/[id]/paylas', params: { id: a.id } }} style={{ flex: 1 }} />
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
  const metin = kisiler.length ? $t('aktivite.ile_birlikte', { adListesi: adListesi(kisiler.map((k) => (k.me ? 'sen' : k.kisa))) }) : $t('aktivite.birlikte_yaptigin_kisileri_ekle');
  return (
    <Pressable
      accessibilityRole={sunucu ? 'link' : undefined}
      accessibilityLabel={sunucu ? $t('aktivite.kisileri_ac', { metin }) : metin}
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

const styles = temaliStil(() => StyleSheet.create({
  birlikte: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, marginTop: 4 },
  rekor: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.terraSoft },
  rozet: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.seaSoft },
  root: { flex: 1, backgroundColor: colors.ground },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: space.lg, marginTop: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.lineStrong, gap: 1 },
  cell: { width: '33.1%', flexGrow: 1, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10 },
  link3d: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: space.lg, marginTop: space.lg, padding: 14, borderRadius: 16, backgroundColor: colors.seaSoft },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
}));
