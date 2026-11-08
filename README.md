# Lykiva

Bisiklet, koşu, yürüyüş ve doğa sporları için aktivite takibi, rota paylaşımı ve sosyal topluluk uygulaması.

Geliştirme notları ve yapılacaklar: [DEV_NOTES.md](DEV_NOTES.md)

## Depo yapısı

```
apps/
  mobile/     Expo (React Native) mobil uygulama — iOS + Android
  web/        Next.js — karşılama sayfası (/) ve yönetim paneli (/admin)
packages/
  shared/     Ortak kod: tasarım değerleri (renk, font, aralık), aktivite türleri, Türkçe biçimlendirme
supabase/
  migrations/ Veritabanı şeması (PostgreSQL + PostGIS)
```

Hepsi TypeScript; npm workspaces ile tek depoda.

## Kurulum

Gereken: Node.js 22+

```bash
npm install
```

## Çalıştırma

**Mobil uygulama — ilk kez**

`apps/mobile/.env.example` dosyasını `apps/mobile/.env` adıyla kopyala ve `EXPO_PUBLIC_SUPABASE_ANON_KEY`
satırına Coolify'daki anon anahtarını yaz (Coolify > lykiva-supabase > Environment Variables >
`SERVICE_SUPABASEANON_KEY`). Anahtar yoksa uygulama yine çalışır, kayıtlar telefonda bekler.

GPS kaydı yerel modül kullandığı için **Expo Go'da arka plan kaydı çalışmaz**; geliştirme derlemesiyle dene:

```bash
cd apps/mobile
npx expo run:ios --device     # iPhone kabloyla bağlıyken (Xcode gerekli)
npx expo run:android          # Android
```

iOS Simülatöründe konum: Features > Location > City Bicycle Ride / Freeway Drive.

**Mobil uygulama — günlük**

```bash
npm run mobile
```

Terminalde çıkan QR kodu telefondaki **Expo Go** uygulamasıyla okut. Telefon ve bilgisayar aynı ağda olmalı.

> **Harita:** Gerçek harita MapLibre ile çizilir ve Expo Go'da çalışmaz. Expo Go'da haritanın yerinde
> tasarımdaki stilize çizim görünür. Gerçek haritayı görmek için uygulamanın geliştirme derlemesi
> (development build) gerekir: `npx eas-cli build --profile development`. Harita stili
> `apps/mobile/.env` içindeki `EXPO_PUBLIC_MAP_STYLE_URL` ile değişir (örnek: `.env.example`).

**Web (karşılama + yönetim paneli)**

```bash
npm run web
```

Tarayıcıda http://localhost:3000 (karşılama) ve http://localhost:3000/admin (yönetim).

**Kontroller**

```bash
npm run typecheck   # tüm paketlerde TypeScript kontrolü
npm run web:build   # web üretim derlemesi
npm test -w @lykiva/shared   # GPS hesaplama testleri
```

## Aşamalar

1. **İskelet + tasarım + gezinme** — proje yapısı, ortak tasarım dili, mobil alt menü ve tüm ekranların kabukları, web karşılama sayfası ve yönetim paneli kabuğu, veritabanı şeması.
2. **Tasarımın koda dökülmesi** — 18 ekran örnek verilerle, MapLibre haritası, web için Dockerfile.
3. **Gerçek GPS kaydı** — ekran kapalıyken de kayıt (arka plan konum), duraklat/devam, mesafe/hız/tırmanış/mola hesapları (birim testli), çevrimdışı kuyruk, Supabase'e kaydetme, güvenlik kuralları (RLS), geçici (anonim) giriş, aktivite özeti ve hız/mola sayfası gerçek veriden.
4. Sırada: Google / Apple girişi, rota seçip "kalan km / varış süresi", paylaşım kartı.

## Sunucu

- Supabase (kendi sunucumuzda, Coolify): https://api.lykiva.ismailtopcam.dev
- Web: https://lykiva.ismailtopcam.dev (Coolify, `apps/web/Dockerfile`)
