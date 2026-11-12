import { ACTIVITY_LABELS, ACTIVITY_TYPES, formatKm, type ActivityType } from '@lykiva/shared';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { rotaGetir, rotalarim, type Rota } from '@/data/rota';
import { gruplarim, type GrupOzeti } from '@/grup/gruplar';
import type { PaylasimGrubu } from '@/kayit/canliPaylasim';
import { supabaseHazir } from '@/lib/supabase';
import { baslat, IzinHatasi, konumOnizlemeBaslat, useKayit } from '@/kayit/kaydedici';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

const icons: Record<ActivityType, IconName> = {
  bike: 'bike',
  mtb: 'bike',
  run: 'run',
  walk: 'walk',
  hike: 'mountain',
  trail_run: 'mountain',
};

/** GPS doğruluğuna göre durum etiketi */
function gpsEtiketi(acc: number | null | undefined): { text: string; color: string } {
  if (acc == null) return { text: $t('kayit.gps_araniyor'), color: colors.inkMuted };
  if (acc <= 15) return { text: $t('kayit.gps_hazir_m', { round: Math.round(acc) }), color: colors.sea };
  if (acc <= 30) return { text: $t('kayit.gps_zayif_m', { round: Math.round(acc) }), color: '#B7862B' };
  return { text: $t('kayit.gps_cok_zayif'), color: colors.terra };
}

