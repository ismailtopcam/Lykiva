import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  aktiviteDegisikliginiDinle,
  akisGetir,
  begen,
  kisiAra,
  SAYFA,
  simdikiKonum,
  type AkisFiltresi,
  type AkisOgesi,
  type KisiOzeti,
} from '@/akis/akis';
import { AkisKarti } from '@/components/AkisKarti';
import { IconButton } from '@/components/IconButton';
import { KisiSatiri } from '@/components/KisiSatiri';
import { Logo } from '@/components/Logo';
import { OrnekAkis } from '@/components/OrnekAkis';
import { Txt } from '@/components/Txt';
import { ZilDugmesi } from '@/components/ZilDugmesi';
import { Button, Card, Chip } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';
import { $t } from '@/i18n';

/** Sunucu anahtarı yoksa tasarım örneği, varsa gerçek akış */
export default function AkisScreen() {
  return supabaseHazir ? <GercekAkis /> : <OrnekAkis />;
}

const FILTRELER = (): { k: AkisFiltresi; ad: string }[] => [
  { k: 'takip', ad: $t('anasayfa.takip_ettiklerim') },
  { k: 'gruplar', ad: $t('ortak.gruplarim') },
  { k: 'yakin', ad: $t('anasayfa.yakinimda') },
];

/** Sekmeye dönünce bu süreden eskiyse ilk sayfa sessizce yenilenir */
const TAZELIK_MS = 30_000;

function GercekAkis() {
  const [filtre, setFiltre] = useState<AkisFiltresi>('takip');
  const [liste, setListe] = useState<AkisOgesi[] | null>(null);
  const [bitti, setBitti] = useState(false);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [devamYukleniyor, setDevamYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [konumYok, setKonumYok] = useState(false);
  const [oneriler, setOneriler] = useState<KisiOzeti[] | null>(null);
  const konum = useRef<LngLat | null>(null);
  const sonYukleme = useRef(0);
  // Eski bir isteğin cevabı yeni süzgecin listesini ezmesin
  const istekNo = useRef(0);

  const ilkSayfa = useCallback(async (f: AkisFiltresi, sessiz = false) => {
    const no = ++istekNo.current;
    if (!sessiz) setListe(null);
    setHata(null);
    setKonumYok(false);
    try {
      let k: LngLat | null = null;
      if (f === 'yakin') {
        k = konum.current ?? (await simdikiKonum().catch(() => null));
        if (!k) {
          if (no === istekNo.current) {
            setKonumYok(true);
            setListe([]);
          }
          return;
        }
        konum.current = k;
      }
      const l = await akisGetir(f, null, k);
      if (no !== istekNo.current) return;
      setListe(l);
      setBitti(l.length < SAYFA);
      sonYukleme.current = Date.now();
      // Takip akışı boşsa kimi takip edebileceğini öner
      if (f === 'takip' && l.every((o) => o.mine)) setOneriler(await kisiAra().catch(() => []));
    } catch (e) {
      if (no !== istekNo.current) return;
      setHata(e instanceof Error ? e.message : $t('anasayfa.akis_yuklenemedi'));
      setListe((x) => x ?? []);
    }
  }, []);

  // İlk açılışta yükle; sekmeye dönünce veri eskiyse ilk sayfayı sessizce yenile
  useFocusEffect(
    useCallback(() => {
      if (istekNo.current === 0) void ilkSayfa(filtre);
      else if (sonYukleme.current && Date.now() - sonYukleme.current > TAZELIK_MS) void ilkSayfa(filtre, true);
    }, [filtre, ilkSayfa]),
  );

  // Yorum / beğeni başka ekranda (yorumlar, aktivite detayı) değişince kartı güncelle
  useEffect(
    () =>
      aktiviteDegisikliginiDinle((id, d) => {
        const { silindi, ...degisen } = d;
        setListe((x) => {
          if (!x?.some((o) => o.id === id)) return x;
          return silindi ? x.filter((o) => o.id !== id) : x.map((o) => (o.id === id ? { ...o, ...degisen } : o));
        });
      }),
    [],
  );

  function filtreSec(f: AkisFiltresi) {
    if (f === filtre) return;
    setFiltre(f);
    void ilkSayfa(f);
  }

  async function yenile() {
    setYenileniyor(true);
    if (filtre === 'yakin') konum.current = null;
    await ilkSayfa(filtre, true);
    setYenileniyor(false);
  }

  async function devami() {
    if (!liste?.length || bitti || devamYukleniyor) return;
    const no = istekNo.current;
    setDevamYukleniyor(true);
    try {
      const l = await akisGetir(filtre, liste[liste.length - 1], konum.current);
      if (no !== istekNo.current) return;
      setListe((x) => [...(x ?? []), ...l.filter((o) => !x?.some((y) => y.id === o.id))]);
      setBitti(l.length < SAYFA);
    } catch {
      // Sonraki kaydırmada yeniden denenir
    } finally {
      setDevamYukleniyor(false);
    }
  }

  const begeniDegistir = useCallback(async (o: AkisOgesi) => {
    const yeni = !o.liked;
    const guncelle = (liked: boolean) =>
      setListe((x) => x?.map((y) => (y.id === o.id ? { ...y, liked, like_count: Math.max(0, y.like_count + (liked ? 1 : -1)) } : y)) ?? x);
    guncelle(yeni);
    try {
      await begen(o.id, yeni);
    } catch {
      guncelle(!yeni);
    }
  }, []);

  const bos = liste !== null && liste.length === 0;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <Logo />
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="search" label={$t('ortak.kisi_ara')} onPress={() => router.push('/kisiler')} />
          <IconButton icon="chat" label={$t('anasayfa.grup_sohbetleri')} onPress={() => router.push('/gruplar')} />
          <ZilDugmesi />
        </View>
      </View>

      <FlatList
        data={liste ?? []}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <AkisKarti o={item} onBegen={begeniDegistir} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        initialNumToRender={3}
        windowSize={5}
        onEndReachedThreshold={0.6}
        onEndReached={() => void devami()}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={() => void yenile()} tintColor={colors.terra} />}
        ListHeaderComponent={
          <>
            <View accessibilityRole="tablist" style={styles.filters}>
              {FILTRELER().map((f) => (
                <Chip key={f.k} label={f.ad} role="tab" selected={f.k === filtre} onPress={() => filtreSec(f.k)} />
              ))}
            </View>
            {hata ? (
              <Txt accessibilityRole="alert" style={styles.hata}>
                {hata}
              </Txt>
            ) : null}
            {liste === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.xl }} /> : null}
            {filtre === 'takip' && liste && liste.every((o) => o.mine) && oneriler ? (
              <Oneriler kisiler={oneriler} onTakip={() => void ilkSayfa('takip', true)} />
            ) : null}
            {bos && !hata ? <BosAkis filtre={filtre} konumYok={konumYok} onTekrar={() => void ilkSayfa(filtre)} /> : null}
          </>
        }
        ListFooterComponent={devamYukleniyor ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} /> : undefined}
      />
    </SafeAreaView>
  );
}

