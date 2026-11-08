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
import { baslat, IzinHatasi, konumOnizlemeBaslat, useKayit } from '@/kayit/kaydedici';
import { colors, fontFamily, radius, space } from '@/theme';

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
  if (acc == null) return { text: 'GPS aranıyor…', color: colors.inkMuted };
  if (acc <= 15) return { text: `GPS hazır · ±${Math.round(acc)} m`, color: colors.sea };
  if (acc <= 30) return { text: `GPS zayıf · ±${Math.round(acc)} m`, color: '#B7862B' };
  return { text: 'GPS çok zayıf', color: colors.terra };
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
      await baslat(type, rota ? { id: rota.id, name: rota.name, points: rota.points } : null);
      router.replace('/kayit/canli');
    } catch (e) {
      setIzinHatasi(e instanceof IzinHatasi);
      setHata(e instanceof Error ? e.message : 'Kayıt başlatılamadı');
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
        padding={{ top: 110, bottom: 420 }}
        accessibilityLabel="Bulunduğun konumun haritası"
      />
      <FloatingHeader
        left={<IconButton floating icon="close" label="Kapat" onPress={() => router.back()} />}
        middle={
          <View style={styles.gps} accessibilityLiveRegion="polite">
            <View style={[styles.gpsDot, { backgroundColor: gps.color }]} />
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12 }}>{gps.text}</Txt>
          </View>
        }
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <Txt variant="heading" accessibilityRole="header" style={{ marginBottom: 12 }}>
          Ne yapıyorsun?
        </Txt>
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
            <Txt variant="small">Rota</Txt>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
              {rota ? `${rota.name} · ${formatKm(rota.distanceM)} km` : 'Rotasız kaydet'}
            </Txt>
          </View>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.seaInk }}>{secimAcik ? 'Kapat' : 'Değiştir'}</Txt>
        </Pressable>
        {secimAcik ? (
          <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 4 }}>
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: !rota }} onPress={() => { setRota(null); setSecimAcik(false); }} style={styles.secenek}>
              <Txt style={{ fontFamily: rota ? fontFamily.body : fontFamily.bodyBold, fontSize: 14 }}>Rotasız kaydet</Txt>
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
                  {r.name} · {formatKm(r.distanceM)} km
                </Txt>
              </Pressable>
            ))}
            {rotaListesi && rotaListesi.length === 0 ? <Txt variant="small">Henüz rotan yok. Profil &gt; Rotalarım’dan çizebilirsin.</Txt> : null}
          </ScrollView>
        ) : null}

        <Txt variant="small">Ekran kapalıyken de kaydetmesi için konum iznini “Her zaman” olarak ver.</Txt>

        {hata ? (
          <View style={styles.error} accessibilityRole="alert">
            <Txt style={{ color: colors.terra, fontFamily: fontFamily.bodySemiBold, fontSize: 13 }}>{hata}</Txt>
            {izinHatasi ? (
              <Pressable accessibilityRole="link" onPress={() => Linking.openSettings()}>
                <Txt style={{ color: colors.seaInk, fontFamily: fontFamily.bodyBold, fontSize: 13, marginTop: 4 }}>Ayarları aç</Txt>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Button label={basliyor ? 'Başlatılıyor…' : 'Başlat'} icon="play" big onPress={onBaslat} disabled={basliyor} style={{ marginTop: space.md }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  error: { padding: 12, borderRadius: 12, backgroundColor: '#F6E3D9' },
  rotaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.ground },
  secenek: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.ground },
});
