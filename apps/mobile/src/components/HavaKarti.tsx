/**
 * Aktivite detayında "Hava" bölümü: sıcaklık, hissedilen, rüzgâr (rotaya göre karşıdan / arkadan), nem, yağış, UV.
 */
import { havaAyrintilari, sembolMetni, type HavaDurumu } from '@lykiva/shared';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/Txt';
import type { LngLat } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

export function HavaKarti({ hava, iz, baslik = 'Hava' }: { hava: HavaDurumu; iz?: LngLat[]; baslik?: string }) {
  const satirlar = havaAyrintilari(
    hava,
    iz?.map(([lng, lat]) => ({ lat, lng })),
  );
  const gok = sembolMetni(hava.sembol);
  return (
    <View style={styles.kart} accessible accessibilityLabel={`${baslik}: ${gok ? gok + ', ' : ''}${satirlar.map(([e, d]) => `${e} ${d}`).join(', ')}`}>
      <View style={styles.ust}>
        <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }}>{baslik}</Txt>
        {gok ? <Txt variant="small">{gok}</Txt> : null}
      </View>
      <View style={styles.izgara}>
        {satirlar.map(([e, d]) => (
          <View key={e} style={styles.hucre}>
            <Txt style={{ fontSize: 11, color: colors.inkMuted }}>{e}</Txt>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>{d}</Txt>
          </View>
        ))}
      </View>
      <Txt style={styles.kaynak}>Kaynak: MET Norway</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  kart: { marginHorizontal: space.lg, marginTop: space.md, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ust: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  izgara: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 18 },
  hucre: { minWidth: 90, flexShrink: 1 },
  kaynak: { fontSize: 10, color: colors.inkMuted, marginTop: 10 },
});
