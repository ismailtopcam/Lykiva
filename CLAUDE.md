# Lykiva — Claude için çalışma kuralları

Bisiklet, koşu, yürüyüş ve doğa sporları için aktivite takibi ve sosyal paylaşım uygulaması (iOS / Android) +
web (karşılama, paylaşım sayfaları, yönetim paneli). Genel bakış ve kurulum: `README.md`.
Güncel durum, yapılacaklar ve kimin neyle uğraştığı: **`DEV_NOTES.md`**.

## Ekip

- **İsmail Topçam** ve **Gökhan** birlikte kodluyor.
- **Sunucuyla ilgili işleri İsmail yapar, Gökhan yapmaz:** migration uygulama, Coolify, sunucu ayarları, ortam değişkenleri.
  Gökhan'ın işinde migration varsa PR'ı main'e girince İsmail (Claude ile) uygular; Gökhan'ın oturumunda Claude sunucuya
  dokunmaz, gerekeni DEV_NOTES'a "İsmail uygulayacak" diye yazar.
- **EAS derlemeleri ve mağaza gönderimleri İsmail'den yürür** (EAS Build / Submit, TestFlight, Play): EAS projesi
  `@ismailtopcam/lykiva` İsmail'in hesabında, Gökhan EAS projesine eklenmez. Gökhan'ın işi yeni derleme gerektiriyorsa
  (yeni yerel modül, `app.json` değişikliği) DEV_NOTES'a "İsmail derleme alacak" diye yazılır; derlemeyi İsmail (Claude ile) alır.
- İşe başlamadan önce `main`'i çek (`git pull`) ve `DEV_NOTES.md` > "Şu an üzerinde çalışılanlar" bölümüne bak:
  başkasının üzerinde çalıştığı dosyalara / özelliğe dokunma; çakışma varsa önce sor.
- Yeni bir işe başlarken o bölüme kendi adınla ve dal adıyla bir satır ekle; iş bitince (merge sonrası) satırı kaldır,
  yapılanı "Yapılacaklar" listesinde işaretle.

## Dil

- Kullanıcıyla Türkçe konuş. Kod tanımlayıcıları ve yorumlar çoğunlukla Türkçe (mevcut koda uy).
- Uydurma sayı ya da kaynak yazma; erişilemeyen bir şey olursa açıkça söyle.
- Kullanıcıya iş bırakırken sade bir yapılacaklar listesi ver.

## Git

- Her iş kendi dalında: dal → PR → merge. Doğrudan `main`'e commit atma.
- **Commit mesajlarına ve PR açıklamalarına yalnızca yazarın adı girer.** `Co-Authored-By: Claude …` satırı,
  "Generated with Claude Code" notu ya da başka bir yapay zekâ / araç imzası **ekleme**. Yazar, git'teki kullanıcıdır.
- Commit ve PR metni Türkçe; ne değişti ve neden, kısa.
- Başkasının (Gökhan'ın / İsmail'in) açık PR'ını onların haberi olmadan merge etme.

## DEV_NOTES.md

Aktif olarak kullan ve güncel tut:

- Bir iş başlarken "Şu an üzerinde çalışılanlar"a ekle; bitince kaldır.
- Biten iş "Yapılacaklar"da `[x]`, yarım kalan `[~]` (neyin kaldığını yaz), yeni fark edilen eksik `[ ]` olarak eklenir.
- Kullanıcının (sunucuda, Coolify'da, Expo / Apple / Google konsollarında) yapması gereken adımlar
  "Bekleyen elle yapılacaklar" bölümünde tutulur; yapıldıkça silinir.
- Önemli kararları (seçilen servis, neden) kısa not olarak yaz.
- DEV_NOTES güncellemesi ilgili kod değişikliğiyle aynı PR'a girer.

## Yapı

- `apps/mobile` — Expo SDK 58, React Native, expo-router, MapLibre. EAS projesi `@ismailtopcam/lykiva`.
- `apps/web` — Next.js 16 (cacheComponents, `proxy.ts`), Coolify'da `apps/web/Dockerfile` ile.
- `packages/shared` — ortak tipler ve hesaplar (vitest).
- `supabase/migrations` — kendi sunucumuzdaki Supabase. Yeni migration eklerken `supabase/uygula.sh` ve
  `scripts/sunucu-kontrol.mjs` listelerine de ekle, `supabase/README.md` tablosuna satır yaz.
- `supabase/test/dene.mjs` — SQL senaryoları (PGlite). Veritabanı değişikliğinde senaryo ekle.
- `altyapi/` — kendi BRouter / Photon sunucularımız.

## Denetimler (PR'dan önce)

```bash
npm run test:sql                                   # SQL senaryoları
cd apps/mobile && npx tsc --noEmit && npx eslint src --max-warnings=0
cd apps/web && npx tsc --noEmit && npx eslint src
npm test --workspace packages/shared
```

## Kurallar

- Mobil paketleri `npx expo install` ile ekle; `ios/` ve `android/` klasörlerini elle düzenleme.
- Yeni yerel modül eklenirse telefona yeni derleme gerekir; README'de ve DEV_NOTES'ta belirt.
- Gizli anahtarları (Coolify API anahtarı, SSH anahtarı, Google / Apple gizli anahtarları, Supabase servis anahtarı)
  sohbete, repoya ya da commit'e yazma. `.env` dosyaları git'e girmez.
- Web'e tam yetkili Supabase servis anahtarı konmaz; yönetim paneli yöneticinin kendi oturumuyla çalışır.
- Uygulama sunucusunda (Coolify) diğer uygulamalara dokunma: artieksi, fatosunkitapligi, gosterge, tez ve paylaşılan
  postgres:18.
- Kullanıcının ekranına uzaktan müdahale yok; dosya ve terminal işleri sorun değil.
- Adresler: web `https://lykiva.app`, Supabase `https://api.lykiva.app` (DNS Cloudflare'de; `lykiva.com` → `lykiva.app`).
- Coolify paneli ve API'si Tailscale üzerinden `http://coolify:8000` (sürüm 4.7.3). API anahtarı kullanıcıdan istenir; repoya,
  dosyaya ya da hafızaya yazılmaz. Yalnızca lykiva-web ve lykiva-supabase'e dokunulur.
- Uygulama sunucusuna İsmail'in bilgisayarından Tailscale üzerinden `ssh root@uygulama` ile anahtarla girilebiliyor
  (11 Kasım 2026'da denendi). Migration'ları Claude bu yolla `uygula.sh` ile uygular: önce durum modu, sonra `uygula`.
  Sunucuda yalnızca Lykiva'nın Supabase konteynerlerine dokunulur. Sunucu işleri İsmail'de (yukarıda, Ekip); SSH
  çalışmazsa İsmail Coolify > Servers > uygulama > Terminal'de aynı komutu çalıştırır.
