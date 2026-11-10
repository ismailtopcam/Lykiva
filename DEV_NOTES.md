# Lykiva — Geliştirme Notları

Bisiklet, koşu, yürüyüş ve doğa sporları için takip + sosyal paylaşım uygulaması.
Ekran tasarımları: Lykiva — Mobil Uygulama (Claude Design canvas'ı). Biten aşamaların listesi: `README.md` > Aşamalar.
Çalışma kuralları: `CLAUDE.md`.

## Şu an üzerinde çalışılanlar

Bir işe başlarken buraya adınla ve dalınla bir satır ekle; merge edince kaldır. Başkasının satırındaki dosyalara dokunmadan önce sor.

| Kim | İş | Dal |
| --- | --- | --- |
| İsmail | Telefona kurulum: EAS geliştirme derlemesi (kod değişikliği yok, derleme bekliyor) | — |

## Bekleyen elle yapılacaklar

Sunucuda, Coolify'da ya da konsollarda yapılması gerekenler. Yapıldıkça sil.

1. **Alan adı lykiva.app'e taşınıyor (ismailtopcam.dev kapanacak)** — DNS hazır (11 Kasım 2026). Coolify'da:
   - lykiva-web > Domains: `https://lykiva.app,https://www.lykiva.app`; Environment: `SITE_URL=https://lykiva.app`,
     `SUPABASE_URL=https://api.lykiva.app` (ya da sil; kodda varsayılan artık bu) → **Redeploy**.
   - lykiva-supabase: Kong / API alan adı `https://api.lykiva.app`; ortam değişkenlerinde eski adres geçen yerler
     (`API_EXTERNAL_URL`, `SITE_URL`, `SUPABASE_PUBLIC_URL` vb.) `https://api.lykiva.app` / `https://lykiva.app` → **Restart**.
   - Bilgisayardaki `apps/mobile/.env`: `EXPO_PUBLIC_SUPABASE_URL=https://api.lykiva.app`.
   - Sonra yasal sayfalar (`/gizlilik`, `/kosullar`, `/hesap-silme`) da yeni sürümle açılır.
1a. **Zoho Mail (bilgi@lykiva.app):** MX, SPF ve DMARC kayıtları eklendi. Zoho yönetim panelinden (Mail Admin > Domains >
   lykiva.app) alan doğrulama TXT değeri ve DKIM anahtarı alınıp Cloudflare'e eklenecek.
2. **Yönetim paneli > Site ayarları** — veri sorumlusu ve adresi; `bilgi@lykiva.app` adresinin gerçekten e-posta aldığını doğrula.
3. **Telefona geliştirme derlemesi** (`apps/mobile`): `npx eas-cli@latest device:create` (iPhone) →
   `npx eas-cli@latest build --profile development --platform all` → telefonlara kur → `npm run mobile`. Adımlar README'de.
4. **Yedek:** S3 uyumlu kova aç, `/etc/lykiva-yedek.env` doldur, `yedekle.sh` ve `geri-yukle-dene.sh` çalıştır.
5. **Kendi rota / yer arama sunucuları:** `altyapi/README.md` adımlarıyla Coolify'da kur, `.env` adreslerini değiştir.
6. **Google ve Apple girişi** (en son): Google Cloud OAuth istemcisi, Apple Sign in with Apple, Coolify'da `supabase-auth` ortam değişkenleri.

## Yapılacaklar

### [~] Telefona kurulum (EAS)
EAS projesi `@ismailtopcam/lykiva` bağlandı, `apps/mobile/eas.json` profilleri hazır (development / preview / production).
Kalan: cihaz kaydı, ilk derleme, telefonda deneme. Yeni yerel modüller (fotoğraf, bildirim) bu derlemeyle gelecek.

### [ ] Telefonda ve gerçek sunucuda denenmemiş özellikler
Kod ve SQL testleri geçti, ama gerçek ortamda henüz çalıştırılmadı:
- Fotoğraf yükleme (depolama kovaları ve kuralları `postgres` rolüyle kuruldu mu?)
- Kullanıcı engelleme (`postgres` rolü `auth.users`'a yazabiliyor mu?)
- Geçersiz push jetonu temizliği (gerçek Expo yanıtıyla)
- Uygulama içinden hesap silme
- Telefon bildirimleri (Apple push anahtarı derleme sırasında oluşturulacak)

### [ ] Mağazaya çıkmadan önce
- Yasal metinleri (`/gizlilik`, `/kosullar`, `/hesap-silme`) gözden geçir; taslaktır, hukuki görüş değildir.
- Mağaza derlemeleri (preview / production) için EAS ortam değişkenleri: `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` (geliştirme derlemesi bilgisayardaki `apps/mobile/.env`'i kullanır).
- Kalıcı bundle ID kararı (şu an `app.lykiva.mobile`).

### [~] Yedekleme
Betikler sunucuya kuruldu (`supabase/yedek/kur.sh`; her gece 03:30, yerel 14 gün). Kalan: sunucu dışı S3 kopyası ve
geri yükleme denemesi. O zamana kadar yedek yalnızca aynı sunucuda.

### [~] Kendi rota hesaplama ve yer arama sunucumuz
Kurulum dosyaları hazır: `altyapi/` (BRouter 1.7.10 + Photon 1.3.0, Coolify Docker Compose). Coolify'da kurulup
`.env` adresleri değiştirilince [x] olacak. O zamana kadar herkese açık brouter.de ve photon.komoot.io kullanılıyor
(adil kullanım sınırlı; gerçek kullanıcılar gelmeden önce yapılmalı).

### [ ] Giriş: Google ve Apple — sunucu ve konsol ayarı
Kod hazır (4. aşama), `20261109000000_giris.sql` sunucuda uygulandı. Kalanlar `supabase/README.md` > Giriş bölümünde.

### [ ] Küçük eksikler
- Web profil sayfası (`/u/<kullanıcı>`) profil fotoğrafını göstermiyor, baş harfler görünüyor.
- Engellenen kullanıcının açık oturumu erişim anahtarının süresi dolana kadar (varsayılan 1 saat) çalışır.
- Hava yalnızca kayıt başında bir kez ölçülüyor; rota detayında tahmin yok (rotanın planlanan tarihi yok).

### [x] Hava durumu (20. ve 26. aşama)
Uygulamada kayıt başında, akış ve paylaşım kartında, etkinlik tahmininde; web paylaşım sayfasında da.

## Kararlar

- **Hava servisi: MET Norway** (api.met.no locationforecast 2.0) — anahtarsız, ticari kullanım dahil ücretsiz, CC BY 4.0
  ("Kaynak: MET Norway"). Open-Meteo'nun ücretsiz katmanı ticari olmayan kullanımla sınırlı olduğu için seçilmedi.
  Tanıtıcı User-Agent, koordinat 3 ondalık, aynı yer için 30 dk önbellek. Adres `EXPO_PUBLIC_HAVA_URL` ile değişir.
- **Derleme: EAS Build** (bulutta; Windows'tan da başlatılır). Mac'te yerel derleme de mümkün.
- **Yönetim paneli** tam yetkili anahtar kullanmaz; her işlem yöneticinin kendi oturumuyla, yetkiyi veritabanı denetler.
- **Yasal sayfalardaki iletişim bilgileri** panelden değişir (`site_ayarlari`); varsayılan `bilgi@lykiva.app`.
- **Alan adları:** `lykiva.app` asıl adres (web), `api.lykiva.app` Supabase, `brouter.` / `photon.lykiva.app` kendi
  sunucularımız (kurulunca). DNS Cloudflare'de, proxy kapalı (Coolify kendi sertifikasını alır; gosterge.app ile aynı düzen).
  `lykiva.com` ve `www.lykiva.com` Cloudflare yönlendirme kuralıyla `https://lykiva.app`'e 301 (yol ve sorgu korunur).
  E-posta Zoho Mail (AB sunucuları).
- **Commit ve PR'larda** yalnızca yazarın adı; yapay zekâ / araç imzası eklenmez (`CLAUDE.md`).
