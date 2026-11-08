/**
 * İnişli çıkışlı (3B) görünüm: aktivitenin gerçek izi, gerçek yükseklikleriyle.
 *
 * İz yerel metre düzleminde döndürülüp eğilerek çizilir (paralel izdüşüm); harita karosu ya da
 * internet gerekmez, Expo Go'da da çalışır. Arazinin kendisi (dağ yüzeyi) çizilmez: MapLibre
 * Native'in bu sürümünde 3B arazi yok; yalnızca iz, zemindeki gölgesi ve aradaki "perde" var.
 */
import { egimYuzde, formatKm, izdusur, izHazirla, mesafedeDeger, parcaEgimleri, type EgimSinifi, type Iz3B, type IzKoordinati } from '@lykiva/shared';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { ElevationProfile } from '@/components/charts';
import { FloatingHeader } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Stat } from '@/components/ui';
import { useAktivite } from '@/data/aktivite';
import type { Activity } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

const ABARTILAR = [1, 3, 10] as const;
const RENK: Record<EgimSinifi, string> = { cikis: colors.terra, inis: colors.sea, duz: colors.ink };

const yol = (pts: [number, number][]) => (pts.length ? 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') : '');

/** Dizideki değeri 0..1 konumunda doğrusal okur */
function oranla(arr: number[], t: number) {
  if (arr.length < 2) return arr[0] ?? 0;
  const f = Math.max(0, Math.min(1, t)) * (arr.length - 1);
  const i = Math.min(Math.floor(f), arr.length - 2);
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
}

export default function UcBoyutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { a, yukleniyor, hata } = useAktivite(id);
  if (!a) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: space.lg }]}>
        <FloatingHeader />
        {yukleniyor ? <ActivityIndicator color={colors.terra} /> : <Txt variant="muted">{hata ?? 'Aktivite bulunamadı'}</Txt>}
      </View>
    );
  }
  return <UcBoyut a={a} />;
}

