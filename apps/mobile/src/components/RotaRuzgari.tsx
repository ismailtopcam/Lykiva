/**
 * Rotada şu anki rüzgâr: rotanın ortasındaki noktanın havası (MET Norway) ve rüzgârın rota boyunca
 * ne kadarının karşıdan / arkadan / yandan geldiği. Hesap @lykiva/shared > hava.ts (izdeRuzgar).
 */
import { izdeRuzgar, ruzgarEtkisiMetni, ruzgarMetni, type HavaDurumu, type RoutePoint } from '@lykiva/shared';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Txt } from '@/components/Txt';
import { simdikiHava } from '@/lib/hava';
import { colors, fontFamily, temaliStil } from '@/theme';
import { $t } from '@/i18n';

/** Bundan hafif rüzgârda (m/s) karşıdan / arkadan dağılımı anlamsız; yalnızca rüzgâr metni gösterilir */
const ANLAMLI_RUZGAR = 2;

/** `points` sabit (memo) olmalı */
export function RotaRuzgari({ points }: { points: RoutePoint[] }) {
  const orta = points.length > 1 ? points[Math.floor(points.length / 2)] : null;
  // ~1 km'lik kare: rotaya nokta eklemek her seferinde yeni istek attırmasın
  const anahtar = orta ? `${orta.lat.toFixed(2)},${orta.lng.toFixed(2)}` : null;
  const [hava, setHava] = useState<{ anahtar: string; h: HavaDurumu } | null>(null);

  useEffect(() => {
    if (!anahtar) return;
    let acik = true;
    const [lat, lng] = anahtar.split(',').map(Number);
    simdikiHava(lat, lng)
      .then((h) => {
        if (acik && h) setHava({ anahtar, h });
      })
      .catch(() => undefined);
    return () => {
      acik = false;
    };
  }, [anahtar]);

  const h = hava && hava.anahtar === anahtar ? hava.h : null;
  const dagilim = useMemo(() => (h && h.ruzgar >= ANLAMLI_RUZGAR ? izdeRuzgar(points, h.ruzgarYon) : null), [points, h]);
  if (!h) return null;

  const parcalar = dagilim
    ? [
        { id: 'karşıdan', label: $t('rotaRuzgari.karsidan'), pct: Math.round(dagilim.karşıdan * 100), color: colors.terra },
        { id: 'yandan', label: $t('rotaRuzgari.yandan'), pct: Math.round(dagilim.yandan * 100), color: colors.ochre },
        { id: 'arkadan', label: $t('rotaRuzgari.arkadan'), pct: Math.round(dagilim.arkadan * 100), color: colors.sea },
      ].filter((p) => p.pct > 0)
    : [];
  const metin = ruzgarMetni(h);
  const etki = dagilim?.baskin ? ruzgarEtkisiMetni(dagilim.baskin) : null;

  return (
    <View
      style={styles.kutu}
      accessible
      accessibilityLabel={[
        $t('rotaRuzgari.simdiki_ruzgar'),
        metin,
        etki,
        parcalar.length ? parcalar.map((p) => $t('rotaRuzgari.yuzde', { label: p.label, pct: p.pct })).join(', ') : null,
      ]
        .filter(Boolean)
        .join('. ')}>
      <View style={styles.ust}>
        {h.ruzgar >= 0.5 ? (
          // Ok rüzgârın estiği yönü gösterir (geldiği yönün tersi); kuzey yukarıda
          <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: `${(h.ruzgarYon + 180) % 360}deg` }] }}>
            <Path d="M12 3 L18 15 L12 12 L6 15 Z" fill={colors.ink} />
            <Path d="M12 12 L12 21" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        ) : null}
        <View style={{ flex: 1 }}>
          <Txt style={styles.baslik}>{$t('rotaRuzgari.simdiki_ruzgar')}</Txt>
          <Txt variant="small">
            {metin}
            {etki ? ` · ${etki}` : ''}
          </Txt>
        </View>
      </View>
      {parcalar.length ? (
        <>
          <View style={styles.bar}>
            {parcalar.map((p) => (
              <View key={p.id} style={{ flex: p.pct, backgroundColor: p.color }} />
            ))}
          </View>
          <View style={styles.lejant}>
            {parcalar.map((p) => (
              <View key={p.id} style={styles.lejantOge}>
                <View style={[styles.nokta, { backgroundColor: p.color }]} />
                <Txt variant="small">
                  {p.label} %{p.pct}
                </Txt>
              </View>
            ))}
          </View>
        </>
      ) : null}
      <Txt style={styles.kaynak}>{$t('rotaRuzgari.aciklama')}</Txt>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  kutu: { marginTop: 12 },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  baslik: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  lejant: { flexDirection: 'row', gap: 14, marginTop: 6, flexWrap: 'wrap' },
  lejantOge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nokta: { width: 8, height: 8, borderRadius: 4 },
  kaynak: { fontSize: 10, color: colors.inkMuted, marginTop: 6 },
}));
