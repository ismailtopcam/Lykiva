/**
 * Canlı grup haritası: grubun şu an kayıtta olan ve konumunu paylaşan üyeleri.
 * 10 saniyede bir yenilenir; 15 dakikadan eski konumlar sunucuda zaten gizlenir.
 */
import { ACTIVITY_LABELS, formatDuration, formatKm, formatSpeedKmh, type ActivityType, kmUnit } from '@lykiva/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap, type MapMarker } from '@/components/map/TopoMap';
import { OrnekCanliHarita } from '@/components/OrnekCanliHarita';
import { Txt } from '@/components/Txt';
import { Avatar, Button } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { basHarfler, grupDetayi, grupRengi } from '@/grup/gruplar';
import { useHesap } from '@/lib/giris';
import { oturumuSagla, supabase } from '@/lib/supabase';
import { useKayit } from '@/kayit/kaydedici';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

const uuidMi = (id: string | undefined) => !!id && /^[0-9a-f-]{36}$/i.test(id);
const YENILEME_MS = 10_000;

type CanliUye = {
  user_id: string;
  display_name: string;
  activity: ActivityType | null;
  lng: number;
  lat: number;
  speed_mps: number | null;
  is_paused: boolean;
  distance_m: number | null;
  started_at: string | null;
  updated_at: string;
};

export default function CanliHaritaScreen() {
  const { grup } = useLocalSearchParams<{ grup?: string }>();
  return uuidMi(grup) ? <GrupCanliHaritasi grupId={grup!} /> : <OrnekCanliHarita />;
}

/** "az önce", "3 dk önce" */
function once(ms: number) {
  const dk = Math.floor(ms / 60_000);
  return dk < 1 ? $t('canli_harita.az_once') : $t('canli_harita.dk_once', { dk });
}

