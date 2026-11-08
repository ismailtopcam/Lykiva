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

1. **İskelet + tasarım + gezinme** — proje yapısı, ortak tasarım dili, mobil alt menü ve tüm ekranların kabukları, web karşılama sayfası ve yönetim paneli kabuğu, veritabanı şema taslağı.
2. Sırada: Supabase projesi, giriş/kayıt, güvenlik politikaları; ardından GPS kayıt çekirdeği.
