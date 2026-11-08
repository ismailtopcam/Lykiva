import { ACTIVITY_LABELS, ACTIVITY_TYPES, formatKm, type ActivityType } from '@lykiva/shared';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { baslat, IzinHatasi, konumOnizlemeBaslat, useKayit } from '@/kayit/kaydedici';
import { rotaSec, useSeciliRota } from '@/rota/secim';
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
  const rota = useSeciliRota();

  useEffect(() => konumOnizlemeBaslat(), []);

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
      await baslat(type, rota);
      rotaSec(null);
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
        plan={rota?.noktalar}
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

        <View style={styles.rota}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rota ? `Takip edilecek rota: ${rota.ad}. Değiştir` : 'Takip edilecek rota seç (isteğe bağlı)'}
            onPress={() => router.push('/rota/sec')}
            style={({ pressed }) => [styles.rotaSatir, pressed && { opacity: 0.8 }]}>
            <Icon name="route" size={22} color={rota ? colors.seaInk : colors.ink} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="small">{rota ? 'Takip edilecek rota' : 'Rota (isteğe bağlı)'}</Txt>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                {rota ? `${rota.ad} · ${formatKm(rota.toplamM)} km` : 'Rota seç ya da çiz'}
              </Txt>
            </View>
            {rota ? null : <Icon name="chevron" size={20} color={colors.inkMuted} strokeWidth={2} />}
          </Pressable>
          {rota ? <IconButton icon="close" label="Rotayı kaldır" onPress={() => rotaSec(null)} /> : null}
        </View>

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
  rota: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.ground, paddingRight: 4 },
  rotaSatir: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 14, minHeight: 56 },
});
