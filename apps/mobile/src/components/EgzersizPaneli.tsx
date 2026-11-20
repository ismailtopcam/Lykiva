/**
 * Egzersiz başlatma paneli (Harita sekmesinin "Egzersiz yap" kısmı). İki parça, çünkü Harita'nın sürüklenen
 * panelinde ayrı kademeler (bkz. panelKademesi.ts):
 * - `EgzersizSeridi`: "Hangi egzersiz?" ve tür şeridi (panel aşağı çekilince en azından bu görünür)
 * - `EgzersizAyrinti`: rota ve canlı konum seçimi, Başlat
 * Haritayı çağıran ekran çizer; seçilen rotayı da o tutar (haritada göstermek için).
 */
import { ACTIVITY_LABELS, ACTIVITY_TYPES, formatKm } from '@lykiva/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { rotalarim, type Rota } from '@/data/rota';
import { gruplarim, type GrupOzeti } from '@/grup/gruplar';
import { baglantiAc, baglantiyiPaylas, type PaylasimGrubu } from '@/kayit/canliPaylasim';
import { baslat, IzinHatasi, kayitEkrani, type KayitDurumu } from '@/kayit/kaydedici';
import { egzersizBaslatildi, egzersizTuruSec, TUR_IKONLARI, useEgzersizTuru } from '@/lib/egzersizTuru';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

/** Şeritteki bir türün kapladığı genişlik (daire + aradaki boşluk) */
const TUR_ADIMI = 80;

/** GPS doğruluğuna göre durum etiketi */
function gpsEtiketi(acc: number | null | undefined): { text: string; color: string } {
  if (acc == null) return { text: $t('kayit.gps_araniyor'), color: colors.inkMuted };
  if (acc <= 15) return { text: $t('kayit.gps_hazir_m', { round: Math.round(acc) }), color: colors.sea };
  if (acc <= 30) return { text: $t('kayit.gps_zayif_m', { round: Math.round(acc) }), color: '#B7862B' };
  return { text: $t('kayit.gps_cok_zayif'), color: colors.terra };
}

/** Haritanın üstündeki GPS durumu */
export function GpsRozeti({ acc }: { acc: number | null | undefined }) {
  const gps = gpsEtiketi(acc);
  return (
    <View style={styles.gps} accessibilityLiveRegion="polite">
      <View style={[styles.gpsDot, { backgroundColor: gps.color }]} />
      <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12 }}>{gps.text}</Txt>
    </View>
  );
}

type Props = {
  rota: Rota | null;
  onRota: (r: Rota | null) => void;
  /** Kayıt başladı; canlı ekrana geçişi çağıran yapar */
  onBasladi: () => void;
  /** Süren kayıt varken Başlat yerine kayda dönüş düğmesi çıkar */
  kayitDurumu: KayitDurumu;
};

