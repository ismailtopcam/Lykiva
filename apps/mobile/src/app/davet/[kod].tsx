import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/ui';
import { davetleKatil } from '@/grup/gruplar';
import { supabaseHazir } from '@/lib/supabase';
import { colors, space } from '@/theme';
import { $t } from '@/i18n';

/** Davet bağlantısı: lykiva://davet/KOD → gruba katıl ve grup sayfasını aç */
export default function DavetScreen() {
  const { kod } = useLocalSearchParams<{ kod: string }>();
  const [hata, setHata] = useState<string | null>(supabaseHazir ? null : $t('davet.sunucu_anahtari_girilmemis'));

  useEffect(() => {
    if (!kod || !supabaseHazir) return;
    let acik = true;
    davetleKatil(kod)
      .then((id) => acik && router.replace({ pathname: '/grup/[id]', params: { id } }))
      .catch((e: unknown) => acik && setHata(e instanceof Error ? e.message : $t('davet.katilinamadi')));
    return () => {
      acik = false;
    };
  }, [kod]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <Header title={$t('davet.grup_daveti')} backIcon="close" />
      <View style={{ padding: space.lg, gap: space.md, alignItems: 'center' }}>
        {hata ? (
          <>
            <Txt variant="muted" style={{ textAlign: 'center' }}>
              {hata}
            </Txt>
            <Button label={$t('davet.gruplara_git')} href="/gruplar" variant="outline" />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.terra} />
            <Txt variant="muted">{$t('davet.gruba_katiliyorsun')}</Txt>
          </>
        )}
      </View>
    </View>
  );
}
