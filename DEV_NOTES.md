# Lykiva — Geliştirme Notları

Bisiklet, koşu, yürüyüş ve doğa sporları için takip + sosyal paylaşım uygulaması.
Ekran tasarımları: Lykiva — Mobil Uygulama (Claude Design canvas'ı). Biten aşamaların listesi: `README.md` > Aşamalar.
Çalışma kuralları: `CLAUDE.md`.

## Şu an üzerinde çalışılanlar

Bir işe başlarken buraya adınla ve dalınla bir satır ekle; merge edince kaldır. Başkasının satırındaki dosyalara dokunmadan önce sor.

| Kim | İş | Dal |
| --- | --- | --- |
| İsmail | Telefona kurulum: EAS geliştirme derlemesi (kod değişikliği yok, derleme bekliyor) | — |

## Gökhan için: 11 Kasım 2026'da değişenler (İsmail)

- **Play dahili test yayında** (sürüm 2, 0.1.0). Tester listesi "Gösterge test". Katılma bağlantısı aşağıda (Bekleyen elle yapılacaklar 6).
  Güncel sürüm 3: senin anlık hız ve rota eğimi işlerin, Google girişi ve Android push dahil.
- **iOS TestFlight'a gönderildi:** App Store Connect'te "Lykiva" (Apple kimliği `6833386986`), sürüm 0.1.0 (3), güncel
  main'den (senin işlerin dahil). Sen Android'de deneyeceksin: Gmail adresini İsmail'e ilet, dahili test listesine eklensin.
- **Google ile giriş açık.** Sunucuda `google=true`; uygulama kodu değişmedi, Play'deki sürümde de çalışır.
  Apple ile giriş sunucuda zaten açıktı; TestFlight sürümünde denenecek.
- **Kod değişiklikleri** (`apps/mobile`):
  - `src/kayit/kaydedici.ts`: Android'de arka plan konum izni istenmeden önce bilgilendirme penceresi (Google Play kuralı;
    "Şimdi değil" denirse o oturumda bir daha sorulmaz, kayıt ön planda sürer).
  - `app.json`: `android.blockedPermissions` (RECORD_AUDIO, SYSTEM_ALERT_WINDOW), `ios.config.usesNonExemptEncryption: false`.
  - `eas.json`: `submit.production.ios` (App Store Connect uygulama kimliği ve Team ID).
  - `MAGAZA.md`: mağaza metinleri ve Play Console beyan taslakları (markete çıkarken kullanılacak).
