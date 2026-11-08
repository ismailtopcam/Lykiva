import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { colors, fontFamily } from '@/theme';

function tabIcon(name: IconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <Icon
        name={name}
        color={typeof color === 'string' ? color : colors.ink}
        size={23}
        strokeWidth={focused ? 2 : 1.8}
      />
    );
  }
  return TabIcon;
}

/**
 * Alt menü: Akış · Keşfet · [Kayıt] · Gruplar · Profil
 * Ortadaki büyük buton bir sekme değil; kayıt başlatma ekranını açar.
 */
export default function TabsLayout() {
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
      <Tabs.Screen name="index" options={{ title: 'Akış', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="kesfet" options={{ title: 'Keşfet', tabBarIcon: tabIcon('compass') }} />
      <Tabs.Screen
        name="kaydet"
        options={{
          title: 'Kayıt',
          tabBarAccessibilityLabel: 'Kayıt başlat',
          tabBarButton: () => (
            <View style={styles.recordSlot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kayıt başlat"
                onPress={() => router.push('/kayit')}
                style={({ pressed }) => [styles.recordButton, pressed && { backgroundColor: colors.terraPressed }]}>
                <Icon name="plus" color="#FFFFFF" size={26} strokeWidth={2.4} />
              </Pressable>
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/kayit');
          },
        }}
      />
      <Tabs.Screen name="gruplar" options={{ title: 'Gruplar', tabBarIcon: tabIcon('users') }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  recordSlot: { flex: 1, alignItems: 'center' },
  recordButton: {
    width: 58,
    height: 58,
    marginTop: -14,
    borderRadius: 29,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.terra,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