function UcBoyut({ a }: { a: Activity }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Tasarım örneğinde yükseklikli iz yok: rota ile yükseklik dizisinden üretilir
  const iz = useMemo<Iz3B | null>(() => {
    const k: IzKoordinati[] = a.iz3b ?? a.route.map((c, i, r) => [c[0], c[1], a.hasElevation === false ? null : oranla(a.elevation, i / Math.max(1, r.length - 1))]);
    return izHazirla(k);
  }, [a]);
  const egimler = useMemo(() => (iz ? parcaEgimleri(iz) : []), [iz]);

  // Varsayılan abartı: yükseklik farkı izin genişliğinin ~%12'sini bulacak en küçük seçenek
  const varsayilan = useMemo(() => {
    if (!iz || !iz.yukseklikVar) return 1;
    const genislik = Math.max(Math.max(...iz.x) - Math.min(...iz.x), Math.max(...iz.y) - Math.min(...iz.y), 1);
    const fark = iz.maxZ - iz.minZ;
    return ABARTILAR.find((k) => fark * k >= genislik * 0.12) ?? ABARTILAR[ABARTILAR.length - 1];
  }, [iz]);

  const [abartiSecim, setAbarti] = useState<number | null>(null);
  const abarti = abartiSecim ?? varsayilan;
  const [yon, setYon] = useState(-25);
  const [egim, setEgim] = useState(35);
  const [pos, setPos] = useState(0);
  const surukleme = useRef<{ x: number; y: number; yon: number; egim: number } | null>(null);

  // 3B alanı: üst çubuk ile alttaki panel (~300 pt) arasını doldurur
  const G3 = { w: width, h: Math.max(240, Math.min(560, height - insets.top - 48 - insets.bottom - 300)) };
  const profilW = width - space.lg * 2;

  if (!iz) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: space.lg }]}>
        <FloatingHeader />
        <Txt variant="muted">Bu kayıtta 3B görünüm için yeterli GPS noktası yok.</Txt>
      </View>
    );
  }

  const p = izdusur(iz, { yon, egim, abarti }, G3.w, G3.h, 28);
  const hedefM = pos * iz.toplamM;
  const zAt = mesafedeDeger(iz.d, iz.z, hedefM);
  const imlec = p.P(mesafedeDeger(iz.d, iz.x, hedefM), mesafedeDeger(iz.d, iz.y, hedefM), zAt);
  const imlecZemin = p.P(mesafedeDeger(iz.d, iz.x, hedefM), mesafedeDeger(iz.d, iz.y, hedefM), iz.minZ);
  const egimAt = iz.yukseklikVar ? egimYuzde(iz, hedefM) : 0;
  const hp = a.hizProfili;
  const hizAt = hp && hp.length > 1 ? mesafedeDeger(hp.map((h) => h.d), hp.map((h) => h.v), pos * hp[hp.length - 1].d) : null;

  // Eğim sınıfına göre parça yolları (aynı renkteki ardışık parçalar tek yolda)
  const renkliYollar: Record<EgimSinifi, string> = { cikis: '', inis: '', duz: '' };
  egimler.forEach((s, i) => {
    const [x1, y1] = p.iz[i];
    const [x2, y2] = p.iz[i + 1];
    renkliYollar[s] += `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} `;
  });
  // Perde çizgileri: en fazla ~70 tane
  const perdeAdim = Math.max(1, Math.floor(p.iz.length / 70));
  const enYuksek = iz.z.indexOf(iz.maxZ);
  const perde = `${yol(p.iz)} L${[...p.zemin].reverse().map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;

  const surukle = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (e: GestureResponderEvent) => {
      surukleme.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, yon, egim };
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const s = surukleme.current;
      if (!s) return;
      setYon(s.yon + (e.nativeEvent.pageX - s.x) * 0.5);
      setEgim(Math.max(12, Math.min(88, s.egim - (e.nativeEvent.pageY - s.y) * 0.3)));
    },
    onResponderRelease: () => {
      surukleme.current = null;
    },
  };

  const onScrub = (e: GestureResponderEvent) => setPos(Math.max(0, Math.min(1, e.nativeEvent.locationX / profilW)));

  return (
    <View style={styles.root}>
      <View
        style={{ marginTop: insets.top + 48 }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Rotanın 3B görünümü: ${formatKm(iz.toplamM)} km${iz.yukseklikVar ? `, en alçak ${Math.round(iz.minZ)} m, en yüksek ${Math.round(iz.maxZ)} m` : ', rakım bilgisi yok'}. Döndürmek için sürükle ya da döndür düğmesini kullan.`}
        {...surukle}>
        <Svg width={G3.w} height={G3.h}>
          <Path d={perde} fill={colors.terra} fillOpacity={0.08} />
          <Path d={yol(p.zemin)} fill="none" stroke="#CDBFA6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <G stroke={colors.terra} strokeOpacity={0.28} strokeWidth={1}>
            {p.iz.map((q, i) =>
              i % perdeAdim === 0 ? <Line key={i} x1={q[0]} y1={q[1]} x2={p.zemin[i][0]} y2={p.zemin[i][1]} /> : null,
            )}
          </G>
          <Path d={yol(p.iz)} fill="none" stroke={colors.surface} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          {(Object.keys(renkliYollar) as EgimSinifi[]).map((s) =>
            renkliYollar[s] ? <Path key={s} d={renkliYollar[s]} fill="none" stroke={RENK[s]} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" /> : null,
          )}
          <Circle cx={p.iz[0][0]} cy={p.iz[0][1]} r={6} fill={colors.surface} stroke={colors.sea} strokeWidth={3} />
          <Circle cx={p.iz[p.iz.length - 1][0]} cy={p.iz[p.iz.length - 1][1]} r={6} fill={colors.ink} stroke={colors.surface} strokeWidth={2} />
          {iz.yukseklikVar && enYuksek >= 0 ? (
            <SvgText x={p.iz[enYuksek][0]} y={p.iz[enYuksek][1] - 12} fontSize={11} fontWeight="700" fill={colors.ink} textAnchor="middle">
              {`${Math.round(iz.maxZ)} m`}
            </SvgText>
          ) : null}
          <Line x1={imlec[0]} y1={imlec[1]} x2={imlecZemin[0]} y2={imlecZemin[1]} stroke={colors.ink} strokeWidth={1.5} strokeDasharray="3 3" />
          <Circle cx={imlec[0]} cy={imlec[1]} r={9} fill={colors.ink} stroke={colors.surface} strokeWidth={3} />
        </Svg>
      </View>

      <FloatingHeader
        middle={
          <View accessibilityRole="radiogroup" style={styles.seg}>
            {ABARTILAR.map((k) => (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityLabel={k === 1 ? 'Gerçek ölçek' : `Yükseklik ${k} kat abartılı`}
                accessibilityState={{ checked: k === abarti }}
                onPress={() => setAbarti(k)}
                style={[styles.segBtn, k === abarti && { backgroundColor: colors.ink }]}>
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13, color: k === abarti ? colors.ground : colors.ink }}>{k}x</Txt>
              </Pressable>
            ))}
          </View>
        }
        right={<IconButton floating icon="rotate" label="45 derece döndür" onPress={() => setYon((y) => y + 45)} />}
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Stat label="Konum" value={formatKm(hedefM)} unit="km" />
          <Stat label="Yükseklik" value={iz.yukseklikVar ? String(Math.round(zAt)) : '–'} unit={iz.yukseklikVar ? 'm' : undefined} />
          <Stat
            label="Eğim"
            value={iz.yukseklikVar ? `${egimAt >= 0 ? '+' : ''}${egimAt.toFixed(1).replace('.', ',')}%` : '–'}
            color={egimAt > 3 ? colors.terra : egimAt < -3 ? colors.sea : colors.ink}
          />
          <Stat label="Hız" value={hizAt != null ? hizAt.toFixed(1).replace('.', ',') : '–'} unit={hizAt != null ? 'km/sa' : undefined} />
        </View>

        {a.hasElevation === false ? (
          <View
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={onScrub}
            onResponderMove={onScrub}
            style={styles.duzCubuk}>
            <View style={[styles.duzDolu, { width: `${pos * 100}%` }]} />
          </View>
        ) : (
          <View
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={onScrub}
            onResponderMove={onScrub}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Rota boyunca konum"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(pos * 100) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => setPos((v) => Math.max(0, Math.min(1, v + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))}>
            <ElevationProfile values={a.elevation} width={profilW} height={90} cursor={pos} label="Yükseklik profili ve seçili nokta" />
          </View>
        )}
        <View style={styles.lejant}>
          {(['cikis', 'inis', 'duz'] as EgimSinifi[]).map((s) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: RENK[s] }} />
              <Txt variant="small">{s === 'cikis' ? 'Çıkış' : s === 'inis' ? 'İniş' : 'Düz'}</Txt>
            </View>
          ))}
        </View>
        <Txt variant="small" style={{ marginTop: 6 }}>
          {a.hasElevation === false
            ? 'Bu kayıtta cihaz rakım vermedi; iz düz görünür. '
            : abarti === 1
              ? 'Gerçek ölçek. '
              : `Yükseklik ${abarti} kat abartılı. `}
          Haritayı sürükleyerek döndür ve eğ; alttaki çubukta parmağını kaydır.
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EFE8DB' },
  seg: { flexDirection: 'row', height: 44, borderRadius: 22, padding: 4, backgroundColor: colors.surface },
  segBtn: { minWidth: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: space.lg, paddingTop: 18 },
  lejant: { flexDirection: 'row', gap: 16, marginTop: 8 },
  duzCubuk: { height: 28, borderRadius: 14, backgroundColor: colors.line, overflow: 'hidden', justifyContent: 'center' },
  duzDolu: { height: '100%', backgroundColor: colors.seaSoft },
});
