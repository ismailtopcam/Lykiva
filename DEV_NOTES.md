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
  Güncel sürüm 4 (12 Kas 2026): main'deki her şey, kilit ekranı penceresi dahil.
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
- **Derlemeler İsmail'de (12 Kas 2026):** EAS projesi İsmail'in hesabında kalıyor, seni eklemiyoruz. Android ve iOS derlemeleri,
  TestFlight / Play gönderimleri İsmail'in bilgisayarından. İşin yeni derleme gerektiriyorsa (yeni yerel modül, `app.json`)
  "Bekleyen elle yapılacaklar"a "İsmail derleme alacak" diye yaz.
- **Android push kuruldu** (Firebase + FCM V1, `google-services.json` repoda); yeni Android derlemesinden itibaren çalışır.
- Gizli anahtarlar (Google istemci sırrı, Apple API anahtarı, Coolify anahtarı) repoda yok ve olmayacak.

## Bekleyen elle yapılacaklar

Sunucuda, Coolify'da ya da konsollarda yapılması gerekenler. Yapıldıkça sil.

1. **Zoho Mail (bilgi@lykiva.app):** DNS kayıtlarının hepsi yerinde (MX, SPF, DMARC, doğrulama TXT, DKIM `zmail`).
   Zoho Mail Admin > Domains > lykiva.app'te doğrulama ve DKIM için **Verify**'a bas; bir deneme postası gönderip al.
2. **Yönetim paneli > Site ayarları** (`https://lykiva.app/admin`) — veri sorumlusu ve adresi.
3. **Telefona geliştirme derlemesi** (`apps/mobile`): `npx eas-cli@latest device:create` (iPhone) →
   `npx eas-cli@latest build --profile development --platform all` → telefonlara kur → `npm run mobile`. Adımlar README'de.
4. **Hetzner depolama anahtarını yenile:** gizli anahtar sohbette paylaşıldı. Hetzner Console > Security > S3 credentials'ta
   yeni çift oluştur, `/etc/lykiva-yedek.env`'de `S3_ANAHTAR` / `S3_GIZLI`'yi değiştir (Claude yapabilir: erişim anahtarını
   sohbete, gizliyi yalnızca sunucuya yaz), sonra eski iki çifti (`3W8WDQ…`, `CZE21…`) sil.
5. **Coolify API anahtarı (12 Kas 2026):** BRouter / Photon kurulumu için sohbette paylaşılan anahtarı (`4|HHdY…`)
   Coolify > Keys & Tokens'tan sil.
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
10. **İlk herkese açık meydan okuma (isteğe bağlı):** `https://lykiva.app/admin/meydan-okumalar`'dan yönetici hesabıyla aç
    (ör. "Aralık'ta 200 km"). Hedefler / meydan okumalar ve ısı haritaları migration'ları uygulandı (12 Kas 2026).
11. **Android sürüm 4'ü telefonda dene** (12 Kas 2026'da Play dahili teste yüklendi): kilit ekranı penceresi, hedefler /
    meydan okumalar / rozetler, harita türleri, ısı haritaları ilk kez telefonda. Neye bakılacağı aşağıda
    "Telefonda ve gerçek sunucuda denenmemiş özellikler"de.

## Yapılacaklar

### [~] Telefona kurulum (EAS)
EAS projesi `@ismailtopcam/lykiva` bağlandı, `apps/mobile/eas.json` profilleri hazır (development / preview / production).
Kalan: cihaz kaydı, ilk derleme, telefonda deneme. Yeni yerel modüller (fotoğraf, bildirim, kilit ekranı) bu derlemeyle gelecek.

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
- Çevrimdışı harita: bir rotayı indir, uçak moduna al; rota sayfası, harita ve "Bu rotayı başlat" açılıyor mu?
  İndirme boyutu makul mü (stil, yazı tipi dosyaları da iner)? User-Agent başlığı OpenFreeMap isteklerinde görünüyor mu?
- Dil: telefonu İngilizce / Almanca / Rusça yap ya da Ayarlar > Dil'den seç; bütün ekranlar değişiyor mu, metinler taşıyor mu
  (Almanca uzun)? Tarihler ("Samstag, 7. November"), sayılar (27.4 / 27,4) doğru mu? Telefon bildirimi seçilen dilde geliyor mu?