- **EAS ortam değişkenleri** (production / preview / development): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  Mağaza derlemeleri bunları kullanır; yerel geliştirmede `apps/mobile/.env` geçerli.
- **Mağaza derlemesi almak istersen:** Android `npx eas-cli@latest build -p android --profile production` (imza EAS'ta, soru sormaz).
  iOS derlemesi ve TestFlight gönderimi şimdilik İsmail'in bilgisayarından (App Store Connect API anahtarı orada); yeni
  derleme gerekirse haber ver.
- **Android push kuruldu** (Firebase + FCM V1, `google-services.json` repoda); yeni Android derlemesinden itibaren çalışır.
- Gizli anahtarlar (Google istemci sırrı, Apple API anahtarı, Coolify anahtarı) repoda yok ve olmayacak.

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
8. **TestFlight:** derleme işlenince App Store Connect > Lykiva > TestFlight'ta testerları ekle (iç test: ekip üyeleri;
   dış test: e-posta ile, ilk sürümde Apple'ın kısa beta incelemesi gerekir). iPhone'da Apple ile ve Google ile girişi dene.
9. **E-posta:** SMTP, şablon ve konu değişkenleri Coolify'da dolu, servis yeniden başlatıldı (11 Kas 2026).
   - Sohbette paylaşılan iki Zoho şifresi var: ilkini (hesap şifresi) değiştir. Uygulama şifresini yenilersen Coolify >
     lykiva-supabase > `SMTP_PASS`'ı da güncelle ve servisi yeniden başlat.
   - Sohbette paylaşılan Coolify API anahtarlarını (bu da dahil) Coolify > Keys & Tokens'tan sil.
   - SMTP çalışıyor: deneme şifre sıfırlama postası Gmail'e geldi (11 Kas 2026). Kalan: yeni derlemede uygulamadan dene.

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
- Telefon bildirimleri (iOS: push anahtarı atandı; Android: FCM sürüm 3'ten itibaren — ikisi de telefonda denenecek)
- Rota eğimi: haritada renkli çizgi (MapLibre veri güdümlü renk), profilde parmakla gezinince haritadaki imleç,
  dar ekranda dört istatistiğin sığması, rota detayında tırmanış listesi.
- Anlık hız: bir bisiklet hız göstergesiyle yan yana sür; kırmızı ışıkta ~3 sn'de 0'a düşüyor mu, ağaç altında "—" çıkıyor mu?
  Android'de cihaz hız veremediğinde `coords.speed` boş yerine 0 geliyorsa hareket ederken 0 görünür — kontrol et.

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

### [~] Giriş: Google ve Apple
- **Google açık** (11 Kas 2026): Google Cloud projesi `lykiva` (Gösterge'den ayrı), OAuth onay ekranı "In production"
  (yalnızca e-posta / profil; logo yok, marka doğrulaması gerekmedi), Web istemcisi "Lykiva sunucu (Supabase)",
  yönlendirme `https://api.lykiva.app/auth/v1/callback`. Coolify > lykiva-supabase: `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET`,
  `ENABLE_GOOGLE_SIGNIN=true`. Kontrol: `/auth/v1/settings` → `google: true`.
- **Apple:** sunucuda açık; App ID'de Sign in with Apple yetkisi açıldı. Kalan: TestFlight sürümünde iPhone'da denemek.
- Telefonda henüz uçtan uca denenmedi (Google ve Apple).

### [~] Giriş: e-posta + şifre
Kod hazır (`apps/mobile/src/lib/epostaGiris.ts`, `src/components/EpostaGiris.tsx`): giriş, kayıt, şifremi unuttum;
doğrulama ve sıfırlama e-postadaki kodla. Geçici hesaptan kayıtta e-posta o hesaba eklenir; var olan hesaba girişte
kayıtlar `hesabi_devral` ile taşınır. Şablonlar `apps/web/public/eposta/` (web Docker imajına `public/` eklendi).
Sunucu ayarı yapıldı (SMTP Zoho, şablonlar `lykiva.app/eposta/`, kod 1 saat). İlk gerçek posta (şifre sıfırlama) Gmail'e geldi. Kalan: telefonda uçtan uca deneme: yeni hesap, geçici hesaptan
kayıt (kayıtlar duruyor mu), var olan hesaba giriş (kayıtlar taşınıyor mu), şifre sıfırlama, doğrulanmamış hesaba giriş.
Sonra: Ayarlar'da şifre değiştirme, web'de kullanıcı girişi (gerekirse).

### [~] iOS — TestFlight
App Store Connect'te **Lykiva** (Apple kimliği `6833386986`, SKU `lykiva`, Türkçe). Bundle ID `app.lykiva.mobile` kayıtlı;
Push Notifications ve Sign in with Apple yetkileri **elle** açıldı (EAS'ın otomatik eşitlemesi Apple API hatası verdi:
`TIBURON_APP_CONSENT`; iOS derlerken `EXPO_NO_CAPABILITY_SYNC=1` kullan). Dağıtım sertifikası ve push anahtarı
Gösterge ile ortak (aynı Apple ekibi).
**TestFlight'a gönderildi** (11 Kas 2026): 0.1.0 (3). Gönderim anahtarı EAS'ta ("[Expo] EAS Submit", Gösterge ile ortak);
sonraki gönderimler: `npx eas-cli@latest submit -p ios --latest`. EAS TestFlight'ta "Team (Expo)" iç test grubunu açtı.
Kalan: iPhone'da deneme (iOS testi İsmail'de; Gökhan'ın iPhone'u yok), Apple / Google girişi denemesi.

### [~] Android push bildirimi (FCM)
Kuruldu (11 Kas 2026): Firebase, `lykiva` Google Cloud projesine eklendi (Analytics kapalı); Android uygulaması
`app.lykiva.mobile` → `apps/mobile/google-services.json` (repoda; gizli değil), `app.json` > `android.googleServicesFile`.
FCM V1 hizmet hesabı anahtarı (`firebase-adminsdk-fbsvc@lykiva`) EAS'ta (production profili), yerel kopya silindi.
**Android sürüm 3 dahili testte yayında** (11 Kas 2026, FCM + Google girişi + anlık hız + rota eğimi). Kalan: telefonda bildirim gelip gelmediğini denemek.

### [ ] Küçük eksikler
- Web profil sayfası (`/u/<kullanıcı>`) profil fotoğrafını göstermiyor, baş harfler görünüyor.
- Engellenen kullanıcının açık oturumu erişim anahtarının süresi dolana kadar (varsayılan 1 saat) çalışır.
- Hava yalnızca kayıt başında bir kez ölçülüyor; rota detayında tahmin yok (rotanın planlanan tarihi yok).
- Rota eğimi köprü ve tünelde yanlış olabilir: BRouter çıktısında köprü / tünel etiketi yok (Galata Köprüsü örneğinde denendi), DEM
  köprüde vadinin tabanını, tünelde dağın üstünü verir. Kendi BRouter sunucumuzda etiketin çıktıya eklenip eklenemeyeceğine bakılmalı.
- Serbest çizilen rotada yükseklik yok (BRouter'a sorulmuyor); ayrı bir yükseklik servisi gerekir.

### [ ] Rakiplere göre eksikler (Kasım 2026 karşılaştırması)
Strava, Komoot, AllTrails, Wikiloc ve Garmin Connect ile karşılaştırıldı. Sıra öneri sırasıdır; (D) = yeni yerel modül, telefona yeni derleme gerekir.

**Önce — doğada güvenle kullanılabilmek için**
- [ ] Çevrimdışı harita: rotanın çevresini telefona indir (MapLibre çevrimdışı paketleri). Önce harita kaynağının
  (OpenFreeMap / MapTiler) toplu indirmeye izin verip vermediğine bak.
- [ ] Rotadan çıkınca titreşim + bildirim (telefon cepteyken de); sonra sesli yönlendirme (dönüş dönüş). Şu an uyarı yalnızca ekranda.
- [ ] Aileyle canlı konum: gruba üye olmayan birine web bağlantısıyla canlı konum (AllTrails Live Share / Garmin LiveTrack gibi);
  uzun süre hareketsiz kalınca uyarı.

**Sonra — veri alışverişi**
- [ ] GPX içe aktarma (rota ve aktivite); şu an yalnızca dışa aktarma var.
- [ ] Apple Sağlık / Google Health Connect senkronu (D).
- [ ] Bluetooth sensörler: nabız, tekerlek hızı / kadans, güç (D). Bisiklette anlık hızın en doğru kaynağı.

**Motivasyon**
- [ ] Haftalık / aylık / yıllık özet ve kişisel rekorlar (en uzun, en çok tırmanış, en hızlı …).
- [ ] Hedefler, meydan okumalar, rozetler.
- [ ] Segmentler ve liderlik tablosu (büyük iş, sonraya).

**Keşif**
- [ ] Rota üzerinde önerilen noktalar: su kaynağı, kamp yeri, manzara (fotoğraf + not; Komoot "Highlights" gibi).
- [ ] Rota kartında fotoğraf ve gerçek "kaç kişi yaptı" (şu an yalnızca örnek veride).
- [ ] Harita katmanı seçimi: topoğrafik, uydu, eş yükselti eğrileri.

**Platform**
- [ ] Kayıtta kilit ekranında hız / mesafe / süre: iOS Live Activity, Android kalıcı bildirimde değerler (D).
- [ ] İngilizce arayüz (Likya Yolu'ndaki yabancı yürüyüşçüler).
- [ ] Saat uygulaması (Apple Watch / Wear OS) — büyük iş, sonraya.
- [ ] Karar: ücretli üyelik olacak mı, hangi özellikler (rakiplerde çevrimdışı harita ve yönlendirme ücretli katmanda).

### [x] Rota eğimi (28. aşama, `packages/shared/src/egim.ts`)
Eğim her zaman 100 m'lik pencereyle ölçülür (DEM gürültülü; komşu iki nokta yanıltır). Sınıflar: iniş (≤ -%3), düz, %3–6, %6–10, %10+.
Tırmanış bölümü: en az 20 m kazanç, 200 m uzunluk, ort. %3; tepeden 10 m inilince biter.

### [x] Anlık hız iyileştirmesi (`currentSpeed`, `packages/shared/src/track.ts`)
- Cihazın verdiği hız (Doppler) esas: son 3 sn'deki en fazla 3 değerin medyanı (önce 5 sn'lik medyandı, ~2–3 sn gecikiyordu).
- Cihaz "duruyor" deyince hemen 0. Konum 3 m ilerlemeden gelmediği için durunca nokta gelmez: hıza göre beklenen sürede
  (bisiklette 3 sn, yavaş yürüyüşte en fazla 10 sn) yeni nokta gelmezse 0 (önce her durumda 10 sn bekliyordu).
- Son konum zayıfsa (>30 m) ve nokta gelmiyorsa 0 yerine "—" (hız bilinmiyor).
- İleride: Bluetooth tekerlek hız sensörü (yerel modül, yeni derleme gerekir) — ağaç altı / tünelde en doğrusu.

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
  iOS dağıtım sertifikası ve push anahtarı EAS'ta, Gösterge ile ortak (Apple Team ID `CK7TA62JQQ`, bireysel hesap).
- **E-posta doğrulaması kodla, bağlantıyla değil:** posta bilgisayarda açılsa da çalışır, uygulamaya dönüş
  bağlantısı (deep link) ve PKCE eşleşmesi gerekmez. Gönderen `noreply@lykiva.app` (Zoho SMTP, `smtp.zoho.eu`).
- **Google girişi ayrı Google Cloud projesinde** (`lykiva`): giriş ekranında "Gösterge" adı görünmesin diye.
- **App Store Connect API anahtarı** "EAS Lykiva (yerel)" (Key ID `28M4P34RVL`, Admin): dosyası yalnızca İsmail'in
  bilgisayarında (kullanıcı klasörü > `.lykiva`), repoda değil. iOS derleme / gönderimde `EXPO_ASC_API_KEY_PATH`,
  `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID` ortam değişkenleriyle kullanılır.
- **Commit ve PR'larda** yalnızca yazarın adı; yapay zekâ / araç imzası eklenmez (`CLAUDE.md`).
