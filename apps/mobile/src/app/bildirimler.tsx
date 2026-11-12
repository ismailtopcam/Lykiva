/**
 * Bildirimler: takip, beğeni, yorum, gruba katılma isteği / kabulü, grupta yeni etkinlik.
 * Ekran açılınca hepsi okundu sayılır (rozet sıfırlanır); okunmamışlar bu açılışta vurgulu kalır.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { akisZamani } from '@/akis/akis';
import { bildirimHedefi, bildirimlerim, okunduSay, SAYFA, sayiyiBildir, type Bildirim } from '@/bildirim/bildirimler';
import { pushAc, pushDurumu, type PushDurumu } from '@/lib/push';
import { Header } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { TakipDugmesi } from '@/components/KisiSatiri';
import { Txt } from '@/components/Txt';
import { Avatar } from '@/components/ui';
import { kisaTarih } from '@/etkinlik/etkinlikler';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export default function BildirimlerScreen() {
  if (!supabaseHazir) {
    return (
      <View style={styles.root}>
        <Header title={$t('ortak.bildirimler')} />
        <Txt variant="muted" style={{ textAlign: 'center', padding: space.xl }}>
          {$t('bildirimler.bildirimler_sunucuya_bagliyken_calisir')}</Txt>
      </View>
    );
  }
  return <Bildirimler />;
}

const tirnak = (s: string | null | undefined) => (s ? `“${s}”` : '');

/** Satırın metni: [kalın ad, devamı] */
function metin(b: Bildirim): [string | null, string] {
  const ad = b.aktor_adi ?? $t('bildirimler.biri');
  switch (b.tur) {
    case 'takip':
      return [ad, $t('bildirimler.seni_takip_etmeye_basladi')];
    case 'begeni':
      return [ad, b.aktivite_adi ? $t('bildirimler.aktiviteni_begendi_2', { tirnak: tirnak(b.aktivite_adi) }) : $t('bildirimler.aktiviteni_begendi')];
    case 'yorum':
      return [ad, $t('bildirimler.yorum_yapti', { a: b.aktivite_adi ? $t('bildirimler.aktivitene_2', { tirnak: tirnak(b.aktivite_adi) }) : $t('bildirimler.aktivitene'), a2: b.yorum ? `: ${tirnak(b.yorum)}` : '' })];
    case 'katilim_istegi':
      return [ad, $t('bildirimler.grubuna_katilmak_istiyor', { tirnak: tirnak(b.grup_adi) })];
    case 'katilim_kabul':
      return [null, $t('bildirimler.grubuna_katilma_istegin_kabul', { tirnak: tirnak(b.grup_adi) })];
    case 'birlikte':
      return [ad, b.aktivite_adi ? $t('bildirimler.seni_aktivitesine_birlikte_yapanlar', { tirnak: tirnak(b.aktivite_adi) }) : $t('bildirimler.seni_bir_aktivitesine_birlikte')];
    case 'etkinlik':
      return [ad, $t('bildirimler.grubunda_etkinlik_olusturdu', { tirnak: tirnak(b.grup_adi), tirnak2: tirnak(b.etkinlik_adi), a: b.etkinlik_zamani ? ` · ${kisaTarih(b.etkinlik_zamani)}` : '' })];
  }
}

const SIMGE: Record<Bildirim['tur'], IconName> = {
  takip: 'user',
  begeni: 'heart',
  yorum: 'chat',
  katilim_istegi: 'users',
  katilim_kabul: 'users',
  etkinlik: 'calendar',
  birlikte: 'users',
};

const hedef = (b: Bildirim) => bildirimHedefi(b);

