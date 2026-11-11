/**
 * Birlikte yapılan kişiler: liste, öneriler (aynı saatte aynı yoldan geçen tanıdıklar) ve kişi ekleme.
 * Aktivitenin sahibi ekler / kaldırır; etiketlenen kişi yalnızca kendini kaldırır.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  birlikteCikar,
  birlikteEkle,
  birlikteKisileri,
  birlikteOnerileri,
  kisiAra,
  sunucuAktivitesiMi,
  type BirlikteKisisi,
  type BirlikteOnerisi,
  type KisiOzeti,
} from '@/akis/akis';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Avatar, SectionHeader } from '@/components/ui';
import { useAktivite } from '@/data/aktivite';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';
import { $t } from '@/i18n';

export default function BirlikteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!supabaseHazir || !sunucuAktivitesiMi(id)) {
    return (
      <View style={styles.root}>
        <Header title={$t('aktivite_birlikte.birlikte')} />
        <Txt variant="muted" style={{ textAlign: 'center', padding: space.xl }}>
          {id?.startsWith('yerel-') ? $t('aktivite_birlikte.kayit_sunucuya_gonderilince_kisi') : $t('aktivite_birlikte.birlikte_yapilanlar_sunucuya_bagliyken')}
        </Txt>
      </View>
    );
  }
  return <Birlikte id={id} />;
}

function Birlikte({ id }: { id: string }) {
  const { a } = useAktivite(id);
  const sahip = !!a?.mine;
  const [kisiler, setKisiler] = useState<BirlikteKisisi[] | null>(null);
  const [oneriler, setOneriler] = useState<BirlikteOnerisi[]>([]);
  const [arama, setArama] = useState('');
  const [sonuc, setSonuc] = useState<KisiOzeti[] | null>(null);
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const istekNo = useRef(0);

  const yukle = useCallback(async () => {
    try {
      const [k, o] = await Promise.all([birlikteKisileri(id), sahip ? birlikteOnerileri(id).catch(() => []) : Promise.resolve([])]);
      setKisiler(k);
      setOneriler(o);
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi'));
      setKisiler((x) => x ?? []);
    }
  }, [id, sahip]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  // Sahibi için kişi arama; boş aramada tanıdık önerileri (seni takip edenler, grup arkadaşların)
  useEffect(() => {
    if (!sahip) return;
    const q = arama.trim();
    if (q.length === 1) return;
    const no = ++istekNo.current;
    const t = setTimeout(
      () => {
        kisiAra(q)
          .then((l) => no === istekNo.current && setSonuc(l))
          .catch(() => no === istekNo.current && setSonuc([]));
      },
      q ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [arama, sahip]);

  async function ekle(kisi: string) {
    setBekleyen(kisi);
    setHata(null);
    try {
      await birlikteEkle(id, [kisi]);
      await yukle();
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('aktivite_birlikte.eklenemedi'));
    } finally {
      setBekleyen(null);
    }
  }

  function cikar(k: BirlikteKisisi) {
    const yap = async () => {
      setBekleyen(k.user_id);
      setHata(null);
      try {
        await birlikteCikar(id, k.user_id);
        if (k.me && !sahip) {
          router.back();
          return;
        }
        await yukle();
      } catch (e) {
        setHata(e instanceof Error ? e.message : $t('aktivite_birlikte.kaldirilamadi'));
      } finally {
        setBekleyen(null);
      }
    };
    Alert.alert(k.me ? $t('aktivite_birlikte.kendini_bu_aktiviteden_kaldir') : $t('aktivite_birlikte.kaldirilsin_mi', { display_name: k.display_name }), k.me ? $t('aktivite_birlikte.aktivite_artik_senin_akisinda') : undefined, [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      { text: $t('aktivite_birlikte.kaldir'), style: 'destructive', onPress: () => void yap() },
    ]);
  }

  const etiketli = new Set((kisiler ?? []).map((k) => k.user_id));
  const tanidik = (k: KisiOzeti) => k.i_follow || k.follows_me || (k.common_groups ?? 0) > 0;
  const aramaListesi = (sonuc ?? []).filter((k) => !etiketli.has(k.id) && !oneriler.some((o) => o.user_id === k.id));

  return (
    <View style={styles.root}>
      <Header title={$t('aktivite_birlikte.birlikte')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {hata ? (
          <Txt accessibilityRole="alert" style={{ color: colors.terraInk, marginBottom: space.md }}>
            {hata}
          </Txt>
        ) : null}

        <SectionHeader title={$t('aktivite_birlikte.birlikte_yapanlar')} />
        {kisiler === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.md }} /> : null}
        {kisiler && kisiler.length === 0 ? (
          <Txt variant="muted" style={{ paddingVertical: space.sm }}>
            {sahip ? $t('aktivite_birlikte.henuz_kimseyi_eklemedin_asagidan') : $t('aktivite_birlikte.kimse_eklenmemis')}
          </Txt>
        ) : null}
        {kisiler?.map((k) => (
          <Satir
            key={k.user_id}
            id={k.user_id}
            ad={k.me ? $t('aktivite_birlikte.sen', { display_name: k.display_name }) : k.display_name}
            alt={`@${k.username}`}
            dugme={sahip || k.me ? { etiket: $t('aktivite_birlikte.kaldir'), ikincil: true, onPress: () => cikar(k) } : undefined}
            bekliyor={bekleyen === k.user_id}
          />
        ))}

        {sahip && oneriler.length ? (
          <View style={{ marginTop: space.lg }}>
            <SectionHeader title={$t('aktivite_birlikte.seninle_ayni_yoldaydi')} />
            <Txt variant="small" style={{ marginTop: -4, marginBottom: 4 }}>
              {$t('aktivite_birlikte.ayni_saatlerde_ayni_yoldan')}</Txt>
            {oneriler.map((o) => (
              <Satir
                key={o.user_id}
                id={o.user_id}
                ad={o.display_name}
                alt={o.title ? `“${o.title}”` : `@${o.username}`}
                dugme={{ etiket: $t('aktivite_birlikte.ekle'), onPress: () => void ekle(o.user_id) }}
                bekliyor={bekleyen === o.user_id}
              />
            ))}
          </View>
        ) : null}

        {sahip ? (
          <View style={{ marginTop: space.lg }}>
            <SectionHeader title={$t('aktivite_birlikte.kisi_ekle')} />
            <View style={styles.search}>
              <Icon name="search" size={18} color={colors.inkMuted} />
              <TextInput
                value={arama}
                onChangeText={setArama}
                placeholder={$t('aktivite_birlikte.ad_ya_da_kullanici')}
                placeholderTextColor={colors.inkMuted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={$t('aktivite_birlikte.eklenecek_kisiyi_ara')}
                style={styles.input}
              />
            </View>
            {sonuc === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.md }} /> : null}
            {sonuc && aramaListesi.length === 0 ? (
              <Txt variant="muted" style={{ paddingVertical: space.sm }}>
                {arama.trim().length >= 2 ? $t('aktivite_birlikte.bu_adla_eklenebilecek_kimse') : $t('aktivite_birlikte.takiplestigin_ve_grup_arkadasin')}
              </Txt>
            ) : null}
            {aramaListesi.map((k) => (
              <Satir
                key={k.id}
                id={k.id}
                ad={k.display_name}
                alt={tanidik(k) ? `@${k.username}` : $t('aktivite_birlikte.eklemek_icin_takiplesmeniz_ya', { username: k.username })}
                dugme={tanidik(k) ? { etiket: $t('aktivite_birlikte.ekle'), onPress: () => void ekle(k.id) } : undefined}
                bekliyor={bekleyen === k.id}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Satir({
  id,
  ad,
  alt,
  dugme,
  bekliyor,
}: {
  id: string;
  ad: string;
  alt: string;
  dugme?: { etiket: string; onPress: () => void; ikincil?: boolean };
  bekliyor?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={$t('aktivite_birlikte.profili', { ad })}
        onPress={() => router.push({ pathname: '/kisi/[id]', params: { id } })}
        style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar initials={basHarfler(ad)} tone={grupRengi(id)} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
            {ad}
          </Txt>
          <Txt variant="small" numberOfLines={2}>
            {alt}
          </Txt>
        </View>
      </Pressable>
      {dugme ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${ad}: ${dugme.etiket}`}
          onPress={dugme.onPress}
          disabled={bekliyor}
          style={[styles.btn, dugme.ikincil ? styles.btnIkincil : styles.btnAna]}>
          {bekliyor ? (
            <ActivityIndicator size="small" color={dugme.ikincil ? colors.ink : '#FFFFFF'} />
          ) : (
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13, color: dugme.ikincil ? colors.ink : '#FFFFFF' }}>{dugme.etiket}</Txt>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10 },
  btn: { height: 36, minWidth: 80, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  btnAna: { backgroundColor: colors.terra, borderColor: colors.terra },
  btnIkincil: { backgroundColor: 'transparent', borderColor: colors.lineStrong },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 23,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.sm,
  },
  input: { flex: 1, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
});