function GrupCanliHaritasi({ grupId }: { grupId: string }) {
  const insets = useSafeAreaInsets();
  const hesap = useHesap();
  const kayit = useKayit();
  const [ad, setAd] = useState<string | null>(null);
  const [uyeler, setUyeler] = useState<CanliUye[] | null>(null);
  const [simdi, setSimdi] = useState(0);
  const [hata, setHata] = useState<string | null>(null);
  const [odak, setOdak] = useState<LngLat | null>(null);
  const [haritaAnahtari, setHaritaAnahtari] = useState(0);

  const yukle = useCallback(async () => {
    try {
      await oturumuSagla();
      const { data, error } = await supabase.rpc('grup_canli_konumlari', { g: grupId });
      if (error) throw new Error(error.message);
      setUyeler((data ?? []) as CanliUye[]);
      setSimdi(Date.now());
      setHata(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('canli_harita.konumlar_alinamadi'));
      setUyeler((u) => u ?? []);
    }
  }, [grupId]);

  useFocusEffect(
    useCallback(() => {
      void grupDetayi(grupId)
        .then((g) => setAd(g?.name ?? null))
        .catch(() => undefined);
      void yukle();
      const t = setInterval(() => void yukle(), YENILEME_MS);
      return () => clearInterval(t);
    }, [grupId, yukle]),
  );

  const ben = kayit.sonKonum ? ([kayit.sonKonum.lng, kayit.sonKonum.lat] as LngLat) : null;
  const benPaylasiyorum = kayit.durum !== 'bos' && kayit.paylasim?.id === grupId;
  const digerleri = (uyeler ?? []).filter((u) => u.user_id !== hesap?.id);

  const isaretler: MapMarker[] = [
    ...(ben ? [{ id: 'ben', coord: ben, kind: 'me' as const }] : []),
    ...digerleri.map((u) => ({
      id: u.user_id,
      coord: [u.lng, u.lat] as LngLat,
      kind: 'friend' as const,
      render: (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={[styles.tag, u.is_paused && styles.tagMola]}>
            <Txt numberOfLines={1} style={{ fontSize: 11, fontFamily: fontFamily.bodySemiBold, color: u.is_paused ? colors.ink : colors.ground }}>
              {u.display_name.split(' ')[0]} · {u.is_paused ? $t('ortak.molada') : u.speed_mps != null ? $t('canli_harita.km_sa', { speedKmh: formatSpeedKmh(u.speed_mps) }) : $t('ortak.yolda')}
            </Txt>
          </View>
          <View style={[styles.pin, { borderColor: u.is_paused ? '#9C9282' : colors.terra }]}>
            <Avatar initials={basHarfler(u.display_name)} tone={grupRengi(u.user_id)} size={28} />
          </View>
        </View>
      ),
    })),
  ];

  return (
    <View style={styles.root}>
      {uyeler === null ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.terra} />
        </View>
      ) : (
        <TopoMap
          key={haritaAnahtari}
          style={StyleSheet.absoluteFill}
          markers={isaretler}
          follow={odak}
          followZoom={15}
          katmanDugmesi={{ top: insets.top + 58 }}
          padding={{ top: 140, bottom: 380 }}
          accessibilityLabel={$t('canli_harita.canli_haritasi_kisi_konum', { a: ad ?? $t('ortak.grup'), length: digerleri.length })}
        />
      )}
      <FloatingHeader
        middle={
          <View style={styles.baslik}>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }} numberOfLines={1}>
              {ad ?? $t('ortak.grup')}
            </Txt>
          </View>
        }
        right={
          <IconButton
            floating
            icon="users"
            label={$t('canli_harita.herkesi_goster')}
            onPress={() => {
              setOdak(null);
              setHaritaAnahtari((k) => k + 1);
            }}
          />
        }
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grip} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <Txt variant="heading" style={{ fontSize: 20 }}>
            {$t('canli_harita.su_an_yolda')}</Txt>
          <Txt variant="small">{digerleri.length ? $t('canli_harita.kisi_canli_paylasiyor', { length: digerleri.length }) : $t('canli_harita.kimse_paylasmiyor')}</Txt>
        </View>
        <ScrollView style={{ maxHeight: 220 }}>
          {digerleri.length === 0 && uyeler ? (
            <Txt variant="muted" style={{ paddingVertical: space.md }}>
              {$t('canli_harita.grubundan_su_an_kayitta')}</Txt>
          ) : null}
          {digerleri.map((u) => {
            const sure = u.started_at ? (simdi - Date.parse(u.started_at)) / 1000 : null;
            const yas = simdi - Date.parse(u.updated_at);
            const ayrinti = [
              u.activity ? ACTIVITY_LABELS[u.activity] : null,
              u.distance_m != null ? `${formatKm(u.distance_m)} ${kmUnit()}` : null,
              sure != null && sure > 0 ? formatDuration(sure) : null,
              u.is_paused ? $t('ortak.molada') : null,
              yas > 90_000 ? $t('canli_harita.son_konum', { once: once(yas) }) : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                key={u.user_id}
                accessibilityRole="button"
                accessibilityLabel={$t('canli_harita.haritada_goster', { display_name: u.display_name, ayrinti })}
                onPress={() => setOdak([u.lng, u.lat])}
                style={styles.row}>
                <Avatar initials={basHarfler(u.display_name)} tone={grupRengi(u.user_id)} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                    {u.display_name}
                  </Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {ayrinti}
                  </Txt>
                </View>
                <Txt style={{ fontFamily: fontFamily.display, fontSize: 16, color: u.is_paused ? colors.inkMuted : colors.ink }}>
                  {u.is_paused ? '—' : u.speed_mps != null ? formatSpeedKmh(u.speed_mps) : ''}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
        {hata ? <Txt style={{ color: colors.terraInk, marginTop: 6 }}>{hata}</Txt> : null}

        <View style={styles.paylasim}>
          <Icon name="shield" size={20} color={colors.sea} />
          <Txt style={{ flex: 1, fontSize: 13 }}>
            {benPaylasiyorum
              ? $t('canli_harita.senin_konumun_da_bu')
              : $t('canli_harita.konumun_paylasilmiyor_paylasmak_icin')}
          </Txt>
        </View>
        {kayit.durum === 'bos' ? <Button label={$t('canli_harita.kayit_baslat')} icon="play" variant="dark" href="/kayit" style={{ marginTop: 10 }} /> : null}
      </View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  baslik: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', maxWidth: '100%' },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.ink, maxWidth: 160 },
  tagMola: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  pin: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: 10 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  paylasim: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: colors.ground },
}));
