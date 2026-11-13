/**
 * Harita sekmesi: bulunduğun yerden seçtiğin yere yol tarifi.
 *
 * Hedef haritaya dokunarak ya da yer aramayla (Photon) seçilir; yol BRouter'la, seçilen etkinliğe göre hesaplanır
 * (patika ya da yol öncelikli). "Yola çık" kaydı bu yolla başlatır, kayıt ekranı kalan mesafeyi gösterir.
 * Eski Keşfet içeriği (rotalar, topluluklar, etkinlikler, kişiler) sağ üstteki düğmeyle açılır: `kesfet-liste.tsx`.
 * Dosya adı bağlantılar bozulmasın diye `kesfet` kaldı.
 */
import { ACTIVITY_LABELS, ACTIVITY_TYPES, estimateDuration, formatKm, formatMeters, kmUnit, routeStats, type ActivityType, type RoutePoint } from '@lykiva/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { gercekHarita, TopoMap, type MapMarker } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Button, Chip, Stat } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { baslat, IzinHatasi, konumOnizlemeBaslat, useKayit } from '@/kayit/kaydedici';
import { yerAra, type YerSonucu } from '@/lib/yerArama';
import { rotaHesapla, type CizimModu } from '@/lib/yonlendirme';
import { colors, fontFamily, radius, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

type Hedef = { c: LngLat; ad: string | null };
type Odak = { c: LngLat; z: number };

const TERCIHLER = (): { id: Exclude<CizimModu, 'serbest'>; label: string }[] => [
  { id: 'yol', label: $t('harita.yol_oncelikli') },
  { id: 'patika', label: $t('harita.patika_oncelikli') },
];

/** "1 sa 10 dk" */
function sureMetni(s: number) {
  const dk = Math.max(1, Math.round(s / 60));
  const sa = Math.floor(dk / 60);
  return sa > 0 ? $t('rota_olustur.sa_dk', { sa, a: dk % 60 }) : $t('rota_olustur.dk', { dk });
}

/** Yolun tamamı görünsün diye kamera merkezi ve yakınlaştırması (w × h: haritanın boş kalan alanı, px) */
function cerceve(points: RoutePoint[], w: number, h: number): Odak | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.lng);
  const ys = points.map((p) => p.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const orta: LngLat = [(x0 + x1) / 2, (y0 + y1) / 2];
  const kos = Math.cos((orta[1] * Math.PI) / 180) || 1;
  // Zoom z'de dünya 256·2^z px genişliğinde; enlem farkı Mercator'da kabaca 1/cos(enlem) kadar uzar
  const zx = Math.log2((Math.max(w, 100) * 360) / (256 * Math.max(x1 - x0, 1e-5)));
  const zy = Math.log2((Math.max(h, 100) * 360 * kos) / (256 * Math.max(y1 - y0, 1e-5)));
  return { c: orta, z: Math.max(3, Math.min(16, Math.min(zx, zy) - 0.3)) };
}

