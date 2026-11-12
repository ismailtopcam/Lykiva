/** Gizlilik kontrolleri > Engellenen hesaplar: liste ve engeli kaldırma (engelleme kişi sayfasından) */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { GizlilikSayfasi } from '@/components/GizlilikSayfasi';
import { Txt } from '@/components/Txt';
import { Avatar, Button, Card } from '@/components/ui';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { engellenenler, kisiEngelle, useGizlilikAyarlari, type EngellenenKisi } from '@/lib/gizlilik';
import { fontFamily, space } from '@/theme';
import { $t } from '@/i18n';

export default function EngellenenlerScreen() {
  const { girisGerekli } = useGizlilikAyarlari();
  const [liste, setListe] = useState<EngellenenKisi[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekleyen, setBekleyen] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (girisGerekli) return;
      let acik = true;
      engellenenler()
        .then((l) => acik && setListe(l))
        .catch((e) => acik && setHata(e instanceof Error ? e.message : String(e)));
      return () => {
        acik = false;
      };
    }, [girisGerekli]),
  );

  function kaldir(k: EngellenenKisi) {
    Alert.alert($t('gizlilik.engeli_kaldir'), $t('gizlilik.engeli_kaldir_metin', { ad: k.display_name }), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      {
        text: $t('gizlilik.engeli_kaldir'),
        onPress: async () => {
          setBekleyen(k.id);
          try {
            await kisiEngelle(k.id, false);
            setListe((l) => l?.filter((x) => x.id !== k.id) ?? l);
          } catch (e) {
            Alert.alert($t('ayarlar.yapilamadi'), e instanceof Error ? e.message : String(e));
          } finally {
            setBekleyen(null);
          }
        },
      },
    ]);
  }

  return (
    <GizlilikSayfasi baslik={$t('gizlilik.engellenenler')} girisGerekli={girisGerekli} hata={hata} hazir={liste !== null}>
      <Txt variant="small">{$t('gizlilik.engellenenler_alt')}</Txt>
      {liste && liste.length === 0 ? <Txt variant="muted">{$t('gizlilik.engellenen_yok')}</Txt> : null}
      {liste && liste.length > 0 ? (
        <Card style={{ paddingHorizontal: space.lg }}>
          {liste.map((k) => (
            <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/kisi/[id]', params: { id: k.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <Avatar initials={basHarfler(k.display_name)} tone={grupRengi(k.id)} size={40} uri={k.avatar_url} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                    {k.display_name}
                  </Txt>
                  <Txt variant="small" numberOfLines={1}>
                    @{k.username}
                  </Txt>
                </View>
              </Pressable>
              <Button variant="outline" label={$t('gizlilik.engeli_kaldir')} onPress={() => kaldir(k)} disabled={bekleyen === k.id} />
            </View>
          ))}
        </Card>
      ) : null}
    </GizlilikSayfasi>
  );
}