- Hedefler / meydan okumalar / rozetler: Profil'deki dört kutu dar ekrana sığıyor mu (Almanca, Rusça)? Hedef koy, bir kayıt yap,
  ilerleme değişiyor mu? Grupta meydan okuma başlat, ikinci telefondan katıl, sıralama doğru mu? Gruptan ayrılınca sıralamadan
  çıkılıyor mu? Rozetler ekranı ve aktivite sayfasındaki "Yeni rozet" satırı.
- Kişisel rekorlar: Profil > Kişisel rekorlar açılıyor mu, değerler aktivite sayfalarıyla tutuyor mu, tür süzgeci çalışıyor mu?
  Yeni bir kayıtta rekor kırınca aktivite sayfasında rozet çıkıyor mu (o türde en az 2 aktivite gerekir)? Almanca / Rusça uzun
  rekor adları kartlara sığıyor mu?
- Harita türleri: haritadaki katman düğmesinden uydu / hibrit / kış seç; bütün haritalarda değişiyor mu, uygulama kapanıp
  açılınca seçim kalıyor mu? Hibritte yol ve yer adları okunuyor mu? Kışı bir kayak merkezinde aç (Uludağ, Kartalkaya,
  Palandöken): pistler görünüyor mu? Tür değişince rota çizgisi ve işaretler kayboluyor mu (stil yeniden yüklenirken)?
  Yalnızca geliştirme / mağaza derlemesinde; Expo Go'da düğme çıkmaz. Türetilen stiller MapLibre stil doğrulayıcısından
  hatasız geçti; telefonda görülmedi.
- Isı haritaları (migration uygulandıktan sonra): katman düğmesi > Isı haritası > Küresel / Haftalık / Gece / Kişisel.
  Yakınlaştırınca (8. düzey, aşağı yukarı bir il) çıkıyor mu, kaydırınca yenileniyor mu, hızlı mı? Kişisel uzaktan da
  görünüyor mu? Yeni bir kayıttan sonra kişiselde çıkıyor mu? Ayarlar > Gizlilik > "Isı haritalarında görün" kapatılınca
  başka hesaptan bakınca o kişinin izleri kayboluyor mu? Uydu / hibrit üstünde renkler okunuyor mu?
