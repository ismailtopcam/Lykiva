/**
 * Rota eğimi: eğime göre renkli yükseklik profili (parmakla gezilir), açıklama ve tırmanış listesi.
 * Hesaplar @lykiva/shared > egim.ts'te; burada yalnızca çizim.
 */
import {
  GRADE_CLASSES,
  GRADE_COLORS,
  GRADE_LABELS,
  altitudeAt,
  formatGrade,
  formatKm,
  formatMeters,
  gradeAt,
  gradeSegments,
  gradeSummary,
  positionAt,
  profileSamples,
  routeProfile,
  type GradeClass,
  type GradeSummary,
  type ProfileSamples,
  type RoutePoint,
  type RouteProfile,
} from '@lykiva/shared';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { LngLat } from '@/data/ornek';
import { colors, fontFamily, temaliStil } from '@/theme';
import { Txt } from './Txt';
import { $t } from '@/i18n';

export type RotaEgim = {
  profil: RouteProfile;
  ozet: GradeSummary;
  ornekler: ProfileSamples;
  /** TopoMap routeColors için */
  renkler: { from: number; to: number; color: string }[];
};

/** Rota noktalarından eğim bilgisi; rakım yoksa (serbest çizim) null. `points` sabit (memo) olmalı. */
export function useRotaEgim(points: RoutePoint[]): RotaEgim | null {
  return useMemo(() => {
    const profil = routeProfile(points);
    if (!profil) return null;
    return {
      profil,
      ozet: gradeSummary(profil),
      ornekler: profileSamples(profil, 120),
      renkler: gradeSegments(profil).map((s) => ({ from: s.from, to: s.to, color: GRADE_COLORS[s.cls] })),
    };
  }, [points]);
}

/** İmlecin (0..1) haritadaki konumu */
export function imlecKonumu(points: RoutePoint[], egim: RotaEgim | null, imlec: number | null): LngLat | null {
  if (!egim || imlec == null) return null;
  const p = positionAt(points, egim.profil, imlec * egim.profil.totalM);
  return [p.lng, p.lat];
}

/** Bir sınıf dizisini aynı sınıftaki ardışık aralıklara böler: [başlangıç, bitiş] örnek indisi */
function kosular(cls: GradeClass[]): { from: number; to: number; cls: GradeClass }[] {
  const out: { from: number; to: number; cls: GradeClass }[] = [];
  cls.forEach((c, i) => {
    const son = out[out.length - 1];
    if (son && son.cls === c) son.to = i + 1;
    else out.push({ from: i, to: i + 1, cls: c });
  });
  return out;
}