/** Telefona bildirim izni henüz sorulmadıysa küçük bir öneri kartı */
function PushOnerisi() {
  const [durum, setDurum] = useState<PushDurumu | null>(null);
  useEffect(() => {
    let acik = true;
    pushDurumu()
      .then((d) => acik && setDurum(d))
      .catch(() => undefined);
    return () => {
      acik = false;
    };
  }, []);
  if (durum !== 'sorulmadi') return null;
  return (
    <View style={styles.oneri}>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>{$t('bildirimler.telefonuna_da_gelsin_mi')}</Txt>
        <Txt variant="small">{$t('bildirimler.uygulama_kapaliyken_de_yorum')}</Txt>
      </View>
      <Pressable accessibilityRole="button" onPress={() => void pushAc().then(setDurum).catch(() => undefined)} style={styles.oneriBtn}>
        <Txt style={{ color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{$t('bildirimler.ac')}</Txt>
      </Pressable>
    </View>
  );
}

function Bildirimler() {
  const [liste, setListe] = useState<Bildirim[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bitti, setBitti] = useState(false);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [devamYukleniyor, setDevamYukleniyor] = useState(false);

  const yukle = useCallback(async () => {
    try {
      const l = await bildirimlerim();
      setHata(null);
      setListe(l);
      setBitti(l.length < SAYFA);
      // Görülenleri okundu say; rozet hemen sıfırlansın
      if (l.some((b) => !b.okundu)) {
        sayiyiBildir(0);
        await okunduSay(l[0].created_at).catch(() => undefined);
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('bildirimler.bildirimler_yuklenemedi'));
      setListe((x) => x ?? []);
    }
  }, []);

  // Açılışta ve ekrana her dönüşte (ör. bir profilden geri gelince) yenile
  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  async function yenile() {
    setYenileniyor(true);
    await yukle();
    setYenileniyor(false);
  }

  async function devami() {
    if (!liste?.length || bitti || devamYukleniyor) return;
    setDevamYukleniyor(true);
    try {
      const l = await bildirimlerim(liste[liste.length - 1].created_at);
      setListe((x) => [...(x ?? []), ...l.filter((b) => !x?.some((y) => y.id === b.id))]);
      setBitti(l.length < SAYFA);
    } catch {
      // Sonraki kaydırmada yeniden denenir
    } finally {
      setDevamYukleniyor(false);
    }
  }

  return (
    <View style={styles.root}>
      <Header title={$t('ortak.bildirimler')} />
      <FlatList
        data={liste ?? []}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingBottom: 60, flexGrow: 1 }}
        ListHeaderComponent={<PushOnerisi />}
        onEndReachedThreshold={0.5}
        onEndReached={() => void devami()}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={() => void yenile()} tintColor={colors.terra} />}
        ListEmptyComponent={
          liste === null ? (
            <ActivityIndicator color={colors.terra} style={{ marginTop: space.xl }} />
          ) : hata ? (
            <Txt accessibilityRole="alert" style={{ color: colors.terraInk, textAlign: 'center', padding: space.xl }}>
              {hata}
            </Txt>
          ) : (
            <Txt variant="muted" style={{ textAlign: 'center', padding: space.xl }}>
              {$t('bildirimler.henuz_bildirim_yok_biri')}</Txt>
          )
        }
        ListFooterComponent={devamYukleniyor ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} /> : undefined}
        renderItem={({ item: b }) => <Satir b={b} />}
      />
    </View>
  );
}

function Satir({ b }: { b: Bildirim }) {
  const [ad, devam] = metin(b);
  const git = hedef(b);
  const tamMetin = `${ad ?? ''}${devam}`;
  return (
    <Pressable
      accessibilityRole={git ? 'link' : undefined}
      accessibilityLabel={`${b.okundu ? '' : $t('bildirimler.yeni')}${tamMetin}, ${akisZamani(b.created_at)}`}
      onPress={git ? () => router.push(git) : undefined}
      style={({ pressed }) => [styles.row, !b.okundu && styles.yeni, pressed && { opacity: 0.7 }]}>
      <View>
        {b.aktor && b.aktor_adi ? (
          <Avatar initials={basHarfler(b.aktor_adi)} tone={grupRengi(b.aktor)} size={44} />
        ) : (
          <Avatar initials={basHarfler(b.grup_adi ?? '?')} tone={grupRengi(b.group_id ?? b.id)} size={44} square />
        )}
        <View style={styles.simge}>
          <Icon name={SIMGE[b.tur]} size={12} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={styles.metin} numberOfLines={3}>
          {ad ? <Txt style={[styles.metin, { fontFamily: fontFamily.bodyBold }]}>{ad}</Txt> : null}
          {devam}
        </Txt>
        <Txt variant="small" style={{ marginTop: 2 }}>
          {akisZamani(b.created_at)}
        </Txt>
      </View>
      {b.tur === 'takip' && b.aktor ? <TakipDugmesi kisi={b.aktor} takipte={!!b.takip_ediyorum} geriTakip /> : null}
      {!b.okundu ? <View style={styles.nokta} accessibilityElementsHidden importantForAccessibility="no" /> : null}
    </Pressable>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  yeni: { backgroundColor: colors.surface },
  metin: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  simge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.terra,
    borderWidth: 2,
    borderColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.terra },
  oneri: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: space.md, padding: 14, borderRadius: 16, backgroundColor: colors.seaSoft },
  oneriBtn: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.sea, alignItems: 'center', justifyContent: 'center' },
}));
