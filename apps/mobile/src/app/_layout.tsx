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
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Arka plan konum görevi uygulama açılır açılmaz tanımlanmalı
import { kaydiGeriYukle, kayitSuruyor, konumuIsit } from '@/kayit/kaydedici';
import { bildirimHedefi } from '@/bildirim/bildirimler';
import { kuyruguGonder } from '@/kayit/kuyruk';
import { dilDegisikliginiDinle, dilYukle, useDil } from '@/i18n';
import { haritaIstekleriniAyarla } from '@/lib/cevrimdisi';
import { bildirimDiliniGuncelle } from '@/lib/dilSunucu';
import { pushTazele } from '@/lib/push';
import { cihazSemasiniDinle, colors, gorunumYukle, useSema } from '@/theme';

SplashScreen.preventAutoHideAsync();

/** Kayıt ekranlarının geçişi: sekme geçişine yakın, kısa solma (süre yalnızca iOS'ta ayarlanabiliyor) */
const kayitGecisi = { animation: 'fade', animationDuration: 200 } as const;

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  // Saklanan dil seçimini oku; o zamana kadar açılış ekranı kalır. Dil değişince bütün ekranlar yeniden kurulur.
  const [dilHazir, setDilHazir] = useState(false);
  const dil = useDil();
  useEffect(() => {
    void dilYukle().finally(() => {
      setDilHazir(true);
      void bildirimDiliniGuncelle();
    });
    return dilDegisikliginiDinle(() => void bildirimDiliniGuncelle());
  }, []);

  // Görünüm (telefonun teması / aydınlık / karanlık) da açılışta okunur; tema değişince de ekranlar yeniden kurulur.
  // Telefonun teması kayıt sürerken değişirse ekranlar baştan kurulmasın diye bir sonraki öne gelişe kalır.
  const [temaHazir, setTemaHazir] = useState(false);
  const sema = useSema();
  useEffect(() => {
    void gorunumYukle().finally(() => setTemaHazir(true));
    return cihazSemasiniDinle(kayitSuruyor);
  }, []);

  useEffect(() => {
    if ((loaded || error) && dilHazir && temaHazir) SplashScreen.hideAsync();
  }, [loaded, error, dilHazir, temaHazir]);

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
    // Kayıt geri yüklendikten sonra konum önceden alınır: Harita sekmesine geçince harita beklemeden konuma gelir
    void kaydiGeriYukle().then(() => konumuIsit());
    void kuyruguGonder().catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void kuyruguGonder().catch(() => undefined);
      void konumuIsit();
    });
    return () => sub.remove();
  }, []);

  if ((!loaded && !error) || !dilHazir || !temaHazir) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={sema === 'koyu' ? 'light' : 'dark'} />
      <Stack key={`${dil}-${sema}`} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="giris" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="giris-donus" options={{ animation: 'none' }} />
        {/* Kayıt ekranları sekmeler gibi kısa solmayla açılır. Eskiden başlat ekranı iOS'ta aşağıdan kayan kart
            (modal) idi, canlı ekran yandan kayıyordu: Egzersiz sekmesi diğerlerinden farklı geçiyordu. */}
        <Stack.Screen name="kayit/index" options={{ ...kayitGecisi, gestureEnabled: false }} />
        <Stack.Screen name="grup/olustur" options={{ presentation: 'modal' }} />
        <Stack.Screen name="etkinlik/olustur" options={{ presentation: 'modal' }} />
        <Stack.Screen name="hedef-ekle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meydan-okuma/olustur" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profil-duzenle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="aktivite/[id]/duzenle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="rota/[id]/duzenle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="grup/[id]/rota-paylas" options={{ presentation: 'modal' }} />
        <Stack.Screen name="kayit/canli" options={{ ...kayitGecisi, gestureEnabled: false }} />
        <Stack.Screen name="kayit/duraklatildi" options={{ ...kayitGecisi, gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
