/**
 * Harita üstündeki katman düğmesi ve harita türü seçim penceresi (standart, uydu, hibrit, kış).
 * Seçim bütün haritalara uygulanır (bkz. haritaTurleri.ts).
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { $t } from '@/i18n';
import { colors, fontFamily, space } from '@/theme';
import { HARITA_TURLERI, haritaTuruSec, useHaritaTuru, type HaritaTuru } from './haritaTurleri';

function turAdi(t: HaritaTuru): string {
  switch (t) {
    case 'standart':
      return $t('haritaTuru.standart');
    case 'uydu':
      return $t('haritaTuru.uydu');
    case 'hibrit':
      return $t('haritaTuru.hibrit');
    case 'kis':
      return $t('haritaTuru.kis');
  }
}

/** Türün küçük önizlemesi (gerçek döşeme değil, renk taslağı) */
function Onizleme({ tur }: { tur: HaritaTuru }) {
  const p = ONIZLEME[tur];
  return (
    <View style={[styles.onizleme, { backgroundColor: p.zemin }]}>
      <View style={[styles.leke, { backgroundColor: p.leke }]} />
      {p.yol ? <View style={[styles.yol, { backgroundColor: p.yol }]} /> : null}
      {p.pist ? <View style={[styles.pist, { backgroundColor: p.pist }]} /> : null}
    </View>
  );
}

const ONIZLEME: Record<HaritaTuru, { zemin: string; leke: string; yol?: string; pist?: string }> = {
  standart: { zemin: '#EFEBE3', leke: '#A8C8DC', yol: '#FFFFFF' },
  uydu: { zemin: '#3F5337', leke: '#6E7C52' },
  hibrit: { zemin: '#3F5337', leke: '#6E7C52', yol: '#F2D16B' },
  kis: { zemin: '#F3F6F9', leke: '#D3DEDB', pist: '#D9473A' },
};

export function HaritaTuruDugmesi({ style }: { style?: StyleProp<ViewStyle> }) {
  const [acik, setAcik] = useState(false);
  const tur = useHaritaTuru();
  const insets = useSafeAreaInsets();
  return (
    <>
      <IconButton floating icon="layers" label={$t('haritaTuru.harita_turu_secili', { tur: turAdi(tur) })} onPress={() => setAcik(true)} style={style} />
      <Modal visible={acik} transparent animationType="slide" onRequestClose={() => setAcik(false)}>
        <Pressable style={styles.perde} onPress={() => setAcik(false)} accessibilityRole="button" accessibilityLabel={$t('ortak.kapat')} />
        <View style={styles.alt} pointerEvents="box-none">
          <View style={[styles.kart, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
            <View style={styles.ust}>
              <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
                {$t('haritaTuru.harita_turu')}
              </Txt>
              <IconButton icon="close" label={$t('ortak.kapat')} onPress={() => setAcik(false)} />
            </View>
            <View accessibilityRole="radiogroup" style={styles.turler}>
              {HARITA_TURLERI.map((t) => {
                const on = t === tur;
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={turAdi(t)}
                    onPress={() => {
                      haritaTuruSec(t);
                      setAcik(false);
                    }}
                    style={styles.tur}>
                    <View style={[styles.cerceve, on && styles.cerceveOn]}>
                      <Onizleme tur={t} />
                    </View>
                    <Txt style={{ fontFamily: on ? fontFamily.bodyBold : fontFamily.bodyMedium, fontSize: 13, color: on ? colors.sea : colors.ink }}>
                      {turAdi(t)}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
            {tur === 'kis' ? <Txt variant="small" style={{ marginTop: space.md }}>{$t('haritaTuru.kis_aciklama')}</Txt> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  perde: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 26, 23, 0.45)' },
  alt: { flex: 1, justifyContent: 'flex-end' },
  kart: { backgroundColor: colors.ground, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: space.lg, paddingTop: space.lg },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  turler: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  tur: { flex: 1, alignItems: 'center', gap: 6 },
  cerceve: { width: '100%', aspectRatio: 1, borderRadius: 16, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  cerceveOn: { borderColor: colors.sea },
  onizleme: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  leke: { position: 'absolute', width: '70%', height: '55%', right: '-15%', bottom: '-10%', borderRadius: 40 },
  yol: { position: 'absolute', height: 5, left: '-10%', right: '-10%', top: '42%', transform: [{ rotate: '-24deg' }] },
  pist: { position: 'absolute', width: 4, top: '-10%', bottom: '-10%', left: '38%', transform: [{ rotate: '18deg' }] },
});
