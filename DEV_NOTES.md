# Lykiva — Geliştirme Notları

Bisiklet, koşu, yürüyüş ve doğa sporları için takip + sosyal paylaşım uygulaması.
Ekran tasarımları: Lykiva — Mobil Uygulama (Claude Design canvas'ı). Biten aşamaların listesi: `README.md` > Aşamalar.
Çalışma kuralları: `CLAUDE.md`.

## Şu an üzerinde çalışılanlar

Bir işe başlarken buraya adınla ve dalınla bir satır ekle; merge edince kaldır. Başkasının satırındaki dosyalara dokunmadan önce sor.

| Kim | İş | Dal |
| --- | --- | --- |
| İsmail | Telefona kurulum: EAS geliştirme derlemesi (kod değişikliği yok, derleme bekliyor) | — |
| İsmail | Google Play dahili test: Play Console kaydı, ilk AAB | `claude/mobile-app-play-store-8433c7` |

## Bekleyen elle yapılacaklar

Sunucuda, Coolify'da ya da konsollarda yapılması gerekenler. Yapıldıkça sil.

1. **Zoho Mail (bilgi@lykiva.app):** DNS kayıtlarının hepsi yerinde (MX, SPF, DMARC, doğrulama TXT, DKIM `zmail`).
   Zoho Mail Admin > Domains > lykiva.app'te doğrulama ve DKIM için **Verify**'a bas; bir deneme postası gönderip al.
2. **Yönetim paneli > Site ayarları** (`https://lykiva.app/admin`) — veri sorumlusu ve adresi.
3. **Telefona geliştirme derlemesi** (`apps/mobile`): `npx eas-cli@latest device:create` (iPhone) →
   `npx eas-cli@latest build --profile development --platform all` → telefonlara kur → `npm run mobile`. Adımlar README'de.
4. **Yedek:** S3 uyumlu kova aç, `/etc/lykiva-yedek.env` doldur, `yedekle.sh` ve `geri-yukle-dene.sh` çalıştır.
5. **Kendi rota / yer arama sunucuları:** `altyapi/README.md` adımlarıyla Coolify'da kur, `.env` adreslerini değiştir.
6. **Play dahili test:** katılma bağlantısını "Gösterge test" listesindekilere gönder:
   https://play.google.com/apps/internaltest/4701532399950766309 — telefonda denenmemiş özellikleri (aşağıda) dene.
   Sonraki sürümler: `npx eas-cli@latest build -p android --profile production` → AAB'yi Dahili test > Yeni sürüm'e yükle
   (ya da Google Cloud hizmet hesabı JSON anahtarıyla `eas submit` kur).
7. **Coolify API anahtarı:** sohbette paylaşılan anahtarı Coolify > Keys & Tokens'tan sil, gerekirse yenisini oluştur.
8. **Google ve Apple girişi** (en son): Google Cloud OAuth istemcisi, Apple Sign in with Apple, Coolify'da `supabase-auth` ortam değişkenleri.

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

### [~] Google Play — dahili test
Play Console'da **Lykiva** oluşturuldu (kişisel geliştirici hesabı, paket `app.lykiva.mobile`, Türkçe, ücretsiz).
Kaydedilenler: gizlilik politikası URL'si, uygulama erişimi (giriş zorunlu değil: "Şimdilik geç" ile geçici hesap),
reklam yok. EAS ortam değişkenleri (production / preview / development) girildi; imzalama anahtarını EAS tutuyor
(Play App Signing). Mağaza metinleri ve beyan taslakları: `apps/mobile/MAGAZA.md`.
**Dahili test yayında** (11 Kas 2026): sürüm 2 (0.1.0), hedef SDK 36, tester listesi "Gösterge test" (3 kişi).
Kalan: testerların kurup denemesi; sonra kapalı teste geçiş (bkz. Mağazaya çıkmadan önce).

### [ ] Mağazaya çıkmadan önce
- Yasal metinleri (`/gizlilik`, `/kosullar`, `/hesap-silme`) gözden geçir; taslaktır, hukuki görüş değildir.
- **Kapalı test: 12 tester, 14 gün kesintisiz** (kişisel hesap kuralı) — bitmeden üretim erişimi açılmaz.
  Kapalı test için içerik derecelendirmesi, hedef kitle, veri güvenliği, sağlık beyanı ve mağaza girişi gerekir
  (taslaklar `MAGAZA.md`'de).
- Arka plan konum beyanı için YouTube videosu: bilgilendirme penceresi → izin ekranı → ekran kapalıyken süren kayıt.
- Mağaza grafikleri: 512 px simge, 1024×500 öne çıkan grafik, en az 2 telefon ekran görüntüsü.

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
  E-posta Zoho Mail (AB sunucuları). ismailtopcam.dev artık Lykiva'yı göstermiyor; Coolify'dan eski adresler kaldırıldı.
- **Coolify paneli** Tailscale ağı üzerinden `http://coolify:8000` (eski `coolify.ismailtopcam.dev` kapalı).
  lykiva-web uuid `pjrlciwlsjvr6fpl3lovbaoy`, lykiva-supabase uuid `nqyujqqkkjyba4flthzcf9uf`.
- **Paket adı / bundle ID: `app.lykiva.mobile`** (Android ve iOS) — Play'e ilk AAB yüklenince kalıcı.
- **Mağaza imzası:** Android yükleme anahtarı EAS'ta (Expo sunucusu), uygulama imzası Play App Signing'de.
- **Commit ve PR'larda** yalnızca yazarın adı; yapay zekâ / araç imzası eklenmez (`CLAUDE.md`).