/** "Hangi egzersiz?" başlığı ve kaydırılan tür şeridi. style: şeridin dış boşluğunu değiştirmek için */
export function EgzersizSeridi({ style }: { style?: StyleProp<ViewStyle> }) {
  const { secili: tur, sira } = useEgzersizTuru();

  // Şerit: seçili tür görünen kısmın dışındaysa (ör. "Tüm egzersizler"den seçildi) oraya kaydır
  const serit = useRef<ScrollViewInstance>(null);
  const kayma = useRef({ x: 0, w: 0 });
  const seciliyiGoster = useCallback(() => {
    const { x, w } = kayma.current;
    if (!w) return;
    const bas = sira.indexOf(tur) * TUR_ADIMI;
    if (bas < x) serit.current?.scrollTo({ x: bas, animated: true });
    else if (bas + TUR_ADIMI + space.lg > x + w) serit.current?.scrollTo({ x: bas + TUR_ADIMI + space.lg * 2 - w, animated: true });
  }, [tur, sira]);
  useEffect(seciliyiGoster, [seciliyiGoster]);
  // Ekran arkadayken (liste açıkken) kaydırma işlemeyebilir; öne gelince bir kez daha
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(seciliyiGoster, 150);
      return () => clearTimeout(t);
    }, [seciliyiGoster]),
  );

  return (
    <View>
      <View style={styles.baslikSatiri}>
        <Txt variant="heading" accessibilityRole="header">
          {$t('egzersiz.hangi_egzersiz')}
        </Txt>
        <Pressable accessibilityRole="link" onPress={() => router.push('/egzersiz-turleri')} hitSlop={8} style={styles.tumuBag}>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.terraInk }}>{$t('egzersiz.tumu_sayi', { n: ACTIVITY_TYPES.length })}</Txt>
          <Icon name="chevron" size={16} color={colors.terraInk} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView
        ref={serit}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        onLayout={(e) => (kayma.current.w = e.nativeEvent.layout.width)}
        onScroll={(e) => (kayma.current.x = e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
        style={[styles.serit, style]}
        contentContainerStyle={styles.seritIc}>
        {sira.map((t) => {
          const on = t === tur;
          return (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={ACTIVITY_LABELS[t]}
              onPress={() => egzersizTuruSec(t)}
              style={({ pressed }) => [styles.tur, pressed && { opacity: 0.75 }]}>
              <View style={[styles.daire, on && styles.daireOn]}>
                <Icon name={TUR_IKONLARI[t]} size={26} color={on ? colors.ground : colors.ink} />
              </View>
              <Txt numberOfLines={2} style={[styles.turAd, on && { fontFamily: fontFamily.bodyBold }]}>
                {ACTIVITY_LABELS[t]}
              </Txt>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="link" accessibilityLabel={$t('egzersiz.tum_egzersizler')} onPress={() => router.push('/egzersiz-turleri')} style={({ pressed }) => [styles.tur, pressed && { opacity: 0.75 }]}>
          <View style={[styles.daire, styles.daireTumu]}>
            <Icon name="grid" size={24} color={colors.ink} />
          </View>
          <Txt numberOfLines={2} style={styles.turAd}>
            {$t('egzersiz.tumu')}
          </Txt>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Rota ve canlı konum seçimi, uyarılar ve Başlat (ya da süren kayda dönüş) */
export function EgzersizAyrinti({ rota, onRota, onBasladi, kayitDurumu }: Props) {
  const { secili: tur } = useEgzersizTuru();
  const [acik, setAcik] = useState<'rota' | 'paylasim' | null>(null);
  const [rotaListesi, setRotaListesi] = useState<Rota[] | null>(null);
  // Canlı konum: varsayılan kapalı; kullanıcı açıkça bir grup seçer
  const [paylasim, setPaylasim] = useState<PaylasimGrubu | null>(null);
  // Bağlantıyla da paylaş (uygulaması olmayan aile / arkadaş web'den izler)
  const [baglanti, setBaglanti] = useState(false);
  const [gruplar, setGruplar] = useState<GrupOzeti[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [izinHatasi, setIzinHatasi] = useState(false);
  const [basliyor, setBasliyor] = useState(false);

  async function ac(hangi: 'rota' | 'paylasim') {
    setAcik((a) => (a === hangi ? null : hangi));
    if (hangi === 'rota' && !rotaListesi) setRotaListesi(await rotalarim().catch(() => []));
    if (hangi === 'paylasim' && !gruplar) setGruplar(await gruplarim().catch(() => []));
  }

  async function onBaslat() {
    setHata(null);
    setIzinHatasi(false);
    setBasliyor(true);
    try {
      // Bağlantı kayıttan önce açılır: açılamazsa (internet yok) kayıt başlamadan söylenir
      const anahtar = baglanti ? await baglantiAc() : null;
      await baslat(tur, rota ? { id: rota.id, name: rota.name, points: rota.points } : null, paylasim, false, anahtar);
      egzersizBaslatildi(tur);
      if (anahtar) void baglantiyiPaylas(anahtar);
      onBasladi();
    } catch (e) {
      setIzinHatasi(e instanceof IzinHatasi);
      setHata(e instanceof Error ? e.message : $t('kayit.kayit_baslatilamadi'));
    } finally {
      setBasliyor(false);
    }
  }

  return (
    <View>
      <View style={styles.kutular}>
        <Kutu
          icon="route"
          bg={colors.terraSoft}
          fg={colors.terraInk}
          baslik={$t('kayit.rota')}
          deger={rota ? rota.name : $t('egzersiz.serbest')}
          acik={acik === 'rota'}
          onPress={() => void ac('rota')}
        />
        {supabaseHazir ? (
          <Kutu
            icon="users"
            bg={colors.seaSoft}
            fg={colors.seaInk}
            baslik={$t('kayit.canli_konum')}
            deger={
              paylasim && baglanti
                ? `${paylasim.ad} + ${$t('canli_baglanti.baglanti')}`
                : paylasim
                  ? paylasim.ad
                  : baglanti
                    ? $t('canli_baglanti.baglanti')
                    : $t('egzersiz.kapali')
            }
            acik={acik === 'paylasim'}
            onPress={() => void ac('paylasim')}
          />
        ) : null}
      </View>

      {acik === 'rota' ? (
        <ScrollView style={styles.liste} contentContainerStyle={{ gap: 4 }}>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: !rota }} onPress={() => { onRota(null); setAcik(null); }} style={styles.secenek}>
            <Txt style={{ fontFamily: rota ? fontFamily.body : fontFamily.bodyBold, fontSize: 14 }}>{$t('kayit.rotasiz_kaydet')}</Txt>
          </Pressable>
          {(rotaListesi ?? []).map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: rota?.id === r.id }}
              onPress={() => {
                onRota(r);
                egzersizTuruSec(r.activity);
                setAcik(null);
              }}
              style={styles.secenek}>
              <Txt style={{ fontFamily: rota?.id === r.id ? fontFamily.bodyBold : fontFamily.body, fontSize: 14 }} numberOfLines={1}>
                {$t('kayit.km_2', { name: r.name, km: formatKm(r.distanceM) })}
              </Txt>
            </Pressable>
          ))}
          {rotaListesi && rotaListesi.length === 0 ? <Txt variant="small">{$t('kayit.henuz_rotan_yok_profil')}</Txt> : null}
        </ScrollView>
      ) : null}

      {acik === 'paylasim' ? (
        <ScrollView style={styles.liste} contentContainerStyle={{ gap: 4 }}>
          {/* Bağlantı gruptan bağımsız: ikisi birlikte de seçilebilir */}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: baglanti }}
            onPress={() => setBaglanti((b) => !b)}
            style={[styles.secenek, styles.baglantiSecenegi]}>
            <View style={[styles.kutucuk, baglanti && styles.kutucukOn]}>{baglanti ? <Icon name="check" size={14} color={colors.ground} strokeWidth={2.6} /> : null}</View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={{ fontFamily: baglanti ? fontFamily.bodyBold : fontFamily.bodySemiBold, fontSize: 14 }}>{$t('canli_baglanti.baglantiyla_paylas')}</Txt>
              <Txt variant="small">{$t('canli_baglanti.baglantiyla_paylas_alt')}</Txt>
            </View>
          </Pressable>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: !paylasim }} onPress={() => { setPaylasim(null); setAcik(null); }} style={styles.secenek}>
            <Txt style={{ fontFamily: paylasim ? fontFamily.body : fontFamily.bodyBold, fontSize: 14 }}>{$t('kayit.paylasma')}</Txt>
          </Pressable>
          {(gruplar ?? []).map((g) => (
            <Pressable
              key={g.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: paylasim?.id === g.id }}
              onPress={() => {
                setPaylasim({ id: g.id, ad: g.name });
                setAcik(null);
              }}
              style={styles.secenek}>
              <Txt style={{ fontFamily: paylasim?.id === g.id ? fontFamily.bodyBold : fontFamily.body, fontSize: 14 }} numberOfLines={1}>
                {$t('kayit.uye', { name: g.name, member_count: g.member_count })}
              </Txt>
            </Pressable>
          ))}
          {gruplar && gruplar.length === 0 ? <Txt variant="small">{$t('kayit.konum_paylasmak_icin_once')}</Txt> : null}
          <Txt variant="small">{$t('kayit.yalnizca_sectigin_grubun_uyeleri')}</Txt>
        </ScrollView>
      ) : null}

      <Txt variant="small" style={{ marginTop: space.sm }}>
        {$t('kayit.ekran_kapaliyken_de_kaydetmesi')}
      </Txt>

      {hata ? (
        <View style={styles.error} accessibilityRole="alert">
          <Txt style={{ color: colors.terra, fontFamily: fontFamily.bodySemiBold, fontSize: 13 }}>{hata}</Txt>
          {izinHatasi ? (
            <Pressable accessibilityRole="link" onPress={() => Linking.openSettings()}>
              <Txt style={{ color: colors.seaInk, fontFamily: fontFamily.bodyBold, fontSize: 13, marginTop: 4 }}>{$t('kayit.ayarlari_ac')}</Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {kayitDurumu === 'bos' ? (
        <Button
          label={basliyor ? $t('kayit.baslatiliyor') : $t('egzersiz.x_baslat', { ad: ACTIVITY_LABELS[tur] })}
          icon="play"
          big
          onPress={() => void onBaslat()}
          disabled={basliyor}
          style={{ marginTop: space.md }}
        />
      ) : (
        <Button
          label={$t('harita.kayda_don')}
          icon="record"
          variant="dark"
          big
          onPress={() => router.push(kayitEkrani())}
          style={{ marginTop: space.md }}
        />
      )}
    </View>
  );
}

/** Rota / canlı konum kutusu: basınca altında seçenek listesi açılır */
function Kutu({ icon, bg, fg, baslik, deger, acik, onPress }: { icon: IconName; bg: string; fg: string; baslik: string; deger: string; acik: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: acik }}
      accessibilityLabel={`${baslik}: ${deger}`}
      accessibilityHint={$t('kayit.degistir')}
      onPress={onPress}
      style={({ pressed }) => [styles.kutu, acik && styles.kutuAcik, pressed && { opacity: 0.8 }]}>
      <View style={[styles.kutuIkon, { backgroundColor: bg }]}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="small">{baslik}</Txt>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
          {deger}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  gps: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  baslikSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tumuBag: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  // Şerit panelin iç boşluğunu aşıp ekranın kenarına kadar kayar (sıradaki türün ucu görünsün)
  serit: { marginHorizontal: -space.lg, marginBottom: 12 },
  seritIc: { paddingHorizontal: space.lg, gap: TUR_ADIMI - 72 },
  tur: { width: 72, alignItems: 'center', gap: 6 },
  daire: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' },
  daireOn: { backgroundColor: colors.ink },
  daireTumu: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.inkMuted },
  turAd: { minHeight: 30, fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 15, textAlign: 'center', color: colors.ink },
  kutular: { flexDirection: 'row', gap: space.sm },
  kutu: { flex: 1, minWidth: 0, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.ground, borderWidth: 1.5, borderColor: 'transparent' },
  kutuAcik: { borderColor: colors.lineStrong },
  kutuIkon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  liste: { maxHeight: 180, marginTop: space.sm },
  baglantiSecenegi: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kutucuk: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.inkMuted, alignItems: 'center', justifyContent: 'center' },
  kutucukOn: { backgroundColor: colors.sea, borderColor: colors.sea },
  secenek: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.ground },
  error: { marginTop: space.sm, padding: 12, borderRadius: 12, backgroundColor: colors.terraSoft },
}));
