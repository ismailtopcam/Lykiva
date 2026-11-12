/**
 * Gizlilik kontrolleri > Kişisel bilgilerimi paylaşmayın: tercih kaydı (profiles.kisisel_veri_paylasimi_kapali).
 * Lykiva bugün kişisel bilgi satmıyor ve reklam / pazarlama için paylaşmıyor; metin bunu ve hizmet için
 * gereken veri akışlarını anlatır. İleride böyle bir paylaşım eklenirse bu tercihe uyulmalı.
 */
import { View } from 'react-native';

import { GizlilikSayfasi } from '@/components/GizlilikSayfasi';
import { Txt } from '@/components/Txt';
import { Card, ToggleRow } from '@/components/ui';
import { useGizlilikAyarlari } from '@/lib/gizlilik';
import { space } from '@/theme';
import { $t } from '@/i18n';

export default function KisiselBilgilerScreen() {
  const { ayar, hata, bayrak, girisGerekli } = useGizlilikAyarlari();

  return (
    <GizlilikSayfasi baslik={$t('gizlilik.kisisel')} girisGerekli={girisGerekli} hata={hata} hazir={!!ayar}>
      {ayar ? (
        <View style={{ gap: space.lg }}>
          <Card style={{ paddingHorizontal: space.lg }}>
            <ToggleRow
              title={$t('gizlilik.kisisel_anahtar')}
              subtitle={$t('gizlilik.kisisel_anahtar_alt')}
              value={ayar.kisisel_veri_paylasimi_kapali}
              onChange={(v) => void bayrak('kisisel_veri_paylasimi_kapali', v)}
            />
          </Card>
          <Txt variant="small">{$t('gizlilik.kisisel_bugun')}</Txt>
          <Txt variant="small">{$t('gizlilik.kisisel_hizmet')}</Txt>
        </View>
      ) : null}
    </GizlilikSayfasi>
  );
}
