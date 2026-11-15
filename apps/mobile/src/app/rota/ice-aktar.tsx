/**
 * GPX içe aktarma: başka bir uygulamadan (Komoot, Strava, Garmin, Wikiloc…) indirilen GPX dosyası rota olarak,
 * dosyada zaman bilgisi varsa aktivite olarak da eklenir.
 *
 * Ekran açılınca telefonun dosya seçicisi açılır (expo-file-system > File.pickFileAsync; derlemelerde zaten var,
 * yeni derleme gerekmez). Dosya `@lykiva/shared` > `gpxOku` ile okunur; haritada önizleme, ölçüler, ad ve tür
 * (dosyadan dolar, değiştirilebilir).
 * - Rota olarak: iz sadeleştirilir (`rotaSadelestir`, köşeler kalır, en fazla 5000 nokta) ve `rotaKaydet` ile kaydedilir.
 * - Aktivite olarak: noktalar olduğu gibi kayıt paketine girer (parçalar duraklatma sayılır), kayıt kuyruğuyla gönderilir;
 *   süre, hız ve molalar kayıttaki gibi hesaplanır.
 */
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  DIFFICULTY_LABELS,
  estimateDifficulty,
  formatDuration,
  formatKm,
  formatMeters,
  gpxOku,
  kmUnit,
  rotaSadelestir,
  routeStats,
  type ActivityType,
  type GpxSonucu,
  type TrackPoint,
} from '@lykiva/shared';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { TopoMap, type MapMarker } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button, Chip, Stat } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { rotaKaydet, type Rota } from '@/data/rota';
import { kuyrugaEkle, kuyruguGonder, sunucuIdsi } from '@/kayit/kuyruk';
import { paketOlustur } from '@/kayit/paket';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

type Durum = { tur: 'seciliyor' } | { tur: 'hata'; mesaj: string } | { tur: 'hazir'; gpx: GpxSonucu };

const GORUNURLUK = (): { id: Rota['visibility']; label: string }[] => [
  { id: 'private', label: $t('ortak.sadece_ben') },
  { id: 'followers', label: $t('ortak.takipciler') },
  { id: 'public', label: $t('ortak.herkese_acik') },
];

