/**
 * Egzersiz başlat ekranı. Olağan yol artık Harita sekmesindeki "Egzersiz yap" (aynı panel: `EgzersizPaneli`);
 * bu ekran rota sayfasındaki "Bu rotayı başlat" ile ve süren kayda dönüş bağlantılarıyla açılır.
 */
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EgzersizPaneli, GpsRozeti } from '@/components/EgzersizPaneli';
import { FloatingHeader } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { rotaGetir, type Rota } from '@/data/rota';
import { konumOnizlemeBaslat, useKayit } from '@/kayit/kaydedici';
import { egzersizTuruSec } from '@/lib/egzersizTuru';
import { colors, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export default function KayitBaslatScreen() {
  const insets = useSafeAreaInsets();
  const kayit = useKayit();
  const params = useLocalSearchParams<{ rota?: string }>();
  const [rota, setRota] = useState<Rota | null>(null);

  useEffect(() => konumOnizlemeBaslat(), []);

  // Rota sayfasından "Bu rotayı başlat" ile gelindiyse rotayı yükle
  useEffect(() => {
    if (!params.rota) return;
    let iptal = false;
    rotaGetir(params.rota)
      .then((r) => {
        if (iptal) return;
        setRota(r);
        egzersizTuruSec(r.activity);
      })
      .catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, [params.rota]);

  if (kayit.durum === 'kayitta') return <Redirect href="/kayit/canli" />;
  if (kayit.durum === 'duraklatildi') return <Redirect href="/kayit/duraklatildi" />;

  const sk = kayit.sonKonum;
  const ben = sk ? ([sk.lng, sk.lat] as [number, number]) : null;

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
        middle={<GpsRozeti acc={sk?.acc} />}
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <EgzersizPaneli rota={rota} onRota={setRota} kayitDurumu={kayit.durum} onBasladi={() => router.replace('/kayit/canli')} />
      </View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
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
  },
}));
