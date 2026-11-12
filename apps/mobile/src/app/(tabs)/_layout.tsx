import { Redirect, router, Tabs } from 'expo-router';
import { type ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { useGirisGerekli } from '@/lib/giris';
import { colors, fontFamily } from '@/theme';
import { $t } from '@/i18n';

function tabIcon(name: IconName, sabitRenk?: string) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <Icon
        name={name}
        color={sabitRenk ?? (typeof color === 'string' ? color : colors.ink)}
        size={23}
        strokeWidth={focused ? 2 : 1.8}
      />
    );
  }
  return TabIcon;
}

/**
 * Alt menü: Ana Sayfa · Haritalar · Egzersiz · Gruplar · Profil
 * Egzersiz bir ekran değil; basınca kayıt başlatma ekranını açar.
 * Dosya adları (index, kesfet, kaydet) bağlantılar bozulmasın diye aynı kaldı.
 */
export default function TabsLayout() {
  // İlk açılışta giriş ekranı. Durum bilinene kadar sekmeler gösterilir (internetsiz açılışı bekletmemek için).
  const girisGerekli = useGirisGerekli();
  if (girisGerekli) return <Redirect href="/giris" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontFamily: fontFamily.bodySemiBold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 86,
          paddingTop: 6,
        },
        sceneStyle: { backgroundColor: colors.ground },
      }}>
      <Tabs.Screen name="index" options={{ title: $t('sekmeler.ana_sayfa'), tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="kesfet" options={{ title: $t('sekmeler.haritalar'), tabBarIcon: tabIcon('map') }} />
      <Tabs.Screen
        name="kaydet"
        options={{
          title: $t('sekmeler.egzersiz'),
          tabBarAccessibilityLabel: $t('sekmeler.egzersiz_baslat'),
          tabBarIcon: tabIcon('record', colors.terra),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/kayit');
          },
        }}
      />
      <Tabs.Screen name="gruplar" options={{ title: $t('sekmeler.gruplar'), tabBarIcon: tabIcon('users') }} />
      <Tabs.Screen name="profil" options={{ title: $t('sekmeler.profil'), tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