export function EgimProfili({
  egim,
  width,
  height = 72,
  imlec,
  onImlec,
}: {
  egim: RotaEgim;
  width: number;
  height?: number;
  /** 0..1 seçili konum; null = seçili değil */
  imlec: number | null;
  onImlec: (v: number | null) => void;
}) {
  const { ornekler, profil, ozet } = egim;
  const pad = 4;
  const lo0 = Math.min(...ornekler.alt);
  const hi0 = Math.max(...ornekler.alt);
  // Düz rotalar abartılı görünmesin: dikeyde en az 20 m göster
  const orta = (lo0 + hi0) / 2;
  const yari = Math.max(10, (hi0 - lo0) / 2);
  const lo = orta - yari;
  const hi = orta + yari;
  const n = ornekler.alt.length;
  const X = (i: number) => (i / (n - 1)) * width;
  const Y = (z: number) => pad + (height - pad * 2) * (1 - (z - lo) / (hi - lo));

  const parcalar = kosular(ornekler.cls).map((k) => {
    let cizgi = '';
    for (let i = k.from; i <= k.to; i++) cizgi += `${i === k.from ? 'M' : 'L'}${X(i).toFixed(1)} ${Y(ornekler.alt[i]).toFixed(1)} `;
    const alan = `${cizgi}L${X(k.to).toFixed(1)} ${height} L${X(k.from).toFixed(1)} ${height} Z`;
    return { ...k, cizgi, alan };
  });

  const secM = imlec != null ? imlec * profil.totalM : null;
  const secZ = secM != null ? altitudeAt(profil, secM) : null;
  const secG = secM != null ? gradeAt(profil, secM) : null;

  const sec = (e: GestureResponderEvent) => onImlec(Math.max(0, Math.min(1, e.nativeEvent.locationX / width)));

  return (
    <View>
      <View style={styles.ust}>
        {secM != null && secZ != null && secG != null ? (
          <Txt variant="small" style={styles.okuma}>
            {$t('egimProfili.km_m', { km: formatKm(secM), meters: formatMeters(secZ) })}<Txt variant="small" style={[styles.okuma, { color: secG > 3 ? colors.terra : secG < -3 ? colors.sea : colors.ink }]}>
              {secG >= 0 ? '↑' : '↓'} {formatGrade(secG)}
            </Txt>
          </Txt>
        ) : (
          <Txt variant="small">
            {$t('egimProfili.en_dik_cikis_en', { grade: formatGrade(ozet.maxClimbGrade), grade2: formatGrade(ozet.maxDescentGrade) })}</Txt>
        )}
        <Txt variant="small">
          {$t('egimProfili.m', { meters: formatMeters(lo0), meters2: formatMeters(hi0) })}</Txt>
      </View>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={sec}
        onResponderMove={sec}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={$t('egimProfili.yukseklik_ve_egim_profili', { grade: formatGrade(ozet.maxClimbGrade), grade2: formatGrade(ozet.maxDescentGrade) })}
        accessibilityValue={
          secM != null && secZ != null && secG != null
            ? { text: $t('egimProfili.kilometre_metre_egim', { km: formatKm(secM), meters: formatMeters(secZ), a: secG < 0 ? $t('egimProfili.eksi') : '', grade: formatGrade(secG) }) }
            : undefined
        }
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onImlec(Math.max(0, Math.min(1, (imlec ?? 0) + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))}>
        <Svg width={width} height={height}>
          {parcalar.map((p, i) => (
            <Path key={`a${i}`} d={p.alan} fill={GRADE_COLORS[p.cls]} fillOpacity={0.22} />
          ))}
          {parcalar.map((p, i) => (
            <Path key={`c${i}`} d={p.cizgi} fill="none" stroke={GRADE_COLORS[p.cls]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {imlec != null && secZ != null ? (
            <>
              <Line x1={imlec * width} x2={imlec * width} y1={0} y2={height} stroke={colors.ink} strokeWidth={1.5} />
              <Circle cx={imlec * width} cy={Y(secZ)} r={5} fill={colors.surface} stroke={colors.ink} strokeWidth={2.5} />
            </>
          ) : null}
        </Svg>
      </View>
      <View style={styles.lejant}>
        {GRADE_CLASSES.filter((c) => ozet.byClass[c] > 0).map((c) => (
          <View key={c} style={styles.lejantOge}>
            <View style={[styles.lejantRenk, { backgroundColor: GRADE_COLORS[c] }]} />
            <Txt variant="small">{GRADE_LABELS[c]}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Tırmanış bölümleri; dokununca o tırmanışın başı seçilir */
export function TirmanisListesi({ egim, onSec }: { egim: RotaEgim; onSec: (imlec: number) => void }) {
  const { climbs } = egim.ozet;
  if (!climbs.length) return null;
  return (
    <View style={{ marginTop: 14 }}>
      <Txt style={styles.baslik}>{$t('egimProfili.tirmanislar')}</Txt>
      {climbs.map((c, i) => (
        <Pressable
          key={`${c.startM}`}
          accessibilityRole="button"
          accessibilityLabel={$t('egimProfili.tirmanis_kilometrede_basliyor_kilometre', { a: i + 1, km: formatKm(c.startM), km2: formatKm(c.lengthM), meters: formatMeters(c.gainM), grade: formatGrade(c.avgGrade), grade2: formatGrade(c.maxGrade) })}
          onPress={() => onSec(c.startM / egim.profil.totalM)}
          style={styles.tirmanis}>
          <View style={[styles.numara, { backgroundColor: GRADE_COLORS[c.avgGrade >= 10 ? 'steep' : c.avgGrade >= 6 ? 'moderate' : 'gentle'] }]}>
            <Txt style={styles.numaraYazi}>{i + 1}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={styles.tirmanisUst}>
              {$t('egimProfili.km_m_ort', { km: formatKm(c.lengthM), meters: formatMeters(c.gainM), grade: formatGrade(c.avgGrade) })}</Txt>
            <Txt variant="small">
              {$t('egimProfili.km_de_baslar_en', { km: formatKm(c.startM), grade: formatGrade(c.maxGrade) })}</Txt>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  ust: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 },
  okuma: { fontFamily: fontFamily.bodySemiBold, color: colors.ink },
  lejant: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  lejantOge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lejantRenk: { width: 14, height: 4, borderRadius: 2 },
  baslik: { fontFamily: fontFamily.bodyBold, fontSize: 14, marginBottom: 6 },
  tirmanis: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 6 },
  numara: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numaraYazi: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 12 },
  tirmanisUst: { fontFamily: fontFamily.bodySemiBold, fontSize: 14 },
}));