export default function GpxIceAktarScreen() {
  const insets = useSafeAreaInsets();
  const [durum, setDurum] = useState<Durum>({ tur: 'seciliyor' });
  const [ad, setAd] = useState('');
  const [activity, setActivity] = useState<ActivityType>('hike');
  const [aktiviteOlarak, setAktiviteOlarak] = useState(false);
  const [gorunurluk, setGorunurluk] = useState<Rota['visibility']>('private');
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function dosyaSec() {
    setDurum({ tur: 'seciliyor' });
    setHata(null);
    try {
      // GPX'in dosya türünü telefonlar farklı bildirir (application/gpx+xml, octet-stream…): süzgeç yok, içerik denetlenir
      const secim = await File.pickFileAsync();
      if (secim.canceled) {
        if (router.canGoBack()) router.back();
        return;
      }
      const gpx = gpxOku(await secim.result.text());
      if (gpx.parcalar.flat().length < 2) {
        setDurum({ tur: 'hata', mesaj: $t('gpx_ice_aktar.nokta_yok') });
        return;
      }
      setAd(gpx.ad ?? '');
      if (gpx.tur) setActivity(gpx.tur);
      setAktiviteOlarak(false);
      setDurum({ tur: 'hazir', gpx });
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      setDurum({ tur: 'hata', mesaj: /pickFile|not a function|undefined/i.test(m) ? $t('gpx_ice_aktar.secici_yok') : $t('gpx_ice_aktar.okunamadi') });
    }
  }

  // Ekran açılınca dosya seçici
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seçici açılırken durum güncellenir; tek seferlik
    void dosyaSec();
  }, []);

  const gpx = durum.tur === 'hazir' ? durum.gpx : null;
  const hepsi = useMemo(() => (gpx ? gpx.parcalar.flat() : []), [gpx]);
  const stats = useMemo(() => (hepsi.length > 1 ? routeStats(hepsi) : null), [hepsi]);
  const rakimVar = hepsi.some((p) => p.alt != null);
  const sureS = gpx?.zamanli ? Math.round(((hepsi[hepsi.length - 1].t as number) - (hepsi[0].t as number)) / 1000) : null;
  const zorluk = stats ? estimateDifficulty(activity, stats.distanceM, stats.gainM) : null;
  const cizgi = useMemo<LngLat[]>(() => rotaSadelestir(hepsi, 5, 1500).map((p) => [p.lng, p.lat]), [hepsi]);
  const markers: MapMarker[] =
    cizgi.length > 1
      ? [
          { id: 'bas', coord: cizgi[0], kind: 'start' },
          { id: 'son', coord: cizgi[cizgi.length - 1], kind: 'end' },
        ]
      : [];

  async function kaydet() {
    if (!gpx || !stats || !zorluk) return;
    setKaydediyor(true);
    setHata(null);
    const baslik = ad.trim() || $t('gpx_ice_aktar.adsiz');
    try {
      if (aktiviteOlarak && gpx.zamanli) {
        const clientId = randomUUID();
        const segments: TrackPoint[][] = gpx.parcalar.map((p) => p.map((n) => ({ t: n.t as number, lat: n.lat, lng: n.lng, alt: n.alt, acc: null, speed: null })));
        const paket = paketOlustur({ clientId, activity, segments, title: baslik });
        if (!paket) throw new Error($t('gpx_ice_aktar.nokta_yok'));
        await kuyrugaEkle(paket);
        await kuyruguGonder().catch(() => undefined);
        const id = (await sunucuIdsi(clientId)) ?? `yerel-${clientId}`;
        router.replace({ pathname: '/aktivite/[id]', params: { id } });
      } else {
        const id = await rotaKaydet({
          name: baslik,
          activity,
          points: rotaSadelestir(hepsi).map((p) => ({ lat: p.lat, lng: p.lng, alt: p.alt })),
          difficulty: zorluk,
          surface: null,
          visibility: gorunurluk,
        });
        router.replace({ pathname: '/rota/[id]', params: { id } });
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('ortak.kaydedilemedi'));
      setKaydediyor(false);
    }
  }

  return (
    <View style={styles.root}>
      <TopoMap
        style={StyleSheet.absoluteFill}
        route={cizgi.length > 1 ? cizgi : undefined}
        markers={markers}
        katmanDugmesi={{ top: insets.top + 58 }}
        padding={{ top: 120, bottom: 460 }}
        accessibilityLabel={$t('gpx_ice_aktar.harita')}
      />
      <FloatingHeader left={<IconButton floating icon="close" label={$t('ortak.kapat')} onPress={() => router.back()} />} middle={<View />} right={<View />} />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grip} />
        <Txt variant="heading" accessibilityRole="header" style={{ marginBottom: space.sm }}>
          {$t('gpx_ice_aktar.baslik')}
        </Txt>

        {durum.tur === 'seciliyor' ? (
          <View style={styles.ortala}>
            <ActivityIndicator color={colors.terra} />
            <Txt variant="small">{$t('gpx_ice_aktar.dosya_bekleniyor')}</Txt>
          </View>
        ) : durum.tur === 'hata' ? (
          <View style={{ gap: space.md }}>
            <Txt accessibilityRole="alert" style={styles.hata}>
              {durum.mesaj}
            </Txt>
            <Button label={$t('gpx_ice_aktar.baska_dosya')} icon="download" variant="outline" onPress={() => void dosyaSec()} />
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextInput value={ad} onChangeText={setAd} placeholder={$t('gpx_ice_aktar.adsiz')} placeholderTextColor={colors.inkMuted} accessibilityLabel={$t('rota_olustur.rota_adi')} style={styles.ad} />

            <View style={styles.olculer}>
              <Stat label={$t('ortak.mesafe')} size={18} value={stats ? `${formatKm(stats.distanceM)} ${kmUnit()}` : '–'} />
              <Stat label={$t('ortak.tirmanis')} size={18} value={stats && rakimVar ? $t('rota_olustur.m', { meters: formatMeters(stats.gainM) }) : '–'} />
              {sureS != null ? <Stat label={$t('ortak.sure')} size={18} value={formatDuration(sureS)} /> : <Stat label={$t('ortak.inis')} size={18} value={stats && rakimVar ? $t('rota_olustur.m_2', { meters: formatMeters(stats.lossM) }) : '–'} />}
            </View>
            <Txt variant="small" style={{ marginTop: 6 }}>
              {[$t('gpx_ice_aktar.nokta_sayisi', { n: hepsi.length }), zorluk ? DIFFICULTY_LABELS[zorluk] : null].filter(Boolean).join(' · ')}
            </Txt>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 12 }} accessibilityRole="radiogroup">
              {ACTIVITY_TYPES.map((t) => (
                <Chip key={t} label={ACTIVITY_LABELS[t]} role="radio" selected={t === activity} onPress={() => setActivity(t)} />
              ))}
            </ScrollView>

            {gpx?.zamanli ? (
              <>
                <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup">
                  <Chip label={$t('gpx_ice_aktar.rota_olarak')} role="radio" tone="sea" selected={!aktiviteOlarak} onPress={() => setAktiviteOlarak(false)} />
                  <Chip label={$t('gpx_ice_aktar.aktivite_olarak')} role="radio" tone="sea" selected={aktiviteOlarak} onPress={() => setAktiviteOlarak(true)} />
                </View>
                <Txt variant="small" style={{ marginTop: 6 }}>
                  {aktiviteOlarak ? $t('gpx_ice_aktar.aktivite_aciklama') : $t('gpx_ice_aktar.rota_aciklama')}
                </Txt>
              </>
            ) : null}

            {aktiviteOlarak ? null : (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }} accessibilityRole="radiogroup">
                {GORUNURLUK().map((g) => (
                  <Chip key={g.id} label={g.label} role="radio" tone="sea" selected={g.id === gorunurluk} onPress={() => setGorunurluk(g.id)} />
                ))}
              </View>
            )}

            {hata ? (
              <Txt accessibilityRole="alert" style={[styles.hata, { marginTop: 10 }]}>
                {hata}
              </Txt>
            ) : null}

            <Button
              label={kaydediyor ? $t('ortak.kaydediliyor') : aktiviteOlarak ? $t('gpx_ice_aktar.kaydet_aktivite') : $t('rota_olustur.rotayi_kaydet')}
              icon={aktiviteOlarak ? 'record' : 'route'}
              onPress={() => void kaydet()}
              disabled={!stats || kaydediyor}
              style={{ marginTop: space.md }}
            />
            <Button label={$t('gpx_ice_aktar.baska_dosya')} variant="outline" onPress={() => void dosyaSec()} disabled={kaydediyor} style={{ marginTop: space.sm }} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: 10 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 10 },
  ortala: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  hata: { color: colors.terra, fontFamily: fontFamily.bodySemiBold, fontSize: 14 },
  ad: { fontFamily: fontFamily.display, fontSize: 22, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 6, marginBottom: 12 },
  olculer: { flexDirection: 'row', justifyContent: 'space-between', columnGap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.ground },
}));
