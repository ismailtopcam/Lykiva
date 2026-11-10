import { ACTIVITY_LABELS, formatKm } from '@lykiva/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap, type MapMarker } from '@/components/map/TopoMap';
import { OrnekEtkinlik } from '@/components/OrnekEtkinlik';
import { SikayetBaglantisi, useSikayet } from '@/components/SikayetPenceresi';
import { Txt } from '@/components/Txt';
import { Avatar } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import {
  bittiMi,
  etkinlikDetayi,
  etkinlikSil,
  katilimBildir,
  KATILIM_ADI,
  paylasimMetni,
  uzunTarih,
  ZORLUK_ADI,
  type EtkinlikDetayi,
  type Katilim,
} from '@/etkinlik/etkinlikler';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { colors, fontFamily, space } from '@/theme';

const uuidMi = (id: string | undefined) => !!id && /^[0-9a-f-]{36}$/i.test(id);

export default function EtkinlikDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return uuidMi(id) ? <GercekEtkinlik id={id} /> : <OrnekEtkinlik />;
}

function Bilgi({ icon, title, sub, onPress, right }: { icon: IconName; title: string; sub?: string; onPress?: () => void; right?: ReactNode }) {
  return (
    <Pressable accessibilityRole={onPress ? 'link' : undefined} onPress={onPress} disabled={!onPress} style={styles.info}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>{title}</Txt>
        {sub ? <Txt variant="small">{sub}</Txt> : null}
      </View>
      {right}
    </Pressable>
  );
}

const SECENEKLER: { durum: Exclude<Katilim, 'waitlist'>; ad: string }[] = [
  { durum: 'going', ad: 'Katılıyorum' },
  { durum: 'maybe', ad: 'Belki' },
  { durum: 'declined', ad: 'Gelemem' },
];

