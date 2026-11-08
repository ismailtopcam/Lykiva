import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  DIFFICULTY_LABELS,
  estimateDifficulty,
  estimateDuration,
  formatKm,
  formatMeters,
  routeStats,
  type ActivityType,
} from '@lykiva/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { gercekHarita, TopoMap, type MapMarker } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button, Chip, Stat } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { rotaKaydet, type Rota } from '@/data/rota';
import { konumOnizlemeBaslat, useKayit } from '@/kayit/kaydedici';
import { yerAra, type YerSonucu } from '@/lib/yerArama';
import { CIZIM_MODLARI, rotaHesapla, type CizimModu, type HesaplananRota } from '@/lib/yonlendirme';
import { colors, fontFamily, radius, space } from '@/theme';

const GORUNURLUK: { id: Rota['visibility']; label: string }[] = [
  { id: 'private', label: 'Sadece ben' },
  { id: 'followers', label: 'Takipçiler' },
  { id: 'public', label: 'Herkese açık' },
];

/** "5 sa 10 dk" */
function sureMetni(s: number) {
  const dk = Math.round(s / 60);
  const sa = Math.floor(dk / 60);
  return sa > 0 ? `${sa} sa ${dk % 60} dk` : `${dk} dk`;
}

export default function RotaOlusturScreen() {
  const insets = useSafeAreaInsets();
  const kayit = useKayit();
  const [mod, setMod] = useState<CizimModu>('patika');
  const [activity, setActivity] = useState<ActivityType>('hike');
  const [ad, setAd] = useState('');
  const [gorunurluk, setGorunurluk] = useState<Rota['visibility']>('private');
  const [duraklar, setDuraklar] = useState<LngLat[]>([]);
  const [sonuc, setSonuc] = useState<HesaplananRota | null>(null);
  const [hesapliyor, setHesapliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [q, setQ] = useState('');
  const [sonuclar, setSonuclar] = useState<YerSonucu[]>([]);
  const [odak, setOdak] = useState<{ c: LngLat; z: number } | null>(null);
  const ilkOdak = useRef(false);

  // Başlangıçta haritayı bulunduğun yere getir
  useEffect(() => konumOnizlemeBaslat(), []);
  const sk = kayit.sonKonum;
  useEffect(() => {
    if (sk && !ilkOdak.current) {
      ilkOdak.current = true;
      setOdak({ c: [sk.lng, sk.lat], z: 14 });
    }
  }, [sk]);

  // Duraklar, mod veya aktivite değişince rotayı yeniden hesapla
  useEffect(() => {
    if (duraklar.length < 2) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      setHesapliyor(true);
      setHata(null);
      rotaHesapla(duraklar, mod, activity, ac.signal)
        .then((r) => setSonuc(r))
        .catch((e) => {
          if (e?.name !== 'AbortError') setHata(e instanceof Error ? e.message : 'Rota hesaplanamadı');
        })
        .finally(() => !ac.signal.aborted && setHesapliyor(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [duraklar, mod, activity]);

  // Yer arama (yazmayı bırakınca)
  useEffect(() => {
    if (q.trim().length < 2) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      yerAra(q, odak?.c ?? null, ac.signal)
        .then(setSonuclar)
        .catch(() => undefined);
    }, 350);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q, odak?.c]);

  // İki noktadan azsa eski hesap/sonuç gösterilmez
  const yeterli = duraklar.length >= 2;
  const gorunenSonuclar = q.trim().length >= 2 ? sonuclar : [];
  const gorunenHata = yeterli ? hata : null;
  const points = useMemo(() => (yeterli && sonuc ? sonuc.points : []), [yeterli, sonuc]);
  const stats = useMemo(() => (points.length > 1 ? routeStats(points) : null), [points]);
  const zorluk = stats ? estimateDifficulty(activity, stats.distanceM, stats.gainM) : null;
  const rakimVar = points.some((p) => p.alt != null);
  const cizgi: LngLat[] = points.map((p) => [p.lng, p.lat]);

  const markers: MapMarker[] = duraklar.map((c, i) => ({
    id: `d${i}`,
    coord: c,
    kind: i === 0 ? 'start' : i === duraklar.length - 1 && duraklar.length > 1 ? 'end' : 'stop',
    text: i > 0 && i < duraklar.length - 1 ? String(i) : undefined,
  }));

  const zemin = yeterli ? sonuc?.surface : null;
  const zeminler = zemin
    ? [
        { label: 'Asfalt', pct: Math.round(zemin.asphalt * 100), color: colors.ink },
        { label: 'Toprak yol', pct: Math.round(zemin.gravel * 100), color: colors.ochre },
        { label: 'Patika', pct: Math.round(zemin.trail * 100), color: colors.sea },
      ].filter((z) => z.pct > 0)
    : [];

  async function onKaydet() {
    if (!stats || !zorluk) return;
    setKaydediyor(true);
    setHata(null);
    try {
      const id = await rotaKaydet({
        name: ad.trim() || `${ACTIVITY_LABELS[activity]} rotası`,
        activity,
        points,
        difficulty: zorluk,
        surface: zemin ?? null,
        visibility: gorunurluk,
      });
      router.replace({ pathname: '/rota/[id]', params: { id } });
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Kaydedilemedi');
      setKaydediyor(false);
    }
  }

  function yerSec(y: YerSonucu) {
    Keyboard.dismiss();
    setQ('');
    setSonuclar([]);
    setOdak({ c: y.coord, z: 15 });
  }

  return (
    <View style={styles.root}>
      <TopoMap
        style={StyleSheet.absoluteFill}
        route={cizgi.length > 1 ? cizgi : undefined}
        markers={markers}
        follow={odak?.c ?? null}
        followZoom={odak?.z}
        onPress={(c) => setDuraklar((d) => [...d, c])}
        padding={{ top: 120, bottom: 440 }}
        accessibilityLabel={`Rota çizim haritası: ${duraklar.length} nokta`}
      />
      <FloatingHeader
        left={<IconButton floating icon="close" label="Kapat" onPress={() => router.back()} />}
        middle={
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.inkMuted} strokeWidth={2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Yer, patika veya zirve ara"
              placeholderTextColor={colors.inkMuted}
              accessibilityLabel="Yer ara"
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
        }
        right={<IconButton floating icon="undo" label="Son noktayı geri al" onPress={() => setDuraklar((d) => d.slice(0, -1))} />}
      />

      {gorunenSonuclar.length ? (
        <View style={[styles.results, { top: insets.top + 64 }]}>
          {gorunenSonuclar.map((y) => (
            <Pressable key={y.id} accessibilityRole="button" onPress={() => yerSec(y)} style={styles.result}>
              <Icon name="pin" size={18} color={colors.terra} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                  {y.ad}
                </Txt>
                {y.ayrinti ? <Txt variant="small">{y.ayrinti}</Txt> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.modes, { bottom: 412 + insets.bottom }]} accessibilityRole="radiogroup">
        {CIZIM_MODLARI.map((m) => (
          <View key={m.id} style={styles.modeWrap}>
            <Chip label={m.label} role="radio" selected={m.id === mod} onPress={() => setMod(m.id)} />
          </View>
        ))}
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grip} />
        {!gercekHarita ? (
          <Txt variant="small" style={styles.note}>
            Haritaya dokunarak rota çizmek için uygulamanın telefon derlemesi gerekir (Expo Go ve web’de çizilemez).
          </Txt>
        ) : duraklar.length < 2 ? (
          <Txt variant="small" style={styles.note}>
            {duraklar.length === 0 ? 'Başlangıç noktası için haritaya dokun.' : 'Sonraki noktaya dokun; patika ya da yol otomatik bulunur.'}
          </Txt>
        ) : null}

        <TextInput value={ad} onChangeText={setAd} placeholder="Rota adı" placeholderTextColor={colors.inkMuted} accessibilityLabel="Rota adı" style={styles.nameInput} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 10 }} accessibilityRole="radiogroup">
          {ACTIVITY_TYPES.map((t) => (
            <Chip key={t} label={ACTIVITY_LABELS[t]} role="radio" selected={t === activity} onPress={() => setActivity(t)} />
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Stat label="Mesafe" value={stats ? `${formatKm(stats.distanceM)} km` : '–'} />
          <Stat label="Tırmanış" value={stats && rakimVar ? `↑ ${formatMeters(stats.gainM)} m` : '–'} />
          <Stat label="Tahmini süre" value={stats ? sureMetni(estimateDuration(activity, stats.distanceM, rakimVar ? stats.gainM : 0)) : '–'} />
        </View>

        {zeminler.length ? (
          <>
            <View style={styles.bar} accessible accessibilityLabel={zeminler.map((s) => `${s.label} yüzde ${s.pct}`).join(', ')}>
              {zeminler.map((s) => (
                <View key={s.label} style={{ flex: s.pct, backgroundColor: s.color }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              {zeminler.map((s) => (
                <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                  <Txt variant="small">
                    {s.label} %{s.pct}
                  </Txt>
                </View>
              ))}
              {zorluk ? <Txt variant="small">· {DIFFICULTY_LABELS[zorluk]}</Txt> : null}
            </View>
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }} accessibilityRole="radiogroup">
          {GORUNURLUK.map((g) => (
            <Chip key={g.id} label={g.label} role="radio" tone="sea" selected={g.id === gorunurluk} onPress={() => setGorunurluk(g.id)} />
          ))}
        </View>

        {gorunenHata ? (
          <Txt accessibilityRole="alert" style={{ color: colors.terra, fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginTop: 8 }}>
            {gorunenHata}
          </Txt>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' }}>
          {hesapliyor && yeterli ? <ActivityIndicator color={colors.terra} /> : null}
          <Button
            label={kaydediyor ? 'Kaydediliyor…' : 'Rotayı kaydet'}
            icon="route"
            onPress={onKaydet}
            disabled={!stats || (hesapliyor && yeterli) || kaydediyor}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, alignSelf: 'stretch', paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  results: { position: 'absolute', left: space.md, right: space.md, borderRadius: 16, backgroundColor: colors.surface, paddingVertical: 4, borderWidth: 1, borderColor: colors.line },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 6 },
  modes: { position: 'absolute', left: space.md, flexDirection: 'row', gap: 8 },
  modeWrap: { borderRadius: 18, backgroundColor: colors.surface },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: 10 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 10 },
  note: { marginBottom: 6 },
  nameInput: { fontFamily: fontFamily.display, fontSize: 22, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 6 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
});