export default function HaritaScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const kayit = useKayit();
  const [activity, setActivity] = useState<ActivityType>('walk');
  const [mod, setMod] = useState<Exclude<CizimModu, 'serbest'>>('yol');
  const [hedef, setHedef] = useState<Hedef | null>(null);
  // Yolun başı: hedef seçildiği andaki konum (her GPS güncellemesinde yeniden hesaplanmasın diye sabit)
  const [baslangic, setBaslangic] = useState<LngLat | null>(null);
  const [yol, setYol] = useState<{ points: RoutePoint[]; icin: string } | null>(null);
  const [hesapliyor, setHesapliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basliyor, setBasliyor] = useState(false);
  const [q, setQ] = useState('');
  const [sonuclar, setSonuclar] = useState<YerSonucu[]>([]);
  const [odak, setOdak] = useState<Odak | null>(null);
  const [ucBoyut, setUcBoyut] = useState(false);
  const ilkOdak = useRef(false);
  const [panelH, setPanelH] = useState(220);
  const [haritaH, setHaritaH] = useState(700);

  // Sekme açıkken GPS'i çalıştır (kayıt sürmüyorsa konumu yalnızca gösterir); sekmeden çıkınca durur
  useFocusEffect(useCallback(() => konumOnizlemeBaslat(), []));

  const sk = kayit.sonKonum;
  const ben: LngLat | null = sk ? [sk.lng, sk.lat] : null;

  // İlk konum gelince haritayı oraya getir
  useEffect(() => {
    if (sk && !ilkOdak.current) {
      ilkOdak.current = true;
      setOdak({ c: [sk.lng, sk.lat], z: 14 });
    }
  }, [sk]);

  // Hedef konumdan önce seçildiyse konum gelince başlangıç olsun (çizim sırasında, bir kez)
  if (hedef && !baslangic && sk) setBaslangic([sk.lng, sk.lat]);

  // Hedef, başlangıç, etkinlik ya da tercih değişince yolu hesapla
  const anahtar = hedef && baslangic ? `${baslangic.join(',')}>${hedef.c.join(',')}|${mod}|${activity}` : null;
  useEffect(() => {
    if (!anahtar || !hedef || !baslangic) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      setHesapliyor(true);
      setHata(null);
      rotaHesapla([baslangic, hedef.c], mod, activity, ac.signal)
        .then((r) => {
          setYol({ points: r.points, icin: anahtar });
          const f = cerceve(r.points, width - 80, haritaH - insets.top - 120 - panelH - 40);
          if (f) setOdak(f);
        })
        .catch((e) => {
          if (e?.name !== 'AbortError') setHata(e instanceof Error ? e.message : $t('lib_yonlendirme.rota_hesaplanamadi'));
        })
        .finally(() => !ac.signal.aborted && setHesapliyor(false));
    }, 200);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
    // Panel ve ekran ölçüsü değişince yeniden hesaplanmasın
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar]);

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

  const gorunenSonuclar = q.trim().length >= 2 ? sonuclar : [];
  // Eski hesap yeni hedefte gösterilmez
  const points = useMemo(() => (yol && yol.icin === anahtar ? yol.points : []), [yol, anahtar]);
  const stats = useMemo(() => (points.length > 1 ? routeStats(points) : null), [points]);
  const rakimVar = points.some((p) => p.alt != null);
  const cizgi: LngLat[] = points.map((p) => [p.lng, p.lat]);
  const gorunenHata = anahtar ? hata : null;
  const kayitta = kayit.durum !== 'bos';

  const markers: MapMarker[] = [];
  if (ben) markers.push({ id: 'me', coord: ben, kind: 'me' });
  if (hedef) markers.push({ id: 'hedef', coord: hedef.c, kind: 'end' });

  function hedefSec(h: Hedef) {
    setHedef(h);
    setBaslangic(ben);
    setHata(null);
  }

  function yerSec(y: YerSonucu) {
    Keyboard.dismiss();
    setQ('');
    setSonuclar([]);
    hedefSec({ c: y.coord, ad: y.ad });
    setOdak({ c: y.coord, z: 14 });
  }

  function temizle() {
    setHedef(null);
    setBaslangic(null);
    setYol(null);
    setHata(null);
  }

  async function yolaCik() {
    if (!hedef || points.length < 2) return;
    setBasliyor(true);
    setHata(null);
    try {
      const ad = hedef.ad ? $t('harita.yol_tarifi_ad', { ad: hedef.ad }) : $t('harita.yol_tarifi');
      // Geçici id: sunucuda rota değil, aktiviteye route_id olarak gitmez (bkz. kayit/paket.ts)
      await baslat(activity, { id: `tarif-${Date.now()}`, name: ad, points }, null);
      router.push('/kayit/canli');
    } catch (e) {
      setHata(e instanceof IzinHatasi || e instanceof Error ? e.message : $t('kayit.kayit_baslatilamadi'));
    } finally {
      setBasliyor(false);
    }
  }

  const hedefAdi = hedef?.ad ?? (hedef ? $t('harita.secilen_nokta', { lat: hedef.c[1].toFixed(4), lng: hedef.c[0].toFixed(4) }) : '');

  return (
    <View style={styles.root} onLayout={(e) => setHaritaH(Math.round(e.nativeEvent.layout.height))}>
      <TopoMap
        style={StyleSheet.absoluteFill}
        route={cizgi.length > 1 ? cizgi : undefined}
        markers={markers}
        follow={odak?.c ?? null}
        followZoom={odak?.z}
        ucBoyut={ucBoyut}
        onPress={(c) => hedefSec({ c, ad: null })}
        katmanDugmesi={{ top: insets.top + 58 }}
        padding={{ top: 120, bottom: panelH + 40 }}
        accessibilityLabel={hedef ? $t('harita.yol_haritasi', { ad: hedefAdi }) : $t('harita.harita')}
      />
      {/* Sağ sütun, katman düğmesinin altında: 3B/2B (yalnızca gerçek haritada) ve konumuma git */}
      <View style={[styles.sagDugmeler, { top: insets.top + 58 + 44 + 10 }]} pointerEvents="box-none">
        {gercekHarita ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: ucBoyut }}
            accessibilityLabel={$t('kayit_canli.uc_boyutlu_gorunum')}
            onPress={() => setUcBoyut((u) => !u)}
            hitSlop={4}
            style={({ pressed }) => [styles.yuvarlakDugme, pressed && { opacity: 0.6 }]}>
            <Txt style={[styles.yuvarlakDugmeYazi, ucBoyut && { color: colors.sea }]}>{ucBoyut ? '3D' : '2D'}</Txt>
          </Pressable>
        ) : null}
        {ben ? <IconButton floating icon="target" label={$t('harita.konumuma_git')} onPress={() => setOdak({ c: ben, z: 15 })} /> : null}
      </View>
      <FloatingHeader
        // Konum düğmesi sağ sütunda; boş yer tutucu (verilmezse geri düğmesi çıkar)
        left={<View />}
        middle={
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.inkMuted} strokeWidth={2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={$t('harita.nereye_gidiyorsun')}
              placeholderTextColor={colors.inkMuted}
              accessibilityLabel={$t('harita.hedef_ara')}
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
        }
        right={<IconButton floating icon="compass" label={$t('kesfet.kesfet')} onPress={() => router.push('/kesfet-liste')} />}
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
          <Txt variant="small" style={styles.resultsNote}>
            {$t('rota_olustur.yalnizca_turkiyedeki_yerler')}
          </Txt>
        </View>
      ) : null}

      <View style={styles.sheet} onLayout={(e) => setPanelH(Math.round(e.nativeEvent.layout.height))}>
        <View style={styles.grip} />
        {!hedef ? (
          <>
            <Txt variant="heading">{$t('harita.nereye_gitmek_istiyorsun')}</Txt>
            <Txt variant="small" style={{ marginTop: 4 }}>
              {gercekHarita ? $t('harita.haritaya_dokun_ya_da_ara') : $t('harita.yukaridan_ara')}
            </Txt>
            {!ben ? (
              <Txt variant="small" style={{ marginTop: 4, color: colors.inkMuted }}>
                {$t('harita.konum_bekleniyor')}
              </Txt>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.hedefSatiri}>
              <Icon name="flag" size={20} color={colors.terra} />
              <Txt style={{ flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 16 }} numberOfLines={1}>
                {hedefAdi}
              </Txt>
              <IconButton icon="close" label={$t('harita.hedefi_kaldir')} onPress={temizle} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }} accessibilityRole="radiogroup">
              {ACTIVITY_TYPES.map((t) => (
                <Chip key={t} label={ACTIVITY_LABELS[t]} role="radio" selected={t === activity} onPress={() => setActivity(t)} />
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }} accessibilityRole="radiogroup">
              {TERCIHLER().map((m) => (
                <Chip key={m.id} label={m.label} role="radio" tone="sea" selected={m.id === mod} onPress={() => setMod(m.id)} />
              ))}
            </View>

            {!baslangic ? (
              <Txt variant="small" style={{ marginBottom: 8 }}>
                {$t('harita.konum_bekleniyor')}
              </Txt>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', columnGap: 10, marginBottom: 10 }}>
                <Stat label={$t('ortak.mesafe')} size={18} value={stats ? `${formatKm(stats.distanceM)} ${kmUnit()}` : '–'} />
                <Stat label={$t('ortak.tirmanis')} size={18} value={stats && rakimVar ? $t('rota_olustur.m', { meters: formatMeters(stats.gainM) }) : '–'} />
                <Stat label={$t('rota_olustur.tahmini_sure')} size={18} value={stats ? sureMetni(estimateDuration(activity, stats.distanceM, rakimVar ? stats.gainM : 0)) : '–'} />
              </View>
            )}

            {gorunenHata ? (
              <Txt accessibilityRole="alert" style={{ color: colors.terra, fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginBottom: 8 }}>
                {gorunenHata}
              </Txt>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {hesapliyor && anahtar ? <ActivityIndicator color={colors.terra} /> : null}
              {ben && baslangic && (ben[0] !== baslangic[0] || ben[1] !== baslangic[1]) ? (
                <IconButton icon="rotate" label={$t('harita.konumumdan_yeniden_hesapla')} onPress={() => setBaslangic(ben)} />
              ) : null}
              {kayitta ? (
                <Button label={$t('harita.kayda_don')} icon="record" variant="dark" onPress={() => router.push('/kayit')} style={{ flex: 1 }} />
              ) : (
                <Button
                  label={basliyor ? $t('harita.basliyor') : $t('harita.yola_cik')}
                  icon="play"
                  onPress={() => void yolaCik()}
                  disabled={!stats || hesapliyor || basliyor}
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, alignSelf: 'stretch', paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  results: { position: 'absolute', left: space.md, right: space.md, borderRadius: 16, backgroundColor: colors.surface, paddingVertical: 4, borderWidth: 1, borderColor: colors.line },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 6 },
  resultsNote: { color: colors.inkMuted, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 6 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 16 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 10 },
  hedefSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sagDugmeler: { position: 'absolute', right: 16, gap: 10 },
  // IconButton'un floating görünümüyle aynı
  yuvarlakDugme: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  yuvarlakDugmeYazi: { fontFamily: fontFamily.bodyBold, fontSize: 14, color: colors.ink },
}));