function GercekEtkinlik({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const [e, setE] = useState<EtkinlikDetayi | null | undefined>(undefined);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const sikayet = useSikayet();

  const yukle = useCallback(async () => {
    try {
      setHata(null);
      setE(await etkinlikDetayi(id));
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Etkinlik yüklenemedi');
      setE((x) => (x === undefined ? null : x));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  if (!e) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: space.lg }]}>
        <FloatingHeader />
        {e === undefined ? <ActivityIndicator color={colors.terra} /> : <Txt variant="muted">{hata ?? 'Etkinlik bulunamadı, iptal edilmiş ya da görme iznin yok.'}</Txt>}
      </View>
    );
  }

  const ev = e;
  const bitti = bittiMi(ev.starts_at);
  const katilabilir = ev.is_member || ev.visibility === 'public';
  const rotaYolu: LngLat[] = (ev.route?.coordinates ?? []).map((c) => [c[0], c[1]] as LngLat);
  const bulusma: LngLat | null = ev.meeting_lng != null && ev.meeting_lat != null ? [ev.meeting_lng, ev.meeting_lat] : null;
  const isaretler: MapMarker[] = [
    ...(rotaYolu.length > 1 ? [{ id: 's', coord: rotaYolu[0], kind: 'start' as const }] : []),
    ...(bulusma ? [{ id: 'm', coord: bulusma, kind: 'meeting' as const }] : []),
  ];
  const katilanlar = ev.attendees.filter((a) => a.status === 'going');
  const digerleri = ev.attendees.filter((a) => a.status !== 'going');

  async function bildir(durum: Exclude<Katilim, 'waitlist'>) {
    setMesgul(true);
    setMesaj(null);
    try {
      const sonuc = await katilimBildir(ev.id, durum);
      if (sonuc === 'waitlist') setMesaj('Kontenjan dolu: bekleme listesine alındın. Yer açılınca otomatik katılımcı olursun.');
      await yukle();
    } catch (err) {
      setMesaj(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setMesgul(false);
    }
  }

  function iptal() {
    Alert.alert('Etkinlik iptal edilsin mi?', ev.group_id ? 'Etkinlik silinir; grubun sohbetine iptal notu düşer.' : 'Etkinlik ve katılım bilgileri silinir.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İptal et',
        style: 'destructive',
        onPress: async () => {
          try {
            await etkinlikSil(ev.id);
            router.back();
          } catch (err) {
            Alert.alert('İptal edilemedi', err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
  }

  const ozellikler = [ev.route ? `${formatKm(ev.route.distance_m)} km` : null, ev.route?.elevation_gain_m != null ? `↑ ${Math.round(ev.route.elevation_gain_m)} m` : null, ev.difficulty ? `${ZORLUK_ADI[ev.difficulty]} seviye` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {rotaYolu.length > 1 || bulusma ? (
          <TopoMap
            style={{ height: 240 + insets.top }}
            route={rotaYolu}
            markers={isaretler}
            padding={{ top: insets.top + 70, bottom: 24 }}
            accessibilityLabel={`Etkinlik haritası${ev.route ? ': rota' : ''}${bulusma ? ' ve buluşma noktası' : ''}`}
          />
        ) : (
          <View style={{ height: insets.top + 64, backgroundColor: colors.land }} />
        )}
        <View style={{ padding: space.lg }}>
          <Txt variant="label" color={colors.sea}>
            {[ev.group_name, ACTIVITY_LABELS[ev.activity], ev.visibility === 'public' ? 'Herkese açık' : 'Grup etkinliği'].filter(Boolean).join(' · ')}
          </Txt>
          <Txt variant="display" style={{ marginTop: 4, marginBottom: 12 }} accessibilityRole="header">
            {ev.title}
          </Txt>
          <View style={{ gap: 10, marginBottom: 14 }}>
            <Bilgi icon="calendar" title={uzunTarih(ev.starts_at)} sub={bitti ? 'Etkinlik sona erdi' : `${ev.creator_name} düzenliyor`} />
            {ev.meeting_point_name || bulusma ? <Bilgi icon="pin" title={ev.meeting_point_name ?? 'Haritada işaretli nokta'} sub="Buluşma noktası" /> : null}
            {ev.route ? (
              <Bilgi
                icon="route"
                title={ozellikler || ev.route.name}
                sub={`${ev.route.name}${ev.route.is_loop ? ', döngü' : ''}`}
                onPress={() => router.push({ pathname: '/rota/[id]', params: { id: ev.route!.id } })}
                right={<Icon name="chevron" size={18} color={colors.inkMuted} strokeWidth={2} />}
              />
            ) : ev.difficulty ? (
              <Bilgi icon="mountain" title={`${ZORLUK_ADI[ev.difficulty]} seviye`} />
            ) : null}
          </View>
          {ev.description ? <Txt style={{ fontSize: 14, lineHeight: 21, marginBottom: 14 }}>{ev.description}</Txt> : null}

          <View style={styles.people}>
            <Txt style={{ fontSize: 14, flex: 1 }}>
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>
                {ev.going_count}
                {ev.capacity ? ` / ${ev.capacity}` : ''}
              </Txt>{' '}
              <Txt style={{ color: colors.inkMuted, fontSize: 14 }}>
                katılıyor{ev.maybe_count ? ` · ${ev.maybe_count} belki` : ''}
                {ev.waitlist_count ? ` · ${ev.waitlist_count} bekleme listesinde` : ''}
              </Txt>
            </Txt>
            {ev.group_id && ev.is_member ? (
              <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/grup/[id]/sohbet', params: { id: ev.group_id! } })} hitSlop={8}>
                <Txt style={{ fontSize: 13, fontFamily: fontFamily.bodySemiBold, color: colors.terra }}>Sohbete git</Txt>
              </Pressable>
            ) : null}
          </View>
          <View style={{ gap: 8, marginTop: 4 }}>
            {[...katilanlar, ...digerleri].map((a) => (
              <View key={a.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar initials={basHarfler(a.display_name)} tone={grupRengi(a.user_id)} size={32} />
                <Txt style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                  {a.display_name}
                  {a.user_id === ev.created_by ? ' · düzenleyen' : ''}
                </Txt>
                {a.status !== 'going' ? <Txt variant="small">{KATILIM_ADI[a.status]}</Txt> : null}
              </View>
            ))}
          </View>

          {ev.can_manage && !bitti ? (
            <Pressable accessibilityRole="button" onPress={iptal} style={{ marginTop: space.xl, alignSelf: 'center', padding: 8 }}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.terraInk }}>Etkinliği iptal et</Txt>
            </Pressable>
          ) : null}
          {!ev.can_manage ? <SikayetBaglantisi etiket="Bu etkinliği şikayet et" onPress={() => sikayet.ac('event', ev.id, `${ev.title} · ${ev.creator_name}`)} /> : null}
        </View>
      </ScrollView>

      <FloatingHeader right={<IconButton floating icon="share" label="Etkinliği paylaş" onPress={() => void Share.share({ message: paylasimMetni(ev) }).catch(() => undefined)} />} />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {mesaj ? (
          <Txt accessibilityLiveRegion="polite" style={styles.mesaj}>
            {mesaj}
          </Txt>
        ) : null}
        {bitti ? (
          <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: 14 }}>
            Etkinlik sona erdi.
          </Txt>
        ) : !katilabilir ? (
          <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: 14 }}>
            Bu etkinliğe yalnızca grup üyeleri katılabilir.
          </Txt>
        ) : (
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
            {SECENEKLER.map((s) => {
              const on = ev.my_status === s.durum || (s.durum === 'going' && ev.my_status === 'waitlist');
              const etiket = s.durum === 'going' && ev.my_status === 'waitlist' ? 'Bekleme listesi' : s.durum === 'going' && !on && ev.capacity != null && ev.going_count >= ev.capacity ? 'Listeye gir' : s.ad;
              return (
                <Pressable
                  key={s.durum}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: mesgul }}
                  disabled={mesgul}
                  onPress={() => void bildir(s.durum)}
                  style={[styles.rsvp, on && { backgroundColor: s.durum === 'going' ? colors.terra : colors.ink, borderColor: s.durum === 'going' ? colors.terra : colors.ink }]}>
                  <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14, color: on ? '#FFFFFF' : colors.ink }} numberOfLines={1}>
                    {etiket}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      {sikayet.pencere}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  people: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.lineStrong },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground, borderTopWidth: 1, borderTopColor: colors.line },
  rsvp: { flex: 1, height: 54, borderRadius: 27, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  mesaj: { textAlign: 'center', fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.seaInk, marginBottom: 8 },
});
