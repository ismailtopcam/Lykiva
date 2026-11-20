import { Redirect, router, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { type ColorValue, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { kayitEkrani, useKayitDurumu } from '@/kayit/kaydedici';
import { useGirisGerekli, useHesap } from '@/lib/giris';
import { pushGiristen } from '@/lib/push';
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

/** Giriş durumu bu süre içinde belli olmazsa sekmeler yine de açılır (internetsiz açılışta oturum yenilemesi uzayabilir) */
const GIRIS_BEKLEME_MS = 800;

/**
 * Alt menü: Ana Sayfa · Harita · Gruplar · Profil
 * Egzersiz başlatmak Harita sekmesinde ("Egzersiz yap"). Kayıt sürerken (ya da duraklatılmışken) araya Egzersiz
 * sekmesi girer: bir ekran değil, basınca süren kaydı açar; kayıt bitince yine kaybolur.
 * Dosya adları (index, kesfet, kaydet) bağlantılar bozulmasın diye aynı kaldı.
 * Sekmeler arası geçiş ve kayıt ekranlarının açılışı aynı kısa solma (fade) ile; bkz. kök `_layout.tsx`.
 */
export default function TabsLayout() {
  // İlk açılışta giriş ekranı. Durum kısa sürede belli olmazsa sekmeler gösterilir (internetsiz açılışı bekletmemek için).
  const girisGerekli = useGirisGerekli();
  const kayitSuruyor = useKayitDurumu() !== 'bos';
  // Telefon bildirimi: giriş yapılınca izin bir kez sorulur, jeton bu hesaba kaydedilir (hesap değişince yeniden)
  const hesap = useHesap();
  const kayitliHesap = hesap && !hesap.gecici ? hesap.id : null;
  useEffect(() => {
    if (kayitliHesap) void pushGiristen();
  }, [kayitliHesap]);
  const [beklemeBitti, setBeklemeBitti] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBeklemeBitti(true), GIRIS_BEKLEME_MS);
    return () => clearTimeout(t);
  }, []);
  if (girisGerekli) return <Redirect href="/giris" />;
  // Sekmeler kurulup hemen giriş ekranına geçilirse sekme gezgininin açılışta sıraya koyduğu
  // ROUTE_NAMES_CHANGED işlenemiyor ("was not handled by any navigator" uyarısı). Durum belli olana
  // kadar boş zemin gösterilir; ilk kurulumda oturum telefonda olmadığı için bu birkaç milisaniye sürer.
  if (girisGerekli === undefined && !beklemeBitti) return <View style={{ flex: 1, backgroundColor: colors.ground }} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
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
      <Tabs.Screen name="kesfet" options={{ title: $t('sekmeler.harita'), tabBarIcon: tabIcon('map') }} />
      <Tabs.Screen
        name="kaydet"
        options={{
          // Kayıt yokken menüde görünmez
          ...(kayitSuruyor ? null : { href: null }),
          title: $t('sekmeler.egzersiz'),
          tabBarAccessibilityLabel: $t('harita.kayda_don'),
          tabBarIcon: tabIcon('record', colors.terra),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            // Kayıt sürüyorsa doğrudan o ekrana: önce başlat ekranı açılıp sonra yönlendirilince iki geçiş üst üste biniyordu
            router.push(kayitEkrani());
          },
        }}
      />
      <Tabs.Screen name="gruplar" options={{ title: $t('sekmeler.gruplar'), tabBarIcon: tabIcon('users') }} />
      <Tabs.Screen name="profil" options={{ title: $t('sekmeler.profil'), tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
