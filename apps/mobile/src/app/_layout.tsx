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
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Arka plan konum görevi uygulama açılır açılmaz tanımlanmalı
import { kaydiGeriYukle } from '@/kayit/kaydedici';
import { bildirimHedefi } from '@/bildirim/bildirimler';
import { kuyruguGonder } from '@/kayit/kuyruk';
import { haritaIstekleriniAyarla } from '@/lib/cevrimdisi';
import { pushTazele } from '@/lib/push';
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
  // Telefon bildirimi: jetonu tazele; bildirime dokununca ilgili sayfayı aç (uygulama kapalıyken de)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void pushTazele();
    const ac = (r: Notifications.NotificationResponse | null) => {
      const hedef = r ? bildirimHedefi(r.notification.request.content.data as Record<string, string>) : null;
      if (hedef) router.push(hedef);
    };
    ac(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(ac);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    haritaIstekleriniAyarla();
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
        <Stack.Screen name="grup/olustur" options={{ presentation: 'modal' }} />
        <Stack.Screen name="etkinlik/olustur" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profil-duzenle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="aktivite/[id]/duzenle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="rota/[id]/duzenle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="grup/[id]/rota-paylas" options={{ presentation: 'modal' }} />
        <Stack.Screen name="kayit/canli" options={{ gestureEnabled: false }} />
        <Stack.Screen name="kayit/duraklatildi" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
