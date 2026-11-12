/** Gizlilik kontrolleri > Harita görünürlüğü: yeni kayıtlarda başlangıç / bitiş gizleme; geçmişe uygulama */
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { GizlilikSayfasi } from '@/components/GizlilikSayfasi';
import { Txt } from '@/components/Txt';
import { Button, Card, ToggleRow } from '@/components/ui';
import { gecmisiDuzenle, useGizlilikAyarlari } from '@/lib/gizlilik';
import { space } from '@/theme';
import { $t } from '@/i18n';

export default function HaritaGorunurluguScreen() {
  const { ayar, hata, bayrak, girisGerekli } = useGizlilikAyarlari();
  const [mesgul, setMesgul] = useState(false);

  function gecmiseUygula() {
    if (!ayar) return;
    const gizle = ayar.uclari_gizle;
    Alert.alert($t('gizlilik.harita'), gizle ? $t('gizlilik.harita_gecmis_gizle') : $t('gizlilik.harita_gecmis_goster'), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      {
        text: $t('gizlilik.hepsine_uygula'),
        onPress: async () => {
          setMesgul(true);
          try {
            const n = await gecmisiDuzenle(null, gizle);
            Alert.alert($t('gizlilik.harita'), $t('gizlilik.degisti', { n: Number(n) || 0 }));
          } catch (e) {
            Alert.alert($t('ayarlar.yapilamadi'), e instanceof Error ? e.message : String(e));
          } finally {
            setMesgul(false);
          }
        },
      },
    ]);
  }

  return (
    <GizlilikSayfasi baslik={$t('gizlilik.harita')} girisGerekli={girisGerekli} hata={hata} hazir={!!ayar}>
      {ayar ? (
        <View style={{ gap: space.lg }}>
          <Card style={{ paddingHorizontal: space.lg }}>
            <ToggleRow
              title={$t('gizlilik.uclari_gizle')}
              subtitle={$t('gizlilik.uclari_gizle_alt')}
              value={ayar.uclari_gizle}
              onChange={(v) => void bayrak('uclari_gizle', v)}
            />
          </Card>
          <Txt variant="small">{$t('gizlilik.harita_not')}</Txt>
          <Button variant="outline" label={mesgul ? $t('gizlilik.uygulaniyor') : $t('gizlilik.gecmise_uygula')} onPress={gecmiseUygula} disabled={mesgul} />
        </View>
      ) : null}
    </GizlilikSayfasi>
  );
}
