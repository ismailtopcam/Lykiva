import { router } from 'expo-router';
import { View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { Logo } from '@/components/Logo';
import { ScreenShell } from '@/components/ScreenShell';

export default function AkisScreen() {
  return (
    <ScreenShell
      title="Akış"
      showBack={false}
      header={<Logo />}
      right={
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="search" label="Ara" />
          <IconButton icon="chat" label="Mesajlar" onPress={() => router.push('/grup/ornek/sohbet')} />
          <IconButton icon="bell" label="Bildirimler" />
        </View>
      }
      plan={[
        '"Şu an yolda" şeridi: canlı paylaşan arkadaşlar',
        'Takip ettiklerim / Gruplarım / Yakınımda filtresi',
        'Aktivite kartları: harita, mesafe, tırmanış, süre, ortalama hız, birlikte yapılan kişiler',
        'Beğen, yorum, rotayı kaydet, paylaş',
      ]}
      links={[
        { label: 'Örnek aktivite özeti', href: '/aktivite/ornek' },
        { label: 'Canlı arkadaş haritası', href: '/canli-harita' },
        { label: 'Paylaşım stüdyosu', href: '/aktivite/ornek/paylas' },
      ]}
    />
  );
}
