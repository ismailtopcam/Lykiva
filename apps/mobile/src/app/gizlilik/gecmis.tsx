/** Gizlilik kontrolleri > Geçmiş aktiviteleri düzenle: bütün aktivitelerin görünürlüğü ve uç gizleme, tek seferde */
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { GizlilikSayfasi } from '@/components/GizlilikSayfasi';
import { Txt } from '@/components/Txt';
import { Button, Card, Chip, Label } from '@/components/ui';
import { gecmisiDuzenle, useGizlilikAyarlari, type GecmisGorunurluk } from '@/lib/gizlilik';
import { space } from '@/theme';
import { $t } from '@/i18n';

const GORUNURLUKLER = (): [GecmisGorunurluk, string][] => [
  ['public', $t('ortak.herkese_acik')],
  ['followers', $t('ortak.takipciler')],
  ['groups', $t('ortak.gruplarim')],
  ['private', $t('ortak.sadece_ben')],
];

type Uclar = 'degistirme' | 'gizle' | 'goster';

export default function GecmisAktivitelerScreen() {
  const { ayar, hata, girisGerekli } = useGizlilikAyarlari();
  const [gorunurluk, setGorunurluk] = useState<GecmisGorunurluk | null>(null);
  const [uclar, setUclar] = useState<Uclar>('degistirme');
  const [mesgul, setMesgul] = useState(false);

  const uclarDegeri = uclar === 'degistirme' ? null : uclar === 'gizle';
  const secimVar = gorunurluk != null || uclarDegeri != null;

  function uygula() {
    if (!secimVar) return;
    Alert.alert($t('gizlilik.gecmis'), $t('gizlilik.gecmis_onay'), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      {
        text: $t('gizlilik.hepsine_uygula'),
        style: 'destructive',
        onPress: async () => {
          setMesgul(true);
          try {
            const n = await gecmisiDuzenle(gorunurluk, uclarDegeri);
            Alert.alert($t('gizlilik.gecmis'), $t('gizlilik.degisti', { n: Number(n) || 0 }));
            setGorunurluk(null);
            setUclar('degistirme');
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
    <GizlilikSayfasi baslik={$t('gizlilik.gecmis')} girisGerekli={girisGerekli} hata={hata} hazir={!!ayar}>
      <Txt variant="small">{$t('gizlilik.gecmis_alt')}</Txt>
      <View>
        <Label>{$t('gizlilik.gecmis_gorunurluk')}</Label>
        <Card style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            {GORUNURLUKLER().map(([id, ad]) => (
              <Chip key={id} label={ad} role="radio" selected={gorunurluk === id} onPress={() => setGorunurluk(gorunurluk === id ? null : id)} />
            ))}
          </View>
        </Card>
      </View>
      <View>
        <Label>{$t('gizlilik.uclari_gizle')}</Label>
        <Card style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            {(
              [
                ['degistirme', $t('gizlilik.degistirme')],
                ['gizle', $t('gizlilik.gizle')],
                ['goster', $t('gizlilik.goster')],
              ] as [Uclar, string][]
            ).map(([id, ad]) => (
              <Chip key={id} label={ad} role="radio" selected={uclar === id} onPress={() => setUclar(id)} />
            ))}
          </View>
        </Card>
      </View>
      <Button label={mesgul ? $t('gizlilik.uygulaniyor') : $t('gizlilik.uygula')} onPress={uygula} disabled={!secimVar || mesgul} />
    </GizlilikSayfasi>
  );
}
