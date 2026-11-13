/**
 * Yol haritası: Harita sekmesinin (yol tarifi) ve egzersiz kaydının ortak haritası.
 *
 * - Yol eğime göre renkli; kayıtta tamamlanan kısım rota renginde (mor), kalan kısım eğim renginde.
 * - Sağ sütunda, katman düğmesinin altında 3B/2B ve konum düğmeleri.
 * İki ekranda da görünmesi gereken harita değişiklikleri buraya yapılır.
 */
import type { RoutePoint } from '@lykiva/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRotaEgim, type RotaEgim } from '@/components/EgimProfili';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import type { LngLat } from '@/data/ornek';
import { colors, fontFamily, temaliStil } from '@/theme';
import { $t } from '@/i18n';
import { gercekHarita, TopoMap, type MapMarker, type TopoMapProps } from './TopoMap';

const BOS: RoutePoint[] = [];

type Props = {
  /** Yol ya da takip edilen rota (rakımlıysa eğime göre renklenir); yoksa boş dizi */
  points: RoutePoint[];
  /** Rota yokken çizilecek iz (kayıtta şimdiye kadar gidilen yol) */
  iz?: LngLat[];
  /** 0..1, kayıtta rotanın tamamlanan kısmı */
  progress?: number;
  /** Eğim ekranda zaten hesaplandıysa (profil için) tekrar hesaplanmasın; verilmezse points'ten hesaplanır */
  egim?: RotaEgim | null;
  /** Bulunduğun yer; işareti ve konum düğmesi için */
  ben: LngLat | null;
  /** Bulunduğun yer dışındaki işaretler (bitiş, imleç…) */
  markers?: MapMarker[];
  /** Konum düğmesine basınca */
  onKonum: () => void;
  /** Konum düğmesi seçili görünsün (kayıtta takip açık) */
  konumSecili?: boolean;
  /** Ekran koyu (kayıt): düğmeler koyu çizilir */
  koyu?: boolean;
  /** Katman düğmesinin haritanın üstünden uzaklığı; 3B ve konum düğmeleri onun altında */
  ustBosluk: number;
} & Pick<TopoMapProps, 'style' | 'padding' | 'follow' | 'followZoom' | 'onKullaniciOynatti' | 'onPress' | 'accessibilityLabel'>;

export function YolHaritasi({ points, iz, progress, egim: verilenEgim, ben, markers = [], onKonum, konumSecili, koyu, ustBosluk, ...harita }: Props) {
  const [ucBoyut, setUcBoyut] = useState(false);
  const hesaplanan = useRotaEgim(verilenEgim === undefined ? points : BOS);
  const egim = verilenEgim === undefined ? hesaplanan : verilenEgim;
  const route: LngLat[] | undefined = points.length > 1 ? points.map((p) => [p.lng, p.lat]) : iz;
  const s = koyu ? styles.koyu : styles.acik;

  return (
    <>
      <TopoMap
        {...harita}
        dark={koyu}
        route={route}
        routeColors={points.length > 1 ? egim?.renkler : undefined}
        progress={progress}
        markers={[...markers, ...(ben ? [{ id: 'me', coord: ben, kind: 'me' as const }] : [])]}
        ucBoyut={ucBoyut}
        katmanDugmesi={{ top: ustBosluk }}
      />
      <View style={[styles.sutun, { top: ustBosluk + 44 + 10 }]} pointerEvents="box-none">
        {gercekHarita ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: ucBoyut }}
            accessibilityLabel={$t('kayit_canli.uc_boyutlu_gorunum')}
            onPress={() => setUcBoyut((u) => !u)}
            hitSlop={4}
            style={({ pressed }) => [styles.dugme, s.dugme, pressed && { opacity: 0.6 }]}>
            <Txt style={[styles.yazi, s.yazi, ucBoyut && s.secili]}>{ucBoyut ? '3D' : '2D'}</Txt>
          </Pressable>
        ) : null}
        {ben ? (
          <Pressable
            accessibilityRole={konumSecili === undefined ? 'button' : 'switch'}
            accessibilityState={konumSecili === undefined ? undefined : { checked: konumSecili }}
            accessibilityLabel={$t('harita.konumuma_git')}
            onPress={onKonum}
            hitSlop={4}
            style={({ pressed }) => [styles.dugme, s.dugme, pressed && { opacity: 0.6 }]}>
            <Icon name="target" size={22} color={konumSecili ? s.secili.color : s.yazi.color} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const styles = temaliStil(() => ({
  ...StyleSheet.create({
    sutun: { position: 'absolute', right: 16, gap: 10, zIndex: 10 },
    dugme: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    yazi: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  }),
  // Açık ekran (Harita sekmesi): IconButton'un floating görünümü
  acik: StyleSheet.create({
    dugme: {
      backgroundColor: colors.surface,
      shadowColor: colors.ink,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    yazi: { color: colors.ink },
    secili: { color: colors.sea },
  }),
  // Koyu ekran (kayıt)
  koyu: StyleSheet.create({
    dugme: { backgroundColor: 'rgba(14,21,18,0.85)', borderWidth: 1, borderColor: colors.night.line },
    yazi: { color: colors.night.text },
    secili: { color: colors.night.accent },
  }),
}));