- Kilit ekranı (Android, sürüm 4; Kotlin modülü EAS'ta sorunsuz derlendi, telefonda denenmedi):
  kayıt başlat, ekranı kapat; kilit ekranında süre sayıyor mu, mesafe ve ort. hız yürüdükçe değişiyor mu? Bildirim
  çekmecesinde tek bildirim mi kalıyor ("Lykiva kaydediyor" + pencere iki ayrı bildirim olmamalı)? Duraklat / devam et:
  süre duruyor, devamda kaldığı yerden sayıyor mu? Bitir / iptal: pencere kayboluyor mu? Karanlık temada yazılar
  okunuyor mu, büyük yazı boyutunda kapalı bildirime sığıyor mu? Samsung / Xiaomi gibi kendi arayüzü olanlarda görünüm?
  Android 13+'ta bildirim izni reddedilince kayıt yine sürüyor mu? Arka plan izni "Şimdi değil" denince de pencere çıkıyor mu?

### [~] Google Play — dahili test
Play Console'da **Lykiva** oluşturuldu (kişisel geliştirici hesabı, paket `app.lykiva.mobile`, Türkçe, ücretsiz).
Kaydedilenler: gizlilik politikası URL'si, uygulama erişimi (giriş zorunlu değil: "Şimdilik geç" ile geçici hesap),
reklam yok. EAS ortam değişkenleri (production / preview / development) girildi; imzalama anahtarını EAS tutuyor
(Play App Signing). Mağaza metinleri ve beyan taslakları: `apps/mobile/MAGAZA.md`.
**Dahili test yayında** (11 Kas 2026): sürüm 2 (0.1.0), hedef SDK 36, tester listesi "Gösterge test" (3 kişi).
**Sürüm 4 yüklendi** (12 Kas 2026, versionCode 4, güncel main): kilit ekranı penceresi, hedefler / meydan okumalar /
rozetler, harita türleri, ısı haritaları, dil desteği, çevrimdışı harita, kişisel rekorlar.
Sonraki sürüme girecek: Expo SDK 58 yama güncellemeleri (15 paket, `expo doctor` uyarısı giderildi, 12 Kas 2026);
kendi BRouter / Photon sunucularımız (EAS ortam değişkenleri, aşağıda).
Kalan: testerların kurup denemesi; sonra kapalı teste geçiş (bkz. Mağazaya çıkmadan önce).

### [ ] Mağazaya çıkmadan önce
- Yasal metinleri (`/gizlilik`, `/kosullar`, `/hesap-silme`) gözden geçir; taslaktır, hukuki görüş değildir.
- **Kapalı test: 12 tester, 14 gün kesintisiz** (kişisel hesap kuralı) — bitmeden üretim erişimi açılmaz.
  Kapalı test için içerik derecelendirmesi, hedef kitle, veri güvenliği, sağlık beyanı ve mağaza girişi gerekir
  (taslaklar `MAGAZA.md`'de).
- Arka plan konum beyanı için YouTube videosu: bilgilendirme penceresi → izin ekranı → ekran kapalıyken süren kayıt.
- Mağaza grafikleri: 512 px simge, 1024×500 öne çıkan grafik, en az 2 telefon ekran görüntüsü.
- Harita türlerinin kaynak koşullarını oku: Esri World Imagery (uydu / hibrit) ve OpenSnowMap pist döşemeleri (kış)
  mağazadaki ücretsiz bir uygulamada bu şekilde (anahtarsız, doğrudan döşeme) kullanılabiliyor mu? Uymuyorsa uydu için
  anahtarlı bir servise geç (ör. Esri ArcGIS Location Platform ya da MapTiler Satellite); adres `haritaTurleri.ts`'te tek yerde.

### [x] Yedekleme
Betikler sunucuda (`supabase/yedek/kur.sh`; her gece 03:30 TSİ, yerel 14 gün). **Sunucu dışı kopya açık** (12 Kas 2026):
Hetzner Object Storage, `nbg1.your-objectstorage.com`, kova `ismail` içinde `lykiva-yedek/` klasörü.
**Yalnızca son yedek tutuluyor** (`SAKLA_ADET=1`, İsmail'in kararı, 12 Kas 2026): her gece yeni yedek alınıp Hetzner'e
kopyalandıktan sonra önceki gün silinir (yerelde ve uzakta). Yedek bozuksa ya da bir veri kaybı ertesi gece fark edilirse
daha eski kopya yok; istenirse `SAKLA_ADET` artırılır.
Kovada başka veri de var (`arsiv/`, `data/`); bu yüzden `S3_KOVA=ismail/lykiva-yedek` — eski yedek silme yalnızca o klasörde.
İlk uzak yedek indirilerek karşılaştırıldı (5/5 dosya aynı), `geri-yukle-dene.sh` geçti (sayılar aynı).
Yeni anahtarla ilk dakikalarda ara ara 403 geldi (rclone yeniden deneyip tamamladı); birkaç gün günlüğe bakılmalı:
`tail -n 50 /var/log/lykiva-yedek.log`.
Sunucu paketleri güncellendi (12 Kas 2026; Ubuntu 24.04.5, Docker eklentileri, Tailscale 1.104.6, snapd), 27 konteynerin
hepsi çalışıyor, yeniden başlatma gerekmedi. Otomatik güvenlik güncellemeleri (unattended-upgrades) açık.

### [x] Kendi rota hesaplama ve yer arama sunucumuz (12 Kas 2026)
Coolify > Uygulamalar > production > **lykiva-altyapi** (Docker Compose, `altyapi/docker-compose.yml`, sunucu "uygulama"):
`https://brouter.lykiva.app` (BRouter 1.7.10, Türkiye ve çevresi 8 karo) ve `https://photon.lykiva.app` (Photon 1.3.0,
Türkiye, tr + en; 1,18 milyon kayıt, 449 MB). `PHOTON_BELLEK=3g` (ilk içe aktarma ~3 GB, 5 dk; sonra ~400 MB).
Denendi: BRouter dört profilde brouter.de ile aynı sonuç (Kaş 3653 m); Photon Türkçe aramalarda komoot ile aynı ya da daha iyi.
Haftalık güncelleme Coolify > Scheduled Tasks: pazartesi 05:00 BRouter segmentleri, 05:30 Photon verisi
(`veri-guncelle.sh && kill 1` — bitince Photon yeniden başlar, ~13 sn kesinti; denendi).
Uygulama: EAS ortam değişkenleri `EXPO_PUBLIC_BROUTER_URL` / `EXPO_PUBLIC_PHOTON_URL` (production / preview / development)
girildi → **sürüm 5'ten itibaren** kendi sunucularımız; o zamana kadar telefonlar brouter.de / photon.komoot.io kullanır.
- [ ] **Kapsam yalnızca Türkiye:** Photon'da yurt dışı yer yok ("Eiffel" → Bandırma'da bir kuaför), BRouter karoları
  E25–E45 / N35–N45 dışında rota çizmez. Almanca / Rusça arayüzle yurt dışındaki kullanıcılar etkilenir. Öneri: kendi
  sunucu hata verirse ya da sonuç boşsa uygulama herkese açık sunuculara düşsün (`lib/yonlendirme.ts`, `lib/yerArama.ts`).
  Şimdilik yapılmadı (İsmail, 12 Kas 2026); yerine kullanıcıya uyarı: rota çizme panelinde "yalnızca Türkiye'de çalışıyor",
  arama sonuçlarının altında "yalnızca Türkiye'deki yerler", kapsam dışında rota istenince açıklayıcı hata (dört dilde, sürüm 5).
- [ ] **Uzun rotalar yavaş:** İstanbul–Bursa (139 km) bizde ~8 sn, brouter.de'de ~2,5 sn. `BROUTER_BELLEK` (512M)
  artırılıp denenebilir; kısa rotalar ~0,3 sn.
- **Kapı (12 Kas 2026):** dışarıya yalnızca nginx kapısı açık (`altyapi/kapi`); `X-Lykiva-Anahtar` olmayan istek 403,
  IP başına sınır (rota 60/dk, arama 120/dk; aşılınca 429). Anahtar Coolify'da `LYKIVA_UYGULAMA_ANAHTARI`, uygulamada
  `EXPO_PUBLIC_ALTYAPI_ANAHTARI` (EAS + yerel `.env`); repoda yok. Uygulama anahtarı yalnızca kendi adreslerimize
  gönderir (`lib/altyapi.ts`). Sürüm 5 kendi sunucuları kullanan ilk sürüm olduğu için eski sürümler etkilenmez.
  Mobil hatlarda ortak IP (CGNAT) yüzünden 429 görülürse sınırlar artırılır.

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
- [x] Çevrimdışı harita: rotanın çevresini telefona indir (30. aşama, `lib/cevrimdisi.ts`). Kalan: telefonda deneme;
  OpenFreeMap'in "en fazla 4 paralel istek" kuralını MapLibre'den ayarlayamıyoruz (bkz. Kararlar).
  Sonra: haritada serbest alan seçip indirme (rotasız), kayıt başlatırken "bu rota indirilmemiş" uyarısı.
- [ ] Rotadan çıkınca titreşim + bildirim (telefon cepteyken de); sonra sesli yönlendirme (dönüş dönüş). Şu an uyarı yalnızca ekranda.
- [ ] Aileyle canlı konum: gruba üye olmayan birine web bağlantısıyla canlı konum (AllTrails Live Share / Garmin LiveTrack gibi);
  uzun süre hareketsiz kalınca uyarı.

**Sonra — veri alışverişi**
- [ ] GPX içe aktarma (rota ve aktivite); şu an yalnızca dışa aktarma var.
- [ ] Apple Sağlık / Google Health Connect senkronu (D).
- [ ] Bluetooth sensörler: nabız, tekerlek hızı / kadans, güç (D). Bisiklette anlık hızın en doğru kaynağı.

**Motivasyon**
- [~] Haftalık / aylık / yıllık özet ve kişisel rekorlar. Yapıldı (32. aşama): rekorlar ekranı (en uzun mesafe, en uzun süre,
  en yüksek hız, en çok tırmanış; türe göre), bu yılın / tüm zamanların toplamı, aktivite sayfasında "Kişisel rekor" rozeti.
  Kalan: aylık özet ve geçen yılla karşılaştırma; en hızlı 5 / 10 km / 21 km (iz içinde en iyi bölüm, koşu için); kayıt bitince
  "yeni rekor" bildirimi; rekorları başkasının profilinde gösterme (şu an yalnızca kendi rekorların).
- [x] Hedefler, meydan okumalar, rozetler (33. aşama). Kalan: grup meydan okuması açılınca ve tamamlanınca bildirim;
  rozetleri / meydan okuma sonuçlarını başkasının profilinde gösterme; meydan okumaya katılan çok artarsa sıralamayı önbelleğe alma.
- [ ] Segmentler ve liderlik tablosu (büyük iş, sonraya).

**Keşif**
- [ ] Rota üzerinde önerilen noktalar: su kaynağı, kamp yeri, manzara (fotoğraf + not; Komoot "Highlights" gibi).
- [ ] Rota kartında fotoğraf ve gerçek "kaç kişi yaptı" (şu an yalnızca örnek veride).
- [~] Harita katmanı seçimi: standart, uydu, hibrit, kış yapıldı (haritadaki katman düğmesi). Kalan: topoğrafik
  (eş yükselti eğrileri, tepe gölgesi; yükselti verisi / DEM kaynağı gerekir); çevrimdışı paketler yalnızca standart
  stille iner (uydu çevrimdışında boş görünür).
- [x] Isı haritaları: küresel, haftalık, gece, kişisel (34. aşama). Kalan: aktivite sayısı artınca hücreleri önceden
  hesaplayan tablo (şu an her istekte izlerden hesaplanıyor); web'de ısı haritası yok; tür süzgeci (yalnızca bisiklet / koşu).

**Platform**
- [~] Kayıtta kilit ekranında süre / mesafe / ortalama hız (35. aşama). Android yapıldı: kayıt bildirimi canlı pencereye
  dönüşüyor (yerel modül `modules/kilit-ekrani`; Android sürüm 4'te, telefonda denenecek). Kalan: iOS Live Activity (widget eklentisi, Apple'da
  yeni bundle ID; Mac / EAS'ta derleyip iPhone'da denemek gerekir — İsmail).
- [~] Çok dilli arayüz: İngilizce, Almanca ve Rusça yapıldı (31. aşama); Arapça + sağdan sola düzen sıradaki PR.
- [ ] Saat uygulaması (Apple Watch / Wear OS) — büyük iş, sonraya.
- [ ] Karar: ücretli üyelik olacak mı, hangi özellikler (rakiplerde çevrimdışı harita ve yönlendirme ücretli katmanda).

### [~] Dil desteği (31. aşama)
Yapıldı: uygulamanın bütün ekranları, telefon bildirimleri ve web (karşılama, paylaşım, web profili, önizleme görseli)
Türkçe, İngilizce, Almanca ve Rusça. Rusçada birimler Kiril (км, м, км/ч) ve üç biçimli çoğul
("1 комментарий|2 комментария|5 комментариев"). Kalan:
- [ ] Arapça + sağdan sola (RTL) düzen — ayrı PR; `expo-localization` (supportsRTL) yeni yerel ayar → yeni derleme gerekir.
  Sunucu tarafı hazır: `profiles.dil` 'ar'yi kabul ediyor, metni gelene kadar bildirim İngilizce.
- [ ] Çevirileri ana dili İngilizce / Almanca / Rusça olan biri okusun (mağaza öncesi).
- [ ] Sunucudan dönen hata mesajları (SQL'de ~115 `raise exception`) Türkçe; uygulama bunları olduğu gibi gösteriyor.
  Kalıcı çözüm: hata kodları + uygulamada çeviri.
- [ ] E-posta şablonları (`apps/web/public/eposta/`) ve yasal sayfalar yalnızca Türkçe; yönetim paneli Türkçe kalacak.
- [ ] Örnek veriler (`data/ornek.ts`, `components/Ornek*`; sunucu anahtarı yokken görünür) Türkçe bırakıldı.

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

- **Kilit ekranı penceresi Android'de konum servisinin bildirimi** (`modules/kilit-ekrani`): expo-location'ın ön plan
  servisi bildirimini sonradan değiştirmenin yolu yok (seçenekleri değiştirmek konum güncellemelerini yeniden başlatıyor),
  bu yüzden yerel modül aynı kimlikle yeni bildirim göndererek onu güncelliyor (servis bağı korunur, tek bildirim kalır).
  Süre `Chronometer` ile telefonda sayar (ekran kapalıyken JS her saniye çalışmayabilir); mesafe / hız JS'ten, en sık
  saniyede bir. Görünüm `RemoteViews` (üç sütun), sistemin bildirim yazı stilleriyle (karanlık tema). Kanal varsayılan
  önemde ama sessiz: düşük önemli ("sessiz") bildirimler Android 10+ kilit ekranında görünmüyor. expo-notifications
  sayaç ve özel görünüm vermediği, üstelik ikinci bir bildirim açacağı için kullanılmadı.
  iOS için Live Activity gerekir (ayrı iş).
- **Isı haritaları sunucuda, görünen alan için hesaplanır** (`isi_haritasi`): izler ekranda ~6 piksellik ızgara
  hücrelerine toplanır, hücre değeri farklı aktivite sayısı; uygulama MapLibre ısı katmanıyla çizer. Döşeme sunucusu
  (MVT) kurmak yerine bu seçildi: Supabase oturumu ve kuralları olduğu gibi kullanılıyor, ek servis yok. Küresel /
  haftalık / gece yalnızca herkese açık aktivitelerden, "uçları gizle" 200 m kırpılarak, ısı haritasından çıkanlar ve
  engellenenler hariç; 8. yakınlaştırmadan önce boş (bütün ülkeyi tek istekte toplamamak için). Gece: başlangıç ya da
  bitişte güneş ufkun 6° altında (yaklaşık güneş konumu hesabı, `gunes_yuksekligi`). Kullanıcı artınca önceden
  hesaplanmış hücre tablosuna (ya da kendi döşeme sunucusuna) geçilmeli.
- **Migration'ları Claude uygular** (11 Kasım 2026): İsmail'in bilgisayarından Tailscale üzerinden `ssh root@uygulama`
  çalışıyor; `uygula.sh` önce durum modunda, sonra `uygula` ile çalıştırılır. Migration main'e girince uygulanır.
  `20261112000000_dil.sql` bu yolla uygulandı; sunucuda bütün migration'lar tamam.
  **Sunucuyla ilgili işleri İsmail yapar, Gökhan yapmaz** (migration, Coolify, sunucu ayarları). Gökhan'ın PR'ında
  migration varsa merge sonrası İsmail uygular.

- **Hedefler ve meydan okumalar sunucuda, rozetler telefonda** (33. aşama). Hedefin ilerlemesi ve rozetler kişisel rekorlarla
  aynı veriden telefonda hesaplanır (telefonda bekleyen kayıtlar da sayılır); hedeflerin kendisi sunucuda (`hedefler`, yalnızca
  sahibi okur, kişi başı 12). Meydan okumanın değeri ve sıralaması sunucuda: katılımcının o tarih aralığındaki **bütün**
  aktiviteleri sayılır (gizli olanlar ve katılmadan öncekiler dahil; Strava gibi), sıralamada yalnızca toplam görünür; uygulama
  katılırken bunu söyler. Herkese açık meydan okumayı yalnızca yönetici, grubunkini grubun her üyesi açar (etkinlikteki gibi);
  silme: açan, grup yöneticisi ya da site yöneticisi. Gruptan ayrılan grup meydan okumasından da çıkar (tetikleyici).
  Rozetlerde tek aktivite rozetleri için ortalama hız sınırı var (bisiklet 60, dağ bisikleti 45, koşu 25, yürüyüş 10 km/sa);
  üstü araçta unutulan kayıt sayılır. Toplam rozetlerinde süzgeç yok (rekorlardaki mesafe kuralıyla aynı). Rozet kimlikleri
  kalıcı (`ROZETLER`), ileride sunucuya taşınırsa aynı kalmalı. Dönemler telefonun yerel saatine göre (hafta pazartesi başlar);
  yönetimden açılan meydan okumanın tarihleri Türkiye saatine göre.

- **Kişisel rekorlar telefonda hesaplanır** (`packages/shared/src/rekor.ts`): sunucudan kendi aktivitelerinin yalnızca özet
  sütunları çekilir (iz yok, 1.000'erlik sayfalar), telefonda bekleyenler de katılır; yeni tablo / fonksiyon / migration yok.
  Eşitlikte eski aktivite rekoru tutar. O türde tek aktivite varsa rozet çıkmaz (ilk kayıt her şeyde rekor olurdu).
  En yüksek hızda türe göre üst sınır var (bisiklet 120, dağ bisikleti 100, koşu / patika koşusu 40, yürüyüş / doğa yürüyüşü
  25 km/sa): üstü GPS sıçraması ya da araçta unutulan kayıt sayılır, rekora girmez (aktivitenin kendi sayfasında görünür).
  Mesafe ve süre için böyle bir süzgeç yok; araçta unutulan bir kayıt mesafe rekoru olabilir (ileride: aktiviteyi
  "rekorlara katma" seçeneği). Kullanıcı ve aktivite sayısı çok artarsa sunucu tarafında özet görünüme taşınabilir.

- **Dil desteği: kendi küçük çeviri katmanımız** (i18next yok). Mobil: `apps/mobile/src/i18n/` — `tr.ts` kaynak sözlük,
  `en.ts` / `de.ts` / `ru.ts` aynı anahtarlarla (eksik ya da fazla anahtar TypeScript hatası verir); metin `$t('alan.anahtar', { ad })`
  ile okunur (`t` değil `$t`: kodda yerel `t` değişkenleri çok). Çoğul: `"{n} person|{n} people"`, Rusçada üç biçim. Telefonun dili `Intl` ile
  okunur (yeni yerel modül yok), Ayarlar'da elle seçilir; dil değişince kök düzen yeniden kurulur, bu yüzden metinler modül
  düzeyinde değil kullanıldıkları anda okunmalı (etiket dizileri fonksiyon). Ortak etiketler ve sayı / tarih biçimi
  `packages/shared/src/dil.ts`; web dili her çağrıda açıkça verir (`apps/web/src/lib/dil.ts`, `sozluk.ts`: Accept-Language,
  `?dil=en`, başlık yoksa Türkçe). Şikayet nedeni ekranda kullanıcının dilinde, yönetime Türkçesi gider.
  **Yeni metin eklerken:** `tr.ts`'e anahtar ekle, `en.ts`, `de.ts` ve `ru.ts`'e çevirisini yaz (TypeScript eksikleri gösterir).

- **Çevrimdışı harita: OpenFreeMap + MapLibre çevrimdışı paketleri.** OpenFreeMap (openfreemap.org/tos) uygulama içi
  çevrimdışı indirmeye izin veriyor: bir indirme en fazla 3.000 kare ya da 50 MB, en fazla 4 paralel istek, uygulamayı
  tanıtan User-Agent. Bizde: kare sayısı indirmeden önce hesaplanır (bütçe 2.500), kare boyutu indirirken izlenir (50 MB'ta
  durur), paketler sırayla iner, OpenFreeMap isteklerine `User-Agent: Lykiva/<sürüm> (+https://lykiva.app)` eklenir.
  Bir paketin içindeki paralel istek sayısını MapLibre belirliyor, buradan ayarlanamıyor. Kullanıcı artınca ya
  OpenFreeMap'e (info@openfreemap.org) yazılmalı ya da Türkiye kareleri kendi sunucumuzda barındırılmalı (OpenFreeMap açık kaynak).

- **Hava servisi: MET Norway** (api.met.no locationforecast 2.0) — anahtarsız, ticari kullanım dahil ücretsiz, CC BY 4.0
  ("Kaynak: MET Norway"). Open-Meteo'nun ücretsiz katmanı ticari olmayan kullanımla sınırlı olduğu için seçilmedi.
  Tanıtıcı User-Agent, koordinat 3 ondalık, aynı yer için 30 dk önbellek. Adres `EXPO_PUBLIC_HAVA_URL` ile değişir.
- **Harita türleri** (`apps/mobile/src/components/map/haritaTurleri.ts`): standart = OpenFreeMap Liberty; uydu = Esri
  World Imagery (anahtarsız döşeme); hibrit = uydu + Liberty'nin yol, sınır ve yazı katmanları (stil JSON'u bir kez indirilip
  uygulamada türetilir); kış = Liberty karlı renklerle + OpenSnowMap pist döşemeleri. Seçim telefonda saklanır, bütün
  haritalara uygulanır. Koşullar mağaza öncesi kontrol edilecek (bkz. Mağazaya çıkmadan önce).
- **Derleme: EAS Build** (bulutta; Windows'tan da başlatılır). Mac'te yerel derleme de mümkün.
  EAS projesi ve bütün derleme / gönderimler İsmail'in hesabından ve bilgisayarından (12 Kas 2026); Gökhan EAS'a eklenmez.
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
