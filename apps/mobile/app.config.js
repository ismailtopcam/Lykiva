/**
 * app.json'u temel alır. "Apple ile giriş" yetkisi yalnızca ücretli Apple Developer hesabıyla
 * imzalanabilir; ücretsiz hesapla telefona derlerken .env'de EXPO_PUBLIC_APPLE_GIRIS=0 yap.
 */
const { createRunOncePlugin } = require('expo/config-plugins');

// Paket kurulu olduğu için Expo eklentisini kendiliğinden uygular; aynı adla boş bir
// eklenti önce kaydedilince asıl eklenti (ve yetki) atlanır.
const appleGirisiKapali = createRunOncePlugin((config) => config, 'expo-apple-authentication');

module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_APPLE_GIRIS !== '0') return config;
  return {
    ...config,
    ios: { ...config.ios, usesAppleSignIn: false },
    plugins: [appleGirisiKapali, ...(config.plugins ?? []).filter((p) => p !== 'expo-apple-authentication')],
  };
};
