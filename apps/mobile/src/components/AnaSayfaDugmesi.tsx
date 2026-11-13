import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors } from '@/theme';
import { $t } from '@/i18n';

const n = colors.night;

/**
 * Kayıt ekranlarından (canlı / duraklatıldı) ana sayfaya döner; kayıt arka planda sürer.
 * Android'de donanım geri tuşu aynı işi görüyor; iOS'ta bu ekranlarda geri kaydırma kapalı (haritada yanlışlıkla
 * çıkılmasın diye), o yüzden düğme şart. Kayda geri dönmek için alt menüdeki Egzersiz yeterli.
 */
export function AnaSayfaDugmesi({ boy = 36 }: { boy?: number }) {
  function don() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={$t('kayit_canli.ana_sayfaya_don')}
      onPress={don}
      hitSlop={6}
      style={({ pressed }) => [styles.dugme, { width: boy, height: boy, borderRadius: boy / 2 }, pressed && { opacity: 0.6 }]}>
      <Icon name="home" size={Math.round(boy * 0.5)} color={n.text} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dugme: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,21,18,0.85)',
    borderWidth: 1,
    borderColor: n.line,
  },
});
