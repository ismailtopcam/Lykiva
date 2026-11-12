/**
 * Harita üstündeki katman düğmesi ve seçim penceresi: harita türü (standart, uydu, hibrit, kış) ve
 * ısı haritası (küresel, haftalık, gece, kişisel). Seçimler bütün haritalara uygulanır
 * (bkz. haritaTurleri.ts, isiHaritasi.ts).
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Chip } from '@/components/ui';
import { $t } from '@/i18n';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { HARITA_TURLERI, haritaTuruSec, useHaritaTuru, type HaritaTuru } from './haritaTurleri';
import { ISI_TURLERI, isiTuruSec, useIsiTuru, type IsiTuru } from './isiHaritasi';

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

function isiAdi(t: IsiTuru): string {
  switch (t) {
    case 'kuresel':
      return $t('haritaTuru.isi_kuresel');
    case 'haftalik':
      return $t('haritaTuru.isi_haftalik');
    case 'gece':
      return $t('haritaTuru.isi_gece');
    case 'kisisel':
      return $t('haritaTuru.isi_kisisel');
  }
}

function isiAciklamasi(t: IsiTuru): string {
  switch (t) {
    case 'kuresel':
      return $t('haritaTuru.isi_kuresel_aciklama');
    case 'haftalik':
      return $t('haritaTuru.isi_haftalik_aciklama');
    case 'gece':
      return $t('haritaTuru.isi_gece_aciklama');
    case 'kisisel':
      return $t('haritaTuru.isi_kisisel_aciklama');
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
  const isi = useIsiTuru();
  const insets = useSafeAreaInsets();
  return (
    <>
      <IconButton floating icon="layers" label={
          isi
            ? $t('haritaTuru.harita_turu_secili_isi', { tur: turAdi(tur), isi: isiAdi(isi) })
            : $t('haritaTuru.harita_turu_secili', { tur: turAdi(tur) })
        } onPress={() => setAcik(true)} style={style} />
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

            {supabaseHazir ? (
              <>
                <Txt accessibilityRole="header" style={styles.bolum}>
                  {$t('haritaTuru.isi_haritasi')}
                </Txt>
                <View accessibilityRole="radiogroup" style={styles.cipler}>
                  <Chip label={$t('haritaTuru.isi_kapali')} role="radio" selected={!isi} onPress={() => isiTuruSec(null)} />
                  {ISI_TURLERI.map((t) => (
                    <Chip key={t} label={isiAdi(t)} role="radio" selected={isi === t} onPress={() => isiTuruSec(t)} />
                  ))}
                </View>
                {isi ? (
                  <Txt variant="small" style={{ marginTop: space.sm }}>
                    {isiAciklamasi(isi)}
                    {isi !== 'kisisel' ? ' ' + $t('haritaTuru.isi_gizlilik') : ''}
                  </Txt>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  perde: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 26, 23, 0.45)' },
  alt: { flex: 1, justifyContent: 'flex-end' },
  kart: { backgroundColor: colors.ground, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: space.lg, paddingTop: space.lg },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  turler: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  tur: { flex: 1, alignItems: 'center', gap: 6 },
  bolum: { fontFamily: fontFamily.bodyBold, fontSize: 15, marginTop: space.lg, marginBottom: space.sm },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cerceve: { width: '100%', aspectRatio: 1, borderRadius: 16, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  cerceveOn: { borderColor: colors.sea },
  onizleme: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  leke: { position: 'absolute', width: '70%', height: '55%', right: '-15%', bottom: '-10%', borderRadius: 40 },
  yol: { position: 'absolute', height: 5, left: '-10%', right: '-10%', top: '42%', transform: [{ rotate: '-24deg' }] },
  pist: { position: 'absolute', width: 4, top: '-10%', bottom: '-10%', left: '38%', transform: [{ rotate: '18deg' }] },
}));