export default function KayitBaslatScreen() {
  const insets = useSafeAreaInsets();
  const kayit = useKayit();
  const [type, setType] = useState<ActivityType>('bike');
  const [hata, setHata] = useState<string | null>(null);
  const [izinHatasi, setIzinHatasi] = useState(false);
  const [basliyor, setBasliyor] = useState(false);
  const params = useLocalSearchParams<{ rota?: string }>();
  const [rota, setRota] = useState<Rota | null>(null);
  const [rotaListesi, setRotaListesi] = useState<Rota[] | null>(null);
  const [secimAcik, setSecimAcik] = useState(false);
  // Canlı konum: varsayılan kapalı; kullanıcı açıkça bir grup seçer
  const [paylasim, setPaylasim] = useState<PaylasimGrubu | null>(null);
  const [gruplar, setGruplar] = useState<GrupOzeti[] | null>(null);
  const [paylasimAcik, setPaylasimAcik] = useState(false);

  useEffect(() => konumOnizlemeBaslat(), []);

  // Rota sayfasından "Bu rotayı başlat" ile gelindiyse rotayı yükle
  useEffect(() => {
    if (!params.rota) return;
    let iptal = false;
    rotaGetir(params.rota)
      .then((r) => {
        if (iptal) return;
        setRota(r);
        setType(r.activity);
      })
      .catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, [params.rota]);

  async function secimiAc() {
    setSecimAcik((a) => !a);
    if (!rotaListesi) setRotaListesi(await rotalarim().catch(() => []));
  }

  if (kayit.durum === 'kayitta') return <Redirect href="/kayit/canli" />;
  if (kayit.durum === 'duraklatildi') return <Redirect href="/kayit/duraklatildi" />;

  const sk = kayit.sonKonum;
  const ben = sk ? ([sk.lng, sk.lat] as [number, number]) : null;
  const gps = gpsEtiketi(sk?.acc);

  async function onBaslat() {
    setHata(null);
    setIzinHatasi(false);
    setBasliyor(true);
    try {
      await baslat(type, rota ? { id: rota.id, name: rota.name, points: rota.points } : null, paylasim);
      router.replace('/kayit/canli');
    } catch (e) {
      setIzinHatasi(e instanceof IzinHatasi);
      setHata(e instanceof Error ? e.message : $t('kayit.kayit_baslatilamadi'));
    } finally {
      setBasliyor(false);
    }
  }

  return (
    <View style={styles.root}>
      <TopoMap
        style={StyleSheet.absoluteFill}
        route={rota ? rota.points.map((p) => [p.lng, p.lat] as [number, number]) : undefined}
        markers={ben ? [{ id: 'me', coord: ben, kind: 'me' }] : []}
        follow={rota ? null : ben}
        katmanDugmesi={{ top: insets.top + 58 }}
        padding={{ top: 110, bottom: 420 }}
        accessibilityLabel={$t('kayit.bulundugun_konumun_haritasi')}
      />
      <FloatingHeader
        left={<IconButton floating icon="close" label={$t('ortak.kapat')} onPress={() => router.back()} />}
        middle={
          <View style={styles.gps} accessibilityLiveRegion="polite">
            <View style={[styles.gpsDot, { backgroundColor: gps.color }]} />
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12 }}>{gps.text}</Txt>
          </View>
        }
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <Txt variant="heading" accessibilityRole="header" style={{ marginBottom: 12 }}>
          {$t('kayit.ne_yapiyorsun')}</Txt>
        <View accessibilityRole="radiogroup" style={styles.grid}>
          {ACTIVITY_TYPES.map((t) => {
            const on = t === type;
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setType(t)}
                style={[styles.tile, on && styles.tileOn]}>
                <Icon name={icons[t]} size={24} color={on ? colors.ground : colors.ink} />
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: on ? colors.ground : colors.ink }}>{ACTIVITY_LABELS[t]}</Txt>
              </Pressable>
            );
          })}
        </View>

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: secimAcik }} onPress={secimiAc} style={styles.rotaRow}>
          <Icon name="route" color={colors.terra} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="small">{$t('kayit.rota')}</Txt>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
              {rota ? $t('kayit.km', { name: rota.name, km: formatKm(rota.distanceM) }) : $t('kayit.rotasiz_kaydet')}
            </Txt>
          </View>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.seaInk }}>{secimAcik ? $t('ortak.kapat') : $t('kayit.degistir')}</Txt>
        </Pressable>
        {secimAcik ? (
          <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 4 }}>
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: !rota }} onPress={() => { setRota(null); setSecimAcik(false); }} style={styles.secenek}>
              <Txt style={{ fontFamily: rota ? fontFamily.body : fontFamily.bodyBold, fontSize: 14 }}>{$t('kayit.rotasiz_kaydet')}</Txt>
            </Pressable>
            {(rotaListesi ?? []).map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: rota?.id === r.id }}
                onPress={() => {
                  setRota(r);
                  setType(r.activity);
                  setSecimAcik(false);
                }}
                style={styles.secenek}>
                <Txt style={{ fontFamily: rota?.id === r.id ? fontFamily.bodyBold : fontFamily.body, fontSize: 14 }} numberOfLines={1}>
                  {$t('kayit.km_2', { name: r.name, km: formatKm(r.distanceM) })}</Txt>
              </Pressable>
            ))}
            {rotaListesi && rotaListesi.length === 0 ? <Txt variant="small">{$t('kayit.henuz_rotan_yok_profil')}</Txt> : null}
          </ScrollView>
        ) : null}

        {supabaseHazir ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: paylasimAcik }}
              onPress={async () => {
                const ac = !paylasimAcik;
                setPaylasimAcik(ac);
                if (ac && !gruplar) setGruplar(await gruplarim().catch(() => []));
              }}
              style={styles.rotaRow}>
              <Icon name="users" color={paylasim ? colors.sea : colors.inkMuted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="small">{$t('kayit.canli_konum')}</Txt>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                  {paylasim ? $t('kayit.grubuyla_paylasilacak', { ad: paylasim.ad }) : $t('kayit.paylasilmiyor')}
                </Txt>
              </View>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.seaInk }}>{paylasimAcik ? $t('ortak.kapat') : $t('kayit.degistir')}</Txt>
            </Pressable>
            {paylasimAcik ? (
              <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 4 }}>
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: !paylasim }} onPress={() => { setPaylasim(null); setPaylasimAcik(false); }} style={styles.secenek}>
                  <Txt style={{ fontFamily: paylasim ? fontFamily.body : fontFamily.bodyBold, fontSize: 14 }}>{$t('kayit.paylasma')}</Txt>
                </Pressable>
                {(gruplar ?? []).map((g) => (
                  <Pressable
                    key={g.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: paylasim?.id === g.id }}
                    onPress={() => {
                      setPaylasim({ id: g.id, ad: g.name });
                      setPaylasimAcik(false);
                    }}
                    style={styles.secenek}>
                    <Txt style={{ fontFamily: paylasim?.id === g.id ? fontFamily.bodyBold : fontFamily.body, fontSize: 14 }} numberOfLines={1}>
                      {$t('kayit.uye', { name: g.name, member_count: g.member_count })}</Txt>
                  </Pressable>
                ))}
                {gruplar && gruplar.length === 0 ? <Txt variant="small">{$t('kayit.konum_paylasmak_icin_once')}</Txt> : null}
                <Txt variant="small">{$t('kayit.yalnizca_sectigin_grubun_uyeleri')}</Txt>
              </ScrollView>
            ) : null}
          </>
        ) : null}

        <Txt variant="small">{$t('kayit.ekran_kapaliyken_de_kaydetmesi')}</Txt>

        {hata ? (
          <View style={styles.error} accessibilityRole="alert">
            <Txt style={{ color: colors.terra, fontFamily: fontFamily.bodySemiBold, fontSize: 13 }}>{hata}</Txt>
            {izinHatasi ? (
              <Pressable accessibilityRole="link" onPress={() => Linking.openSettings()}>
                <Txt style={{ color: colors.seaInk, fontFamily: fontFamily.bodyBold, fontSize: 13, marginTop: 4 }}>{$t('kayit.ayarlari_ac')}</Txt>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Button label={basliyor ? $t('kayit.baslatiliyor') : $t('kayit.baslat')} icon="play" big onPress={onBaslat} disabled={basliyor} style={{ marginTop: space.md }} />
      </View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  gps: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.lg,
    paddingTop: 18,
    gap: space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  tile: { width: '31.6%', height: 72, borderRadius: 16, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: 'transparent' },
  tileOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  error: { padding: 12, borderRadius: 12, backgroundColor: colors.terraSoft },
  rotaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.ground },
  secenek: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.ground },
}));
