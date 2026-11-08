import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Arka plan konum görevi uygulama açılır açılmaz tanımlanmalı
import { kaydiGeriYukle } from '@/kayit/kaydedici';
import { kuyruguGonder } from '@/kayit/kuyruk';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // Yarım kalan kaydı geri yükle; bekleyen kayıtları uygulama her öne geldiğinde göndermeyi dene
  useEffect(() => {
    void kaydiGeriYukle();
    void kuyruguGonder().catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void kuyruguGonder().catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="giris" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="giris-donus" options={{ animation: 'none' }} />
        <Stack.Screen name="kayit/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="rota/sec" options={{ presentation: 'modal' }} />
        <Stack.Screen name="kayit/canli" options={{ gestureEnabled: false }} />
        <Stack.Screen name="kayit/duraklatildi" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
