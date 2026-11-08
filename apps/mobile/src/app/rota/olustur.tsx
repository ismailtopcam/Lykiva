import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  donguMu,
  formatDuration,
  formatKm,
  toblerSuresi,
  yukseklikOzeti,
  zeminOranlari,
  type ActivityType,
  type ZeminDagilimi,
} from '@lykiva/shared';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { haritaEtkilesimli, TopoMap, type MapMarker } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button, Chip, Stat } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { rotaKaydet } from '@/rota/rotalar';
import { duzBacak, profil, yolBul, type Bacak, type CizimModu, type RotaKoordinati } from '@/rota/yonlendirme';
import { colors, fontFamily, radius, space } from '@/theme';

const modlar: { mod: CizimModu; ad: string }[] = [
  { mod: 'patika', ad: 'Patikaya yapış' },
  { mod: 'yol', ad: 'Yola yapış' },
  { mod: 'serbest', ad: 'Serbest çiz' },
];

const zeminRenk = { asfalt: colors.ink, toprak: colors.ochre, patika: colors.sea } as const;
const zeminAd = { asfalt: 'Asfalt', toprak: 'Toprak yol', patika: 'Patika' } as const;

const ayakla = (a: ActivityType) => a === 'walk' || a === 'hike' || a === 'run' || a === 'trail_run';

/** Bacakları tek koordinat dizisine birleştirir (ara noktalar tekrar etmez) */
function birlestir(bacaklar: Bacak[]): RotaKoordinati[] {
  const out: RotaKoordinati[] = [];
  bacaklar.forEach((b, i) => out.push(...(i === 0 ? b.koordinatlar : b.koordinatlar.slice(1))));
  return out;
}

