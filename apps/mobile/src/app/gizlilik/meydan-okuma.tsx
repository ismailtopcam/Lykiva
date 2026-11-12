/** Gizlilik kontrolleri > Meydan okuma katılımı: sıralamada adını kim görür */
import { Alert, View } from 'react-native';

import { DuzeySecici } from '@/components/DuzeySecici';
import { GizlilikSayfasi } from '@/components/GizlilikSayfasi';
import { Txt } from '@/components/Txt';
import { Card } from '@/components/ui';
import { duzeyAyarla, useGizlilikAyarlari, type Duzey } from '@/lib/gizlilik';
import { space } from '@/theme';
import { $t } from '@/i18n';

export default function MeydanOkumaGizliligiScreen() {
  const { ayar, hata, degistir, girisGerekli } = useGizlilikAyarlari();

  async function sec(d: Duzey) {
    if (!ayar || ayar.meydan_okuma_gizliligi === d) return;
    const once = ayar.meydan_okuma_gizliligi;
    degistir({ meydan_okuma_gizliligi: d });
    try {
      await duzeyAyarla('meydan_okuma_gizliligi', d);
    } catch (e) {
      degistir({ meydan_okuma_gizliligi: once });
      Alert.alert($t('ayarlar.yapilamadi'), e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <GizlilikSayfasi baslik={$t('gizlilik.meydan')} girisGerekli={girisGerekli} hata={hata} hazir={!!ayar}>
      {ayar ? (
        <View style={{ gap: space.lg }}>
          <Card style={{ padding: space.lg, gap: space.md }}>
            <Txt variant="small">{$t('gizlilik.meydan_alt')}</Txt>
            <DuzeySecici deger={ayar.meydan_okuma_gizliligi} etiket={$t('gizlilik.meydan')} onSec={(d) => void sec(d)} />
          </Card>
        </View>
      ) : null}
    </GizlilikSayfasi>
  );
}
