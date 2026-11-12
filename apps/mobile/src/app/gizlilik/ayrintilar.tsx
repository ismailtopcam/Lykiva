/** Gizlilik kontrolleri > Gizli ayrıntılar: hız ve molalar başkalarından gizlenir (sahibi hep görür) */
import { View } from 'react-native';

import { GizlilikSayfasi } from '@/components/GizlilikSayfasi';
import { Txt } from '@/components/Txt';
import { Card, ToggleRow } from '@/components/ui';
import { useGizlilikAyarlari } from '@/lib/gizlilik';
import { space } from '@/theme';
import { $t } from '@/i18n';

export default function GizliAyrintilarScreen() {
  const { ayar, hata, bayrak, girisGerekli } = useGizlilikAyarlari();

  return (
    <GizlilikSayfasi baslik={$t('gizlilik.ayrintilar')} girisGerekli={girisGerekli} hata={hata} hazir={!!ayar}>
      {ayar ? (
        <View style={{ gap: space.lg }}>
          <Txt variant="small">{$t('gizlilik.ayrintilar_alt')}</Txt>
          <Card style={{ paddingHorizontal: space.lg }}>
            <ToggleRow title={$t('gizlilik.gizli_hiz')} subtitle={$t('gizlilik.gizli_hiz_alt')} value={ayar.gizli_hiz} onChange={(v) => void bayrak('gizli_hiz', v)} />
            <ToggleRow
              title={$t('gizlilik.gizli_molalar')}
              subtitle={$t('gizlilik.gizli_molalar_alt')}
              value={ayar.gizli_molalar}
              onChange={(v) => void bayrak('gizli_molalar', v)}
            />
          </Card>
          <Txt variant="small">{$t('gizlilik.ayrintilar_baglanti')}</Txt>
        </View>
      ) : null}
    </GizlilikSayfasi>
  );
}