export default function RotaOlusturScreen() {
  const insets = useSafeAreaInsets();
  const [mod, setMod] = useState<CizimModu>('patika');
  const [activity, setActivity] = useState<ActivityType>('hike');
  const [ad, setAd] = useState('');
  const [noktalar, setNoktalar] = useState<LngLat[]>([]);
  const [bacaklar, setBacaklar] = useState<Bacak[]>([]);
  const [hesapliyor, setHesapliyor] = useState(false);
  const [uyari, setUyari] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [baslangic, setBaslangic] = useState<LngLat | null | undefined>(undefined);
  const mesgul = useRef(false);

  // Harita ilk açılışta bulunduğun yere odaklansın (en fazla birkaç saniye beklenir)
  useEffect(() => {
    let acik = true;
    const zaman = setTimeout(() => acik && setBaslangic((b) => (b === undefined ? null : b)), 4000);
    (async () => {
      const izin = await Location.requestForegroundPermissionsAsync();
      if (!izin.granted) return setBaslangic(null);
      const son = await Location.getLastKnownPositionAsync().catch(() => null);
      const k = son ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null));
      if (acik) setBaslangic(k ? [k.coords.longitude, k.coords.latitude] : null);
    })().catch(() => acik && setBaslangic(null));
    return () => {
      acik = false;
      clearTimeout(zaman);
    };
  }, []);

  const koordinatlar = useMemo(() => birlestir(bacaklar), [bacaklar]);
  const ozet = useMemo(() => {
    const mesafeM = bacaklar.reduce((t, b) => t + b.mesafeM, 0);
    const yuk = yukseklikOzeti(koordinatlar.map((c) => c[2]));
    const yukseklikVar = koordinatlar.some((c) => c[2] != null);
    const noktalarR = koordinatlar.map((c) => ({ lng: c[0], lat: c[1], ele: c[2] }));
    const zemin = bacaklar.reduce<ZeminDagilimi>(
      (t, b) => ({ asfalt: t.asfalt + b.zemin.asfalt, toprak: t.toprak + b.zemin.toprak, patika: t.patika + b.zemin.patika }),
      { asfalt: 0, toprak: 0, patika: 0 },
    );
    const bisikletSuresi = bacaklar.length && bacaklar.every((b) => b.sureS != null) ? bacaklar.reduce((t, b) => t + (b.sureS ?? 0), 0) : null;
    return {
      mesafeM,
      tirmanisM: yukseklikVar ? yuk.gainM : null,
      inisM: yukseklikVar ? yuk.lossM : null,
      sureS: ayakla(activity) ? toblerSuresi(noktalarR) : bisikletSuresi,
      oranlar: zeminOranlari(zemin),
      dongu: donguMu(noktalarR),
    };
  }, [bacaklar, koordinatlar, activity]);

  async function noktaEkle(c: LngLat) {
    if (mesgul.current || kaydediyor) return;
    setUyari(null);
    const onceki = noktalar[noktalar.length - 1];
    if (!onceki) {
      setNoktalar([c]);
      return;
    }
    mesgul.current = true;
    setHesapliyor(true);
    try {
      let bacak: Bacak;
      if (mod === 'serbest') {
        bacak = duzBacak(onceki, c);
      } else {
        try {
          bacak = await yolBul(onceki, c, profil(activity, mod));
        } catch (e) {
          bacak = duzBacak(onceki, c);
          setUyari(`${e instanceof Error ? e.message : 'Yol bulunamadı'}. Bu parça düz çizgi olarak eklendi.`);
        }
      }
      setNoktalar((n) => [...n, c]);
      setBacaklar((b) => [...b, bacak]);
    } finally {
      mesgul.current = false;
      setHesapliyor(false);
    }
  }

  function geriAl() {
    if (mesgul.current) return;
    setUyari(null);
    setNoktalar((n) => n.slice(0, -1));
    setBacaklar((b) => b.slice(0, Math.max(0, noktalar.length - 2)));
  }

  async function kaydet() {
    if (koordinatlar.length < 2) return;
    if (!ad.trim()) {
      setUyari('Rotaya bir ad ver.');
      return;
    }
    setKaydediyor(true);
    setUyari(null);
    try {
      const id = await rotaKaydet({
        name: ad.trim(),
        activity,
        points: koordinatlar,
        distance_m: ozet.mesafeM,
        elevation_gain_m: ozet.tirmanisM,
        elevation_loss_m: ozet.inisM,
        is_loop: ozet.dongu,
        surface: ozet.oranlar,
      });
      router.replace({ pathname: '/rota/[id]', params: { id } });
    } catch (e) {
      setUyari(`Kaydedilemedi: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setKaydediyor(false);
    }
  }

  const markers: MapMarker[] = [
    ...(baslangic ? [{ id: 'me', coord: baslangic, kind: 'me' as const }] : []),
    ...noktalar.map((c, i) => ({
      id: 'n' + i,
      coord: c,
      kind: i === 0 ? ('start' as const) : i === noktalar.length - 1 ? ('end' as const) : ('stop' as const),
      text: i > 0 && i < noktalar.length - 1 ? String(i) : undefined,
    })),
  ];
  const etkilesimli = haritaEtkilesimli();

  return (
    <View style={styles.root}>
      {baslangic === undefined ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator color={colors.terra} />
        </View>
      ) : (
        <TopoMap
          style={StyleSheet.absoluteFill}
          route={koordinatlar.map((c) => [c[0], c[1]] as LngLat)}
          markers={markers}
          onPress={(c) => void noktaEkle(c)}
          padding={{ top: 120, bottom: 440 }}
          accessibilityLabel={`Rota çizim haritası: ${noktalar.length} nokta`}
        />
      )}
      <FloatingHeader
        left={<IconButton floating icon="close" label="Kapat" onPress={() => router.back()} />}
        middle={
          <View style={styles.ipucu}>
            {hesapliyor ? <ActivityIndicator size="small" color={colors.terra} /> : null}
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12 }} numberOfLines={1}>
              {!etkilesimli
                ? 'Çizim için geliştirme derlemesi gerekir'
                : hesapliyor
                  ? 'Yol hesaplanıyor…'
                  : noktalar.length === 0
                    ? 'Başlangıç için haritaya dokun'
                    : 'Sonraki nokta için dokun'}
            </Txt>
          </View>
        }
        right={<IconButton floating icon="undo" label="Son noktayı geri al" onPress={geriAl} />}
      />

      <View style={[styles.modes, { bottom: 412 + insets.bottom }]} accessibilityRole="radiogroup">
        {modlar.map((m) => (
          <View key={m.mod} style={styles.modeWrap}>
            <Chip label={m.ad} role="radio" selected={m.mod === mod} onPress={() => setMod(m.mod)} />
          </View>
        ))}
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grip} />
        <TextInput
          value={ad}
          onChangeText={setAd}
          placeholder="Rota adı"
          placeholderTextColor={colors.inkMuted}
          accessibilityLabel="Rota adı"
          maxLength={120}
          style={styles.nameInput}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 10 }} accessibilityRole="radiogroup">
          {ACTIVITY_TYPES.map((t) => (
            <Chip key={t} label={ACTIVITY_LABELS[t]} role="radio" selected={t === activity} onPress={() => setActivity(t)} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Stat label="Mesafe" value={`${formatKm(ozet.mesafeM)} km`} />
          <Stat label="Tırmanış" value={ozet.tirmanisM != null ? `↑ ${Math.round(ozet.tirmanisM)} m` : '–'} />
          <Stat label={ayakla(activity) ? 'Tahmini (yürüyüş)' : 'Tahmini süre'} value={ozet.sureS ? formatDuration(ozet.sureS) : '–'} />
        </View>

        {ozet.oranlar ? (
          <>
            <View
              style={styles.bar}
              accessible
              accessibilityLabel={(Object.keys(zeminAd) as (keyof typeof zeminAd)[]).map((k) => `${zeminAd[k]} yüzde ${Math.round(ozet.oranlar![k] * 100)}`).join(', ')}>
              {(Object.keys(zeminAd) as (keyof typeof zeminAd)[]).map((k) =>
                ozet.oranlar![k] > 0 ? <View key={k} style={{ flex: ozet.oranlar![k], backgroundColor: zeminRenk[k] }} /> : null,
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {(Object.keys(zeminAd) as (keyof typeof zeminAd)[]).map((k) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: zeminRenk[k] }} />
                  <Txt variant="small">
                    {zeminAd[k]} %{Math.round(ozet.oranlar![k] * 100)}
                  </Txt>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Txt variant="small" style={{ marginBottom: 12 }}>
            {mod === 'serbest' ? 'Serbest çizimde zemin ve yükseklik bilgisi yok.' : 'Zemin bilgisi yol bulununca görünür (OpenStreetMap).'}
          </Txt>
        )}

        {uyari ? (
          <View style={styles.uyari} accessibilityLiveRegion="polite">
            <Txt style={{ fontSize: 13, color: colors.terraInk }}>{uyari}</Txt>
          </View>
        ) : null}

        <Button
          label={kaydediyor ? 'Kaydediliyor…' : 'Rotayı kaydet'}
          icon="bookmark"
          onPress={() => void kaydet()}
          disabled={koordinatlar.length < 2 || kaydediyor || hesapliyor}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  center: { alignItems: 'center', justifyContent: 'center' },
  ipucu: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.surface, maxWidth: '100%' },
  modes: { position: 'absolute', left: space.md, flexDirection: 'row', gap: 8 },
  modeWrap: { borderRadius: 18, backgroundColor: colors.surface },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: 10 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 12 },
  nameInput: { fontFamily: fontFamily.display, fontSize: 22, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 6 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  uyari: { backgroundColor: colors.terraSoft, borderRadius: radius.md, padding: space.md, marginBottom: 10 },
});