function Oneriler({ kisiler, onTakip }: { kisiler: KisiOzeti[]; onTakip: () => void }) {
  return (
    <Card style={styles.oneri}>
      <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 16 }}>{$t('anasayfa.kimleri_takip_etmek_istersin')}</Txt>
      <Txt variant="small" style={{ marginTop: 2, marginBottom: space.sm }}>
        {$t('anasayfa.takip_ettiklerinin_aktiviteleri_burada', { a: kisiler.length ? $t('anasayfa.seni_takip_edenler_ve') : '' })}</Txt>
      {kisiler.slice(0, 5).map((k) => (
        <KisiSatiri key={k.id} k={k} onDegisti={(t) => t && onTakip()} />
      ))}
      <Button label={$t('ortak.kisi_ara')} icon="search" variant="outline" href="/kisiler" style={{ marginTop: space.sm }} />
    </Card>
  );
}

function BosAkis({ filtre, konumYok, onTekrar }: { filtre: AkisFiltresi; konumYok: boolean; onTekrar: () => void }) {
  if (filtre === 'takip') return null; // Öneriler kartı gösteriliyor
  const [metin, dugme] =
    filtre === 'gruplar'
      ? [$t('anasayfa.grup_arkadaslarinin_paylastigi_aktivitel'), <Button key="g" label={$t('anasayfa.gruplara_git')} variant="outline" href="/gruplar" />]
      : konumYok
        ? [$t('anasayfa.yakinindaki_aktiviteleri_gormek_icin'), <Button key="k" label={$t('anasayfa.tekrar_dene')} variant="outline" onPress={onTekrar} />]
        : [$t('anasayfa.m_25_km_icinde_herkese'), null];
  return (
    <View style={styles.bos}>
      <Txt variant="muted" style={{ textAlign: 'center', marginBottom: space.md }}>
        {metin}
      </Txt>
      {dugme}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.lg, paddingRight: space.sm, paddingBottom: space.sm },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingTop: 4, paddingBottom: space.md },
  hata: { color: colors.terraInk, paddingHorizontal: space.lg, marginBottom: space.md },
  oneri: { marginHorizontal: space.md, marginBottom: space.md, padding: space.lg },
  bos: { paddingHorizontal: space.xl, paddingVertical: space.xl },
});
