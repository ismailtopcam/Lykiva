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

**Mobil uygulama**

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
```

## Aşamalar

1. **İskelet + tasarım + gezinme** — proje yapısı, ortak tasarım dili, mobil alt menü ve tüm ekranların kabukları, web karşılama sayfası ve yönetim paneli kabuğu, veritabanı şeması.
2. **Tasarımın koda dökülmesi** — 18 ekran örnek verilerle, MapLibre haritası, web için Dockerfile.
3. Sırada: gerçek GPS kaydı, Supabase bağlantısı ve güvenlik kuralları.

## Sunucu

- Supabase (kendi sunucumuzda, Coolify): https://api.lykiva.ismailtopcam.dev
- Web: https://lykiva.ismailtopcam.dev (Coolify, `apps/web/Dockerfile`)
