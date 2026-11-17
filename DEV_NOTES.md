# Lykiva — Geliştirme Notları

Bisiklet, koşu, yürüyüş ve doğa sporları için takip + sosyal paylaşım uygulaması.
Ekran tasarımları: Lykiva — Mobil Uygulama (Claude Design canvas'ı). Biten aşamaların listesi: `README.md` > Aşamalar.
Çalışma kuralları: `CLAUDE.md`.

## Şu an üzerinde çalışılanlar

Bir işe başlarken buraya adınla ve dalınla bir satır ekle; merge edince kaldır. Başkasının satırındaki dosyalara dokunmadan önce sor.

| Kim | İş | Dal |
| --- | --- | --- |

## Gökhan için: 15 Kasım 2026'da değişenler (İsmail)

Hepsi main'de, yalnızca JS (yeni derleme gerekmez); migration'lar sunucuya uygulandı. Ayrıntılar "Yapılacaklar"da.
- **Harita sekmesi** (#114–#120): Yolculuk yap'ın açık paneli tasarımdaki gibi (hedef, ölçü kartı + yükselti, ulaşım ve
  tercih hapları, kayıt anahtarı, altta Yola çık); panel her durumda tutamağa kadar iner. Arama kutusuna dokununca
  son aramalar (tek tek / hepsi silinir); paneldeki "Son gittiklerin" kalktı. Katman penceresinde harita görünümü
  (Sistemle aynı / Açık / Karanlık). Egzersiz yap paneli aşağıda "Hangi egzersiz?" şeridinde durur.
- **Rota oluşturma** (#118, #119): panel Harita'daki gibi sürüklenir; duraklar büyük, dokununca kalkar.
- **Rotadan başlatma** (#120): "Bu rotayı başlat" artık Harita'nın Egzersiz paneline gider (`/kesfet?rota=`);
  `kayit/index` yalnızca yönlendirir. Kayıt silinince `dismissTo('/')`.
- **Telefon bildirimi** (#121): girişte izin bir kez sorulur; sunucu Expo makbuzlarından ölü jetonları siler
  (pg_cron, `20261118000000_push_makbuzlari.sql`).
- **Rotadan çıkınca titreşim + bildirim** (#123, `kayit/rotaUyarisi.ts`, karar `@lykiva/shared` > `rotaUyarisi`).
- **Aileyle canlı konum** (#124): "Bağlantıyla paylaş" → `lykiva.app/c/<anahtar>` (web sayfası, MapLibre);
  `20261119000000_canli_baglanti.sql`. `kaydedici.baslat`'a beşinci parametre geldi: `canliBaglanti`.
- **GPX içe aktarma** (#126): Profil > Rotalar > "GPX içe aktar" (`app/rota/ice-aktar.tsx`, `@lykiva/shared` > `gpxOku`).
- Telefona Metro'dan kod verirken çalışan kopyanın main'de olduğuna bak: 15 Kas'ta Metro 22 commit geride bir
  worktree'den çalışıyordu, "tasarım gitmiş" sanıldı.

## Gökhan için: kilit ekranı iOS (12 Kasım 2026, İsmail)

- **iOS'ta da kilit ekranı penceresi var artık:** Live Activity (kilit ekranı + Dynamic Island), `expo-widgets` ile —
  `modules/kilit-ekrani/index.ios.tsx`. Senin Android modülünün aynı verisini kullanıyor (süre, mesafe, anlık ve ortalama
  hız; kilit ekranında 2×2). Ortak tip `modules/kilit-ekrani/tipler.ts`'e taşındı; tek ek alan `etkinlik` (iOS'ta simge
  için; Kotlin tarafı bilmediği alanı yok sayar). Alan eklersen hem `tipler.ts`'e hem `index.ios.tsx`'teki `PencereProps`'a ekle.
- Android tarafına (Kotlin, düzenler) dokunulmadı: senin `kilit-ekrani-anlik-hiz` PR'ındaki hâli duruyor. Bu dalda Kotlin
  modülünü ben de yeniden yazmıştım; birleştirirken seninkini esas aldım, benimkini çıkardım.
- Tek davranış farkı (JS, iki platform): uygulama açılışta kayıt yoksa önceki oturumdan kalan pencereyi bir kez kapatıyor
  (uygulama kayıt sürerken kapandı / çöktüyse pencere asılı kalmasın).
- `.gitignore`: senin `ios/` + `android/` ve `!apps/mobile/modules/*/…` kuralların yerine yalnızca `/apps/mobile/ios/` ve
  `/apps/mobile/android/` (aynı sonuç, daha dar).
- `expo-widgets` ve `@expo/ui` Android derlemesine girmiyor (`apps/mobile/package.json` > `expo.autolinking.android.exclude`).
- Yeni iOS derlemesi gerekiyor; derlemeyi İsmail alacak.

## Gökhan için: 11 Kasım 2026'da değişenler (İsmail)

- **Play dahili test yayında** (sürüm 2, 0.1.0). Tester listesi "Gösterge test". Katılma bağlantısı aşağıda (Bekleyen elle yapılacaklar 6).
  Güncel sürüm 4 (12 Kas 2026): main'deki her şey. **Kilit ekranı penceresi sürüm 4 ve 5'te yok:** modülün Kotlin kodu
  `.gitignore` (`android/`) yüzünden repoya girmemişti, derleme modülsüz geçti. Düzeltme PR'ından sonraki derlemeyle gelir.
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
3. **Geliştirme derlemelerini telefonlara kur** (Android APK + iOS, 13 Kas 2026'da alındı; EAS build kimlikleri "Telefona kurulum"da):
   iPhone'da Geliştirici Modu'nu aç, Gökhan `npm run mobile` ile Metro'ya bağlansın.
4. **Hetzner depolama anahtarını yenile:** gizli anahtar sohbette paylaşıldı. Hetzner Console > Security > S3 credentials'ta
   yeni çift oluştur, `/etc/lykiva-yedek.env`'de `S3_ANAHTAR` / `S3_GIZLI`'yi değiştir (Claude yapabilir: erişim anahtarını
   sohbete, gizliyi yalnızca sunucuya yaz), sonra eski iki çifti (`3W8WDQ…`, `CZE21…`) sil.
5. **Coolify API anahtarı (12 Kas 2026; 15 Kas'ta lykiva-web kurulumu için yine kullanıldı, hâlâ etkin):** sohbette paylaşılan anahtarı (`4|HHdY…`)
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
11. **Android sürüm 4'ü telefonda dene** (12 Kas 2026'da Play dahili teste yüklendi): hedefler /
    meydan okumalar / rozetler, harita türleri, ısı haritaları ilk kez telefonda. Neye bakılacağı aşağıda
    "Telefonda ve gerçek sunucuda denenmemiş özellikler"de. (Kilit ekranı penceresi bu sürümde yok; madde 12.)
12. **Android sürüm 8 Play dahili testte yayında (15 Kas 2026, 07:58; main `d59f193`, versionCode 8):** Claude `eas submit` ile
    gönderdi. 15 Kasım'daki her şeyi içerir (sürüm 7'nin üstünde). Testçiler telefonda Play'den güncelleyip "Telefonda ve
    gerçek sunucuda denenmemiş özellikler"deki 15 Kasım maddelerini denesin.
12b. **Sürüm 6'da kilit ekranını telefonda dene** (aşağıda "Kilit ekranı" maddesi).
13. **Play gönderimi kuruldu (15 Kas 2026):** hizmet hesabı `play-yukleme@lykiva.iam.gserviceaccount.com` (Play Console'da
    yalnızca Lykiva; uygulama bilgisi görme + test kanallarına yayınlama), JSON anahtarı EAS'ta. Sonraki Android sürümleri:
    `npx eas-cli@latest build -p android --profile production --auto-submit` (derler ve dahili teste gönderir) ya da
    derlemeden sonra `eas submit -p android --latest`. Üretime göndermek için hesaba "Üretime yayınla" izni gerekir.
14. **Görünüm (karanlık mod), iOS'ta derleme bekliyor:** Android sürüm 7'de geldi. `gorunum-ayari` PR'ı (sürüm 6'dan sonra main'e girdi) `app.json`'da `userInterfaceStyle`'ı
    `automatic` yaptı (önce `light`). Yeni derlemeye kadar Aydınlık / Karanlık seçimi çalışır, "Telefonun ayarı" ise
    her zaman aydınlık görünür (eski derleme telefonun temasını uygulamaya bildirmiyor).

Gizlilik, ek gizlilik / engelleme ve kulüpler migration'ları (`20261115…`, `20261116…`, `20261117…`) 13 Kas 2026'da
sunucuya uygulandı (`uygula.sh`, SSH ile). `grup` (herkese açık) ve `grup_gonderi` (gizli) kovaları ve altı depolama
kuralı yerinde. Telefonda denenecekler aşağıda.

## Yapılacaklar

### [~] Telefona kurulum (EAS)
EAS projesi `@ismailtopcam/lykiva` bağlandı, `apps/mobile/eas.json` profilleri hazır (development / preview / production).
Kalan: telefonlarda deneme. Yeni yerel modüller (fotoğraf, bildirim, kilit ekranı) bu derlemelerle geldi.
- **iOS geliştirme derlemesi alındı** (13 Kas 2026; main `b7a2824`, build 8, development profili). Kayıtlı cihaz: iPhone 8 Plus
  (`eas device:create`). Ad hoc profiller iki hedef için (Lykiva + ExpoWidgetsTarget) etkileşimli derlemede Apple girişiyle
  oluşturuldu. EAS: build `81eb7a73-…`, kurulum linki 26 Kas 2026'ya kadar. SDK 58'in alt sınırı iOS 16.4; iPhone 8 Plus
  en fazla 16.7'ye çıkar, yeterli. Telefonda Geliştirici Modu açılmalı (Ayarlar > Gizlilik ve Güvenlik; seçenek ancak
  uygulama kurulup bir kez açılmaya çalışılınca görünür). Yeni iPhone eklenirse `device:create` + yeni derleme gerekir.
- Metro'yu Gökhan kendi bilgisayarında çalıştırır (`npm run mobile`). Telefon aynı ağda değilse
  `npm run start --workspace @lykiva/mobile -- --tunnel`.
- **Android geliştirme derlemesi alındı** (13 Kas 2026, Gökhan'ın telefonu için; main `e7ae72c`, debug APK, development profili).
  EAS: build `a9dcc157-…`, APK linki 26 Kas 2026'ya kadar geçerli. Kurulduktan sonra `apps/mobile`'da `npm run mobile` ile
  Metro'ya bağlanılır. Yeni yerel modül / `app.json` değişikliği gelene kadar yeni derleme gerekmez.
- EAS'taki `expo doctor` uyarısı giderildi (13 Kas 2026): `expo` ~58.0.25, `expo-dev-client` ~58.0.20, `expo-location` ~58.0.22
  (`npx expo install --fix`; `expo-doctor` 20/20). İçlerinde küçük yerel değişiklikler var (dev-launcher, expo-location'ın
  `next` API'si; kullanmıyoruz), sonraki derlemeyle gelir. Bu Android geliştirme derlemesi yeni JS ile çalışmaya devam eder.

### [ ] Telefonda ve gerçek sunucuda denenmemiş özellikler
Kod ve SQL testleri geçti, ama gerçek ortamda henüz çalıştırılmadı:
- 15 Kas 2026 (İsmail; yalnızca JS): **Harita** paneli (tutamağa inme, kısa özet ↔ açık panel geçişi, yol hesaplanmışken
  karttaki yükselti profili, haplar), son aramalar (klavye açıkken çarpı), harita görünümü seçimi (gerçek MapLibre'de),
  Egzersiz panelinin şerit durağı. **Rota oluşturma** paneli ve durak silme (yanına yeni durak eklenmemeli).
  **Rotadan başlat → durdur → kaydı sil** (ana sayfaya dönmeli, eski başlatma ekranı çıkmamalı). **Bildirim izni**
  girişte soruluyor mu, takip / beğeni / yorum bildirimi geliyor mu (iPhone'dan henüz hiç jeton yok). **Rotadan
  çıkınca** cepteyken / kilitliyken titreşim ve bildirim, dönünce kalkması. **Canlı konum bağlantısı** uçtan uca
  (başka telefonda sayfa ilerliyor mu, bitince "Paylaşım bitti"). **GPX içe aktarma** (dosya seçici iOS / Android;
  Komoot / Strava / Garmin dosyaları; aktivite olarak süre ve hız).
- 3B video temaları (15 Kas 2026, İsmail; yalnızca JS): Paylaş > şeridin sonundaki "Yörünge 3B" / "Takip kamerası 3B" (şehir
  şablonları 20 km altı rotada). "3B videoyu hazırla" → ilerleme çubuğu → "Videoyu paylaş": video Instagram / WhatsApp'ta
  oynuyor mu? Ekrandan çıkınca bildirim geliyor mu, dokununca paylaşım ekranı açılıyor mu? Uygulamayı arka plana atıp
  geri gelince takip sürüyor mu? `.env`'de `EXPO_PUBLIC_ALTYAPI_ANAHTARI` yoksa video temaları görünmez.
- Birlikte ve Harita posteri temaları (15 Kas 2026, İsmail; yalnızca JS): birlikte yapılmış gerçek bir aktivitede
  avatarlar ve adlar doğru mu (sahip dahil, kişi sayısı)? Posterde koordinatlar uçlar gizliyken evden uzak mı?
- Paylaşım kartlarında harita zemini (15 Kas 2026, İsmail; yalnızca JS): Gece haritası ve Hız haritası temalarında
  koyu harita (kıyı, yollar) rotanın altına oturuyor mu, paylaşılan görselde de var mı (karolar inmeden yakalanmamalı)?
  Uzun rotada (100+ km) ve şehir içinde ne kadar hızlı açılıyor, telefon takılıyor mu? Uçak modunda kart zeminsiz çıkmalı.
- Paylaşım temaları (15 Kas 2026, İsmail; yalnızca JS, yeni derleme gerekmez): aktivite > Paylaş > önizlemenin altındaki
  tema şeridi. Her temayı seç; Hikâye ve Kart görseli düğmeleriyle paylaş: görsel tam mı (boş ya da kırpık değil mi),
  yazılar taşıyor mu (uzun aktivite adı, Almanca / Rusça), "Başlangıç ve bitişi gizle" izi kısaltıyor mu? Fotoğraf
  temasında galeri ve kamera; fotoğraf seçmeden paylaşınca galeri açılıyor mu? Rakımı olmayan kayıtta Zirve profili,
  hızı gizli aktivitede Hız haritası şeritte görünmemeli. 2× ekranlı telefonda görsel bulanık mı?
- Kaydırılan bilgi paneli: Harita sekmesi ve Egzersiz kaydı (13 Kas 2026, Gökhan; `harita-panel-kademe`,
  `harita-panel-surukle`, `panel-akici`; ortak kanca `components/panelKademesi.ts`). Panel tek uzun sayfa, kademeler
  o sayfanın bölümleri; panel ekranın altına yaslı, görünen boyu tek bir Animated değeri ve taşanı keser. Parmakla
  sürükleyince aşağıdaki bölümler görünür, içerik hiç değişmez; bırakınca parmağın hızına göre en yakın bölüm sonuna
  oturur (260 ms). En üst / en alt durağın ötesine lastik gibi az gider. Ok düğmeleri kaldırıldı.
  - Harita sekmesi: 1. özet (hedef, etkinlik, tercih, mesafe / tırmanış / iniş / süre, Yola çık; hedef seçilince bununla
    açılır), 2. yükselti (eğim profili; rakım yoksa bu bölüm yok), 3. tırmanışlar ve rüzgâr (uzunsa içi kayar).
    Sürükleme alanı 1. bölüm. Tutamacın altındaki noktalar kademeyi gösterir; seçilen kademe hedef değişince de kalır.
  - Egzersiz kaydı: 1. küçük satır (mesafe / kalan, süre, anlık hız) ve Duraklat / Bitir, 2. rota ilerlemesi ve
    diğer değerler, 3. tam ekran: büyük yazılı anlık hız, mesafe, süre, varışa / ort. hız, tırmanış (panel durum
    çubuğunun altına kadar). Harita tam ekran, panel üstünde; panelin tamamı sürükleme alanı.
  - Denemeler: önce kademe değişince içerik değişiyordu (sürüklerken her adımda ekran yeniden çiziliyordu: gecikme;
    sonra LayoutAnimation + Animated birlikte: bırakınca titreme). Tek sayfa + tek animasyonla ikisi de gitmeli.
  Bakılacaklar: iki ekranda da sürükleme parmağa gecikmesiz geliyor mu, bırakınca titremeden oturuyor mu; kısa hızlı
  fırlatma bir sonraki bölüme gidiyor mu; bölümler arasında boşluk / kesik görünüyor mu; Egzersizde tam ekranda büyük
  değerler okunuyor mu, ana sayfa düğmesi tutamaçta çıkıyor mu; takip açıkken konum işareti panelin üstünde mi;
  Duraklat / Bitir dokunması sürüklemeyle karışıyor mu; Harita 3. kademede harita yeterince görünüyor mu?
- Harita sekmesinde konum hızlı (13 Kas 2026, Gökhan, `harita-konum-hizli`): sekme açılınca harita önce telefonun son
  bilinen konumuna (en fazla 5 dk eski) hemen gelir, GPS'in ilk konumu gelince oradan sürer; izin zaten verildiyse her
  açılışta yeniden istenmez; yerinde dururken 1 m'den az GPS kıpırtısında ekran yeniden çizilmez (önceden saniyede bir
  bütün ekran çiziliyordu). Aynısı Kayıt başlat ve Rota oluştur ekranlarında. Bakılacaklar: Harita sekmesine dokununca
  konum ~1 sn içinde geliyor mu; uygulama açıkken akıcı mı; başlat ekranındaki GPS etiketi ilk saniyelerde doğru mu
  (son bilinen konumun doğruluğunu gösterebilir)? Yalnızca JS, yeni derleme gerekmez.
  Açılışta konum (13 Kas 2026, Gökhan, `acilista-konum`): uygulama açılınca ve arka plandan öne gelince konum önceden
  alınıyor (`konumuIsit`: son bilinen + tek bir Balanced konum; GPS sürekli açık kalmaz, son 30 sn'de konum varsa
  alınmaz). İzin istemez: izin hiç verilmediyse bir şey yapmaz, izni Harita sekmesi ister. Bakılacaklar: uygulamayı
  açıp hemen Harita sekmesine geçince harita doğrudan konumda açılıyor mu; açılışta izin penceresi çıkmıyor mu?
- Harita renkleri (13 Kas 2026, Gökhan, `harita-renkleri`): harita gündüz açık, gün batımından gün doğumuna kadar koyu;
  uygulama karanlık temadaysa (telefonun ayarı ya da Ayarlar > Görünüm > Karanlık) gündüz de koyu. Kayıt ekranı dahil
  bütün haritalar; kayıt sürerken gün batarsa harita koyuya geçer. Gün batımı telefonun son bilinen konumundan
  (`gunduzGece.ts`, hesap `packages/shared/src/gunes.ts`; konum izni yoksa 07:00–19:00 gündüz). Koyu harita OpenFreeMap Liberty'den
  türetiliyor (`stilRenkleri.ts`): patikalar, orman, park, su, yer adları ve ilgi noktaları duruyor (eski OpenFreeMap Dark'ta
  yollar bile zor seçiliyordu). Açık haritada patikalar beyaz yerine kahve-gri kesikli (rota çizgisinin morundan ayrı).
  Standart stilin JSON'u telefonda saklanıyor (açılışta hemen hazır). Bakılacaklar: güneşte kayıt ekranında açık harita
  okunuyor mu, gece koyu harita göz alıyor mu; gün batımında (bir dakika içinde) koyuya geçiyor mu, geçerken rota çizgisi
  kayboluyor mu; durum çubuğu (saat, pil) açık haritada koyu mu; ilk kurulumda harita bir kez
  yeniden yükleniyor mu (stil inince), sonraki açılışlarda yükleniyor mu? Çevrimdışında indirilmiş rota koyu temada da
  açılıyor mu? Yalnızca JS, yeni derleme gerekmez. Stiller tarayıcıda (maplibre-gl) karşılaştırıldı ve MapLibre stil
  doğrulayıcısından hatasız geçti; telefonda görülmedi.
- Rota çizgisi rengi (13 Kas 2026, Gökhan, `rota-rengi`): rota çizgisi turuncu yerine mor; başlangıç mor halka, bitiş
  dolu mor nokta. Kayıtta (canlı takip) gidilen kısım mavi, kalan kısım gri düz çizgi (önceden kesikliydi); kayıt
  ekranında başlangıç işareti de çıkıyor. Bakılacaklar: mor, mavi ve gri açık / koyu haritada ayırt ediliyor mu, eğim
  renkli rotada kalan kısım düz renkli mi? Yalnızca JS, yeni derleme gerekmez.
- Kayıt ekranı (13 Kas 2026, Gökhan): ~~standart harita türünde siyah zeminli gece stili (OpenFreeMap Dark)~~ (yukarıda:
  harita artık temayı izliyor), sağda
  katman / 2D-3D / Konumum düğmeleri (haritayı elle kaydırınca takip bırakılır, Konumum yeniden takibe alır; 3D'de
  kamera 60° eğilir, binalar yükseltilir), harita kalan alanı alır ve alt panel sıkılaştırıldı. Yeni yerel modül yok,
  yeni derleme gerekmez; telefonda geliştirme derlemesiyle denenecek (3D binalar ve yazı katmanı sırası özellikle).
  Aynı gün: kayıt sırasında Duraklat ve Bitir ayrı düğmeler (Bitir onay sorar; yeterli GPS noktası yoksa silmeyi
  önerir). Bilgi paneli küçük (tek satır) / normal / tam ekran: tutamacı yukarı-aşağı kaydır ya da sağdaki oklara bas.
- Kulüpler (13 Kas 2026, Gökhan; migration uygulandı): Gruplar sekmesinde Meydan okumalar / Kulüpler /
  Etkinlikler geçişi (Almanca, Rusça dar ekranda sığıyor mu?). Kulüp sayfasında yönetici fotoğrafa dokunup grup fotoğrafı
  ekliyor / değiştiriyor / kaldırıyor mu, listede ve keşfette görünüyor mu? Paylaş sekmesinden metin + 4 fotoğraf paylaş;
  ikinci telefondan (üye) Gönderiler'de görünüyor mu, üye olmayan göremiyor mu, yönetici başkasının gönderisini silebiliyor mu?
  Haftalık sekmesi: bu haftaki kayıtlar, gün gün çubuklar, sıralama; "takipçilere" kaydı takip etmeyen üyede sayılmıyor mu?
- Profili paylaş (13 Kas 2026, Gökhan; yalnızca JS, yeni derleme gerekmez): Profil'de "Profili düzenle"nin yanındaki
  "Profili paylaş" düğmesi (Almanca / Rusça sığıyor mu?) → Arkadaşlar / Kulüpler geçişi, "Lykiva'da ara" kutusu
  (Arkadaşlar'da kişi, Kulüpler'de açık kulüp arar). Arkadaşlar altında Önerilenler (tanıyor olabileceklerin) /
  Kişiler (takip ettiklerin ve takipçilerin) / QR kodu. QR'ı başka telefonun kamerasıyla okut: web profili
  (`/u/<kullanıcı>`) açılıyor mu, karanlık temada okunuyor mu? Geçici hesapta QR yerine giriş çağrısı çıkıyor mu?
  QR için `react-native-qrcode-svg` eklendi (JS; `react-native-svg` zaten vardı, kök `node_modules`'a taşındı).
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
- Isı haritaları (migration uygulandı): katman düğmesi > Isı haritası > Küresel / Haftalık / Gece / Kişisel.
  Yakınlaştırınca (8. düzey, aşağı yukarı bir il) çıkıyor mu, kaydırınca yenileniyor mu, hızlı mı? Kişisel uzaktan da
  görünüyor mu? Yeni bir kayıttan sonra kişiselde çıkıyor mu? Ayarlar > Gizlilik > "Isı haritalarında görün" kapatılınca
  başka hesaptan bakınca o kişinin izleri kayboluyor mu? Uydu / hibrit üstünde renkler okunuyor mu?
- Kilit ekranı (yeni derlemeyle; sürüm 6'dan itibaren; ilk kez derlendi, telefonda denenmedi).
  Android: kayıt başlat, ekranı kapat; kilit ekranında süre sayıyor mu, mesafe ve anlık hız yürüdükçe değişiyor mu, durunca
  anlık hız birkaç saniyede 0'a düşüyor mu? Bildirimi açınca 2×2 düzende ortalama hız da görünüyor mu? Bildirim
  çekmecesinde tek bildirim mi kalıyor ("Lykiva kaydediyor" + pencere iki ayrı bildirim olmamalı)? Duraklat / devam et:
  süre duruyor, devamda kaldığı yerden sayıyor mu? Bitir / iptal: pencere kayboluyor mu? Karanlık temada yazılar
  okunuyor mu, büyük yazı boyutunda kapalı bildirime sığıyor mu? Samsung / Xiaomi gibi kendi arayüzü olanlarda görünüm?
  Android 13+'ta bildirim izni reddedilince kayıt yine sürüyor mu? Arka plan izni "Şimdi değil" denince de pencere çıkıyor mu?
  iOS: kayıt başlat, kilitle; kilit ekranında pencere (2×2) çıkıyor mu, süre sayıyor mu, mesafe / anlık hız yürüdükçe
  değişiyor mu, durunca anlık hız 0'a düşüyor mu (arka planda JS zamanlayıcısı seyrek çalışabilir)?
  Dynamic Island'lı iPhone'da küçük görünüm (simge + süre) ve uzun basınca açılan görünüm. Duraklat: süre duruyor mu,
  devamda kaldığı yerden mi? Bitir / iptal: pencere hemen kalkıyor mu? Uygulamayı kayıt sürerken kapatıp açınca ikinci
  pencere açılmıyor mu? Ayarlar > Lykiva > Canlı Etkinlikler kapalıyken kayıt sorunsuz sürüyor mu? Karanlık kilit ekranında
  yazılar okunuyor mu?
- Görünüm (Ayarlar > Görünüm: Telefonun ayarı / Aydınlık / Karanlık): seçince ekranlar yeni renkle açılıyor mu, uygulama
  kapanıp açılınca seçim kalıyor mu? Karanlıkta her ekranı gez: okunmayan yazı, açık renkli kalan kutu var mı? Uyarı
  pencereleri ve klavye de karanlık mı? "Telefonun ayarı"ndayken telefonun temasını değiştirip uygulamaya dön (yeni
  derlemeden sonra); kayıt sürerken değiştirince kayıt ekranı bozulmuyor mu (kayıt bitip uygulama öne gelince uygulanmalı)?
- Gizlilik kontrolleri (migration uygulandı 13 Kas 2026; Ayarlar > Gizlilik > Gizlilik kontrolleri): iki hesapla dene.
  Profil sayfası "Takipçiler" / "Hiç kimse": öbür hesaptan kişi sayfasında yalnızca ad ve fotoğraf, "Bu kişi profil
  ayrıntılarını gizliyor" yazısı; takip edince (Takipçiler'de) ayrıntılar açılıyor mu? Web profili (`/u/<kullanıcı>`)
  "Herkes" dışında bulunamadı diyor mu? Aktiviteler: seçince "Yalnızca yeni kayıtlar / Hepsine uygula" soruluyor mu,
  yeni kayıt seçilen görünürlükle mi açılıyor (internetsiz kaydedilip sonra gönderilen de)? Grup aktiviteleri
  "Hiç kimse": seni etiketleyen kişinin aktivitesinde başkaları adını görmüyor, akış kartında "X ile" yazmıyor mu?
  Bahsetmeler "Hiç kimse": seni eklemeye çalışınca "izin vermiyor" hatası çıkıyor mu? Isı haritası anahtarı da burada.
- Ek kontroller ve engelleme (migration uygulandı 13 Kas 2026; Gizlilik kontrolleri > Ek kontroller): iki hesapla. Engelle (kişi
  sayfasının altında): öbür hesap seni aramada bulamıyor, profilin "bulunamadı", aktivitelerin akışta yok, takip
  edemiyor; Engellenen hesaplar listesinde görünüyor, engeli kaldırınca her şey geri geliyor mu (takipler gelmez)?
  Harita görünürlüğü kapalıyken yeni kayıt uçları açık mı, "Geçmiş aktivitelerime de uygula" hepsini değiştiriyor mu?
  Gizli ayrıntılar: hız gizliyken öbür hesapta hız "—", "Hız ve molalar" düğmesi molasız aktivitede yok mu; molalar
  gizliyken mola noktaları / fotoğrafları çıkmıyor mu? Geçmiş aktiviteleri düzenle: görünürlük ve uçlar toplu değişiyor
  mu? Meydan okuma "Hiç kimse": öbür hesapta sıralamada "Gizli katılımcı", dokununca sayfa açılmıyor mu?

### [~] Google Play — dahili test
Play Console'da **Lykiva** oluşturuldu (kişisel geliştirici hesabı, paket `app.lykiva.mobile`, Türkçe, ücretsiz).
Kaydedilenler: gizlilik politikası URL'si, uygulama erişimi (giriş zorunlu değil: "Şimdilik geç" ile geçici hesap),
reklam yok. EAS ortam değişkenleri (production / preview / development) girildi; imzalama anahtarını EAS tutuyor
(Play App Signing). Mağaza metinleri ve beyan taslakları: `apps/mobile/MAGAZA.md`.
**Dahili test yayında** (11 Kas 2026): sürüm 2 (0.1.0), hedef SDK 36, tester listesi "Gösterge test" (3 kişi).
**Sürüm 4 yüklendi** (12 Kas 2026, versionCode 4, güncel main): hedefler / meydan okumalar /
rozetler, harita türleri, ısı haritaları, dil desteği, çevrimdışı harita, kişisel rekorlar.
**Sürüm 5 derlendi** (12 Kas 2026, güncel main): Expo SDK 58 yama güncellemeleri, kendi BRouter / Photon sunucularımız +
uygulama anahtarı, "yalnızca Türkiye" uyarısı. **iOS build 4 TestFlight'a gönderildi.** Android versionCode 5 AAB'si hazır,
Play Console > Dahili test > Yeni sürüm'e elle yüklenecek (İsmail).
**Sürüm 6 derlendi** (12 Kas 2026, güncel main): kilit ekranı penceresi (Android bildirim + iOS Live Activity, ilk derleme),
BRouter / Photon yeni adreste (`*.ismailtopcam.dev`). Android versionCode 6, iOS build 8 (5–7 numaraları başarısız
denemelerde harcandı). iOS'ta yeni hedef `ExpoWidgetsTarget` için profil etkileşimli derlemeyle (Apple girişi) oluşturuldu;
App Group `group.app.lykiva.mobile` Apple Developer'da elle açılıp `app.lykiva.mobile` ve `.ExpoWidgetsTarget`'a bağlandı
(otomatik eşitleme `TIBURON_APP_CONSENT` verdiği için). **Android versionCode 6 Play dahili teste yüklendi, iOS build 8 TestFlight'a gönderildi** (12 Kas 2026; "Team (Expo)").
**Sürüm 7 derlendi** (13 Kas 2026, main `230e3fe`): sürüm 6'dan sonra gelen her şey (görünüm / karanlık mod, gizlilik
kontrolleri ve engelleme, kulüpler, harita döndürme, profil çevirileri). Android versionCode 7 AAB'si hazır (EAS build
`e82b3034-…`), Play Console > Dahili test > Yeni sürüm'e elle yüklenecek (İsmail). iOS bu sefer derlenmedi.
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
- **Üç ayrı Coolify uygulamasına ayrıldı (17 Kas 2026, İsmail):** `brouter`, `photon`, `video` (eski `lykiva-altyapi`; içinde kart-video servisi).
  Her biri kendi kapısıyla ve kendi Watch Paths'iyle: mobil / web PR'ları artık BRouter'ı, Photon'u ve kart-video'yu
  yeniden kurmuyor (otomatik deploy 16 Kas'ta düzelince her push dördünü birden kuruyordu). Alan adları, anahtar ve
  uygulama tarafı aynı; Gösterge iç ağdan `brouter` / `photon` adlarıyla kullanmaya devam ediyor. Ayrıntı: `altyapi/README.md`.
  Dördü de (`brouter`, `photon`, `video`, `lykiva-web`) GitHub App'e bağlı: `main`'e birleşen değişiklik yalnızca ilgili
  uygulamayı kendiliğinden kurar (`video` ve `lykiva-web` 17 Kas'a kadar bağlı değildi, elle kuruluyordu).

İlk kurulum: Coolify > Uygulamalar > production > **lykiva-altyapi** (Docker Compose, `altyapi/docker-compose.yml`, sunucu "uygulama"):
`https://brouter.ismailtopcam.dev` (BRouter 1.7.10, Türkiye ve çevresi 8 karo) ve `https://photon.ismailtopcam.dev` (Photon 1.3.0,
Türkiye, tr + en; 1,18 milyon kayıt, 449 MB). `PHOTON_BELLEK=3g` (ilk içe aktarma ~3 GB, 5 dk; sonra ~400 MB).
Denendi: BRouter dört profilde brouter.de ile aynı sonuç (Kaş 3653 m); Photon Türkçe aramalarda komoot ile aynı ya da daha iyi.
Haftalık güncelleme Coolify > Scheduled Tasks: pazartesi 05:00 BRouter segmentleri, 05:30 Photon verisi
(`veri-guncelle.sh && kill 1` — bitince Photon yeniden başlar, ~13 sn kesinti; denendi).
Uygulama: EAS ortam değişkenleri `EXPO_PUBLIC_BROUTER_URL` / `EXPO_PUBLIC_PHOTON_URL` (production / preview / development)
girildi → **sürüm 5'ten itibaren** kendi sunucularımız; o zamana kadar telefonlar brouter.de / photon.komoot.io kullanır.
- **Alan adı değişti (12 Kas 2026):** `brouter.` / `photon.ismailtopcam.dev`; EAS değişkenleri buna çevrildi (sürüm 6'dan
  itibaren). Eski `brouter.` / `photon.lykiva.app` adları aynı gün Coolify'dan, kapıdan ve Cloudflare DNS'ten kaldırıldı
  (sürüm 5'te rota çizme ve yer arama artık çalışmaz; Android sürüm 6 yayında, iOS'ta henüz tester yok).
- [ ] **Kapsam yalnızca Türkiye:** Photon'da yurt dışı yer yok ("Eiffel" → Bandırma'da bir kuaför), BRouter karoları
  E25–E45 / N35–N45 dışında rota çizmez. Almanca / Rusça arayüzle yurt dışındaki kullanıcılar etkilenir. Öneri: kendi
  sunucu hata verirse ya da sonuç boşsa uygulama herkese açık sunuculara düşsün (`lib/yonlendirme.ts`, `lib/yerArama.ts`).
  Şimdilik yapılmadı (İsmail, 12 Kas 2026); yerine kullanıcıya uyarı: rota çizme panelinde "yalnızca Türkiye'de çalışıyor",
  arama sonuçlarının altında "yalnızca Türkiye'deki yerler", kapsam dışında rota istenince açıklayıcı hata (dört dilde, sürüm 5).
- [~] **Uzun rotalar yavaş — sebep işlemci hızı, bellek değil** (12 Kas 2026 ölçümü, kapı üzerinden, bizde | brouter.de):
  Kaş yürüyüş ~4 km 0,41 | 0,44 sn · Belgrad Ormanı ~15 km 0,42 | 0,32 · Kaş–Kalkan ~27 km 0,58 | 0,66 ·
  Antalya–Kemer ~45 km 2,5 | 0,8 · İstanbul–Bursa 139 km 7,5 | 2,4. Kısa rotalarda fark yok, uzunlarda ~3 kat yavaş.
  `BROUTER_BELLEK=1G` denendi, fark yok (bellek kullanımı ~300 MB); 512M'ye geri alındı. Bir rota **tek çekirdekte**
  hesaplanır (ölçümde %104 işlemci) → çekirdek sayısı tek rotayı hızlandırmaz, her çekirdeğin hızı hızlandırır.
  Şimdilik kabul (uygulama hesaplarken bekleme göstergesi gösteriyor).
- **Ölçekleme planı (BRouter):** sunucu "uygulama" 6 çekirdek (AMD EPYC, paylaşımlı vCPU), diğer uygulamalarla ortak;
  BRouter aynı anda en fazla 4 rota hesaplar (`BROUTER_ISLEM=4`), fazlası sırada bekler. Kullanıcı artınca:
  1) `BROUTER_ISLEM` artır (Coolify > brouter > Environment Variables, yeniden kur; ücretsiz),
  2) çekirdek yetmezse sunucuyu büyüt ya da BRouter'ı ayrı sunucuya taşı (kapı ve alan adları aynı kalır, uygulama değişmez),
  3) tek rotanın hızı da önemliyse ayrılmış ve daha hızlı işlemcili (dedicated vCPU) sunucu. Ne zaman: kapının günlüğündeki
  bekleme süreleri ve 429'lar izlenerek karar verilir. Fiyatlar o zaman sağlayıcıdan bakılır.
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
- "Google ile devam et" düğmesinde Google'ın renkli "G" logosu var (15 Kas 2026; `components/GoogleLogo.tsx`, yalnızca JS).
- **Giriş zorunlu, ekran sadeleşti (15 Kas 2026, yalnızca JS):** "Şimdilik geç" kaldırıldı; giriş yapmamış (geçici hesaplı)
  herkes açılışta giriş ekranını görür. Ekran tek sayfa: e-posta + şifre ile "Giriş yap", "Şifremi unuttum", "ya da" altında
  Google (iOS'ta Apple; kayıt görünümünde "Google ile kayıt ol"), en altta "Hesabın yok mu? Kayıt ol". Eski "Diğer giriş yolları" / sekmeli e-posta ekranı yok.
- **Google girişi düzeltmesi (15 Kas 2026):** aynı Gmail ile e-posta + şifre hesabı varken Google'a basınca sunucu geçici
  hesaba bağlamayı `email_exists` ile reddediyordu, uygulama yalnızca `identity_already_exists`'i tanıdığı için giriş
  yarıda kalıyordu. Artık iki durumda da asıl hesaba Google ile girilir (sunucu Google kimliğini e-postası doğrulanmış
  hesaba bağlar), geçici hesaptaki kayıtlar taşınır. Telefonda denenecek.
- Google girişi uygulama içi tarayıcıda açılıyor (Android'de Chrome Custom Tab, iOS'ta sistem penceresi). Gömülü WebView
  kullanılamaz: Google kendi giriş sayfasını WebView'da açtırmıyor (`disallowed_useragent`). Tarayıcısız seçenek telefonun
  kendi Google hesap seçicisi (yerel modül, yeni derleme ve Google Cloud'da Android / iOS istemcileri gerekir).

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
- **Neden gelmiyordu (15 Kas 2026):** sunucu gönderiyordu (pg_net, Expo 200), ama Expo makbuzları son bildirimler için
  FCM "DeviceNotRegistered" dedi: jetonlar eski kurulumlarındı. İzin yalnızca Ayarlar / Bildirimler'den açılınca
  isteniyordu (yeni kurulum kaydolmuyordu) ve sunucu ölü jetonları yalnızca biletten tanıyordu (bu hata makbuzda gelir).
- **Düzeltme:** giriş yapılınca izin her kurulumda bir kez kendiliğinden istenir, jeton o hesaba kaydedilir
  (`lib/push.ts` > `pushGiristen`; Android 13 için kanal izinden önce açılır). Sunucu 15 dakikada bir Expo makbuzlarını
  okuyup ölü jetonları siler (`20261118000000_push_makbuzlari.sql`, pg_cron işi `lykiva-push-makbuzlari`).
  Yalnızca JS + migration, yeni derleme gerekmez (expo-notifications derlemelerde var).
  **Migration sunucuya uygulandı** (15 Kas 2026, `uygula.sh`, SSH): pg_cron 1.6 açık, iş etkin. Elle denendi: bekleyen
  iki biletin makbuzu istendi, Expo 200 döndü, "DeviceNotRegistered" iki jeton silindi (10 → 8).
- Kalan: telefonda deneme (Android geliştirme derlemesi ve Play sürümü; iPhone'dan henüz hiç jeton yok, TestFlight'ta denenecek).

### [~] Harita + Egzersiz tek sekmede (15 Kas 2026)
Tasarım: "Lykiva — Yolculuk ve Spor birleşik ekranı" (Claude Design canvas'ı). Harita sekmesinin panelinin başında
ikili geçiş var: **Yolculuk yap** (yol tarifi) / **Egzersiz yap** (tür seç, kaydı başlat).
- Yolculuk: arama hep yukarıda (hedef seçilince adını gösterir, çarpı hedefi kaldırır). Hedef yokken panelde yalnızca
  geçiş ve "haritaya dokun ya da ara" yazısı; geçmiş arama kutusunun altında (aşağıda). Hedef seçilince panel üç
  kademe: kısa özet (süre + Yola çık; panel aşağı çekilince yalnızca bu kalır), ayrıntı (açılışta burada durur),
  tırmanışlar ve rüzgâr.
- Ayrıntı kademesi tasarımdaki "Yol tarifi (panel açık)" ekranı (15 Kas 2026): hedef adı ve altında "ilçe, il ·
  bulunduğun yerden", ölçü kartı (mesafe, tahmini süre, tırmanış; içinde yükselti profili), iki açılır hap (ulaşım,
  yol tercihi; basınca seçenekleri altında açılır), "Egzersiz olarak da kaydet" anahtarı, en altta büyük Yola çık.
  Kısa özetle ayrıntı aynı yerde durur: panel büyürken kısa özet söner, ayrıntı belirir (`panelKademesi.ts` > `gecis`).
  İniş ölçüsü ve ayrı yükselti kademesi kalktı (profil kartın içinde).
- Arama kutusuna dokununca, bir şey yazılmadan, altında "Son aramalar" açılır (aramayla seçilen son yerler, en fazla 5,
  yalnızca telefonda: `lib/sonHedefler.ts`). Seçilen yer listenin başına geçer. Her satırda çarpı (tek tek siler),
  başlıkta "Temizle" (hepsini siler). Geçmiş yalnızca burada: tasarımdaki paneldeki "Son gittiklerin" İsmail'in
  isteğiyle kaldırıldı (15 Kas 2026).
- Haritanın katman penceresinde **Görünüm**: Sistemle aynı (varsayılan; karanlık temada ya da gün batınca koyu) /
  Açık / Karanlık. Seçim telefonda saklanır, bütün haritalara (kayıt ekranı dahil) uygulanır (`map/gunduzGece.ts`).
  Yalnızca standart türü etkiler; uydu ve hibrit fotoğraf, kış hep açık.
- Rota oluşturma ekranının (`rota/olustur.tsx`) paneli de aynı sürüklenen panel (15 Kas 2026): açılışta en altta kısa
  özet (mesafe, tırmanış, süre) ve Rotayı kaydet; yukarı çekince ayrıntı (ad, etkinlik, ölçüler, profil, zemin,
  görünürlük), rota varsa en üstte tırmanışlar ve rüzgâr; aşağı çekince yalnızca tutamaç. Çizim modları panelle kayar.
  Duraklar büyük çizilir; bir durağa dokununca kaldırılır (TopoMap `basilir` + `onMarkerPress`, MapLibre kaynağının
  onPress'i; dokunuş haritaya gitmez, yanına yeni durak eklenmez). **Telefonda denenmedi.**
- Panel her durumda (yolculuk, egzersiz, boş) tutamağından aşağı çekilince yalnızca tutamaç kalır, harita açılır;
  yukarı çekince ya da tutamağa dokununca son kademesinde geri gelir (`panelKademesi.ts` > `kapanir`). Kapalıyken
  hedef seçilirse panel kendiliğinden açılır.
- Egzersiz: `components/EgzersizPaneli.tsx`, panelde iki kademe: `EgzersizSeridi` ("Hangi egzersiz?" ve tür şeridi;
  panel aşağı çekilince en azından bu kalır) ve `EgzersizAyrinti` (rota, canlı konum, "{tür} başlat"). Rota
  sayfasındaki "Bu rotayı başlat" Harita'nın Egzersiz paneline gider, rota seçili gelir (`/kesfet?rota=`).
  Eski `kayit/index.tsx` artık yalnızca yönlendirir. Kayıt silinince `dismissTo('/')`: yığındaki sekmelere dönülür
  (önce `replace('/')` idi; rotadan başlatılan kayıt silinince sürüklenmeyen eski başlatma ekranı görünüyordu). Seçilen tür ve şeridin sırası telefonda saklanır
  (`lib/egzersizTuru.ts`); en son başlatılan tür başa gelir. Şeridin sonundaki "Tümü" gruplu, aranabilir listeyi açar
  (`app/egzersiz-turleri.tsx`).
- Alt menü dört sekme: Ana Sayfa · Harita · Gruplar · Profil. Egzersiz sekmesi yalnızca kayıt sürerken görünür.

Kalan:
- [ ] **Telefonda denenmedi.** Bakılacaklar: panel kademeleri arasında sürükleme, tür şeridinin kayması, kayıt
  başlayınca / bitince alt menüde Egzersiz sekmesinin çıkıp kaybolması (iOS ve Android), karanlık tema.
  Yeni panelde: tutamağa kadar indirme ve geri açma, kısa özet ↔ ayrıntı geçişinin sürüklerken akıcılığı, yol
  hesaplanmışken kartın içindeki yükselti profilinde parmakla gezme, hapların seçenekleri açılınca panelin boyu.
- [x] "Egzersiz olarak da kaydet" anahtarı (15 Kas 2026): yol tarifinin ayrıntı bölümünde, varsayılan açık, seçim
  telefonda saklanır. Kapalıyken "Yola çık" aynı canlı ekranı açar ama kayıt `kaydetme` işaretiyle başlar: rozet
  "Yol tarifi · tür" yazar, Android bildirimi "kaydediyor" demez, Bitir aktivite oluşturmadan kapatır (`iptalEt`).
  Bitirirken ve duraklatılmış ekranda "Aktivite olarak kaydet" seçeneği durur (fikir değiştirene).
  **Telefonda denenmedi:** bitirme uyarısındaki üç düğme (iOS / Android), kaydedilmeyen yolculukta bildirim metni.
- [ ] Şerit kısayollarını elle düzenleme yok (sıra son kullanılana göre). Tür sayısı artınca gerekebilir.
- [ ] Yeni tür (yüzme, kano, kayak…) eklenmedi; `activity_type` enum'u ve migration ister. Eklenince
  `lib/egzersizTuru.ts`'teki simge ve grup tabloları doldurulmazsa TypeScript hata verir.

### [ ] Küçük eksikler
- Profili paylaş > QR kodu yalnızca kodu gösteriyor: uygulama içinden QR okutma yok (`expo-camera`, yeni derleme
  gerekir) ve okutulan `/u/<kullanıcı>` adresi uygulamada değil web'de açılıyor (iOS universal link / Android App Links
  kurulmadı). "Kişiler" sekmesi takip ettiklerini ve takipçilerini gösteriyor; telefon rehberinden arkadaş bulma
  (`expo-contacts`, yeni derleme + sunucuda eşleştirme) yok.
- Web profil sayfası (`/u/<kullanıcı>`) profil fotoğrafını göstermiyor, baş harfler görünüyor.
- Engellenen kullanıcının açık oturumu erişim anahtarının süresi dolana kadar (varsayılan 1 saat) çalışır.
- Hava yalnızca kayıt başında bir kez ölçülüyor; rota detayında tahmin yok (rotanın planlanan tarihi yok).
- Rota eğimi köprü ve tünelde yanlış olabilir: BRouter çıktısında köprü / tünel etiketi yok (Galata Köprüsü örneğinde denendi), DEM
  köprüde vadinin tabanını, tünelde dağın üstünü verir. Kendi BRouter sunucumuzda etiketin çıktıya eklenip eklenemeyeceğine bakılmalı.
- Alt menü (15 Kas 2026'dan beri): Ana Sayfa · Harita · Gruplar · Profil; Egzersiz sekmesi yalnızca kayıt sürerken araya
  girer ve süren kaydı açar. Egzersiz başlatmak Harita > Egzersiz yap'ta (bkz. "Harita + Egzersiz tek sekmede").
- [x] Kayıt sürerken ana sayfaya dönüş, iOS (13 Kas 2026, Gökhan, `kayit-ana-sayfa-ios`): canlı ve duraklatıldı ekranlarında
  iOS'ta geri kaydırma kapalı olduğu için (haritada yanlışlıkla çıkılmasın) çıkış yolu yoktu; Android'de donanım geri tuşu
  çalışıyordu. Sol üste ev simgeli düğme eklendi (`components/AnaSayfaDugmesi.tsx`): kayıt arka planda sürer, alt menüdeki
  Egzersiz kayda geri götürür. Yalnızca JS, yeni derleme gerekmez. iPhone'da denenecek.
- [x] Egzersiz sekmesinin geçişi (13 Kas 2026, Gökhan, `egzersiz-gecis`): iOS'ta başlat ekranı aşağıdan kayan kart (modal)
  olarak, canlı ekran yandan kayarak açılıyordu; kayıt sürerken önce başlat ekranı açılıp sonra canlıya yönleniyordu.
  Artık sekmeler arası geçiş ve kayıt ekranları (başlat, canlı, duraklatıldı) aynı kısa solmayla (fade, iOS'ta 200 ms);
  Egzersiz kayıt sürüyorsa doğrudan canlı / duraklatıldı ekranını açar. Başlat ekranı aşağı kaydırılarak kapanmıyor,
  sol üstteki kapat düğmesi var. Yalnızca JS. iPhone'da denenecek.
- [x] Harita sekmesi ve yol tarifi (12 Kas 2026, Gökhan, `harita-yol-tarifi`): "Haritalar" sekmesinin adı "Harita" oldu,
  sekme tam ekran harita açıyor (`app/(tabs)/kesfet.tsx`). Hedef haritaya dokunarak ya da yer aramayla (Photon) seçilir,
  bulunduğun yerden yol BRouter'la hesaplanır (etkinlik türü + yol / patika öncelikli; mesafe, tırmanış, tahmini süre).
  "Yola çık" kaydı bu yolla başlatır (kayıt ekranındaki rota takibi, kalan mesafe). Yol geçici: sunucuya rota olarak
  kaydedilmez, aktiviteye `route_id` gitmez (`kayit/paket.ts` artık yalnızca uuid gönderiyor). Eski Keşfet listesi
  `app/kesfet-liste.tsx`'e taşındı, haritanın sağ üstündeki pusula düğmesiyle açılır. Sesli / adım adım yönlendirme yok.
  Yalnızca JS, yeni yerel modül yok. Telefonda denenecek: dokunarak hedef seçme, kamera yolu tam gösteriyor mu, "Yola çık".
- [x] Ortak harita: Harita sekmesi + kayıt ekranı (13 Kas 2026, Gökhan, `ortak-harita`): iki ekran da
  `components/map/YolHaritasi.tsx`'i kullanıyor (harita, eğime göre renkli yol, sağ sütunda 3B/2B ve konum düğmeleri;
  Harita sekmesinde açık, kayıtta koyu düğmeler). **İki haritada da olması gereken değişiklik buraya yapılır.** Kayıtta
  tamamlanan kısım rota renginde (mor), kalan kısım eğim renginde kesikli (TopoMap: `routeColors` artık `progress` ile de çalışıyor).
  Konum düğmesi Harita sekmesinde bir kez konuma götürür, kayıtta takibi açar. Yalnızca JS. Telefonda denenecek.
- [x] Rota çizgisi rengi (13 Kas 2026, Gökhan, `rota-rengi`): haritalardaki düz rota çizgisi turuncu yerine mor
  (açık harita `#6A3FD0`, koyu `#A98BFF`; `stilRenkleri.ts` > `ROTA_RENGI`, gerçek harita ve Expo Go yedek haritası).
  Karar: Strava'nın turuncusuna benzemesin; mor haritadaki su, yeşil alan, sarı-turuncu ana yol, kahve patika ve eğim
  renkleriyle de karışmıyor. Eğim renkleri (rakımı olan rotalarda) ve marka rengi (`terra`) değişmedi. Yalnızca JS.
- [x] Yol tarifinde ve rotalarda eğim, tırmanışlar, rüzgâr (13 Kas 2026, Gökhan, `rota-irtifa-ruzgar`): Harita sekmesinde
  yol çizgisi eğime göre renkli; panelde iniş, eğim profili (parmakla gezilir, "Rakım" aralığı), tırmanış listesi ve
  şu anki rüzgâr: rotanın ortası için MET Norway, rüzgârın rota boyunca karşıdan / yandan / arkadan payı (`izdeRuzgar`;
  2 m/s altında pay gösterilmez). Bileşen `components/RotaRuzgari.tsx`; rota çizme ekranında ve kayıtlı rota sayfasında da
  var, rota çizme ekranına tırmanış listesi eklendi. Uzayan paneller kayıyor (harita görünür kalsın diye). Yalnızca
  şimdiki rüzgâr (saat seçilemiyor). Yalnızca JS. Telefonda denenecek.
- [x] Harita sekmesinde 3B/2B ve konum düğmesi sağda (13 Kas 2026, Gökhan, `harita-3b-konum`): Harita sekmesinde 3B/2B
  düğmesi yoktu (yalnızca kayıt ekranında vardı); katman düğmesinin altına eklendi. "Konumuma git" düğmesi sol üstten
  3B/2B'nin altına, sağ sütuna taşındı; arama kutusu sola kadar uzuyor. Yalnızca JS. Telefonda denenecek.
- [x] Haritayı döndürme (13 Kas 2026, Gökhan, `harita-dondurme`): bütün haritalar iki parmakla döndürülebiliyor (önceden
  kapalıydı). Döndürünce katman düğmesinin solunda pusula çıkar, dokununca kuzey yukarı döner. Kayıt ekranında takip
  sürerken döndürme takibi bırakmaz: hareket bitince harita takip edilen noktayı yeniden ortalar (nokta etrafında döner);
  kaydırma / yakınlaştırma takibi bırakır. Yalnızca JS. İki telefonda denendi, çalışıyor.
- [x] Harita renkleri (13 Kas 2026, Gökhan, `harita-renkleri`): gündüz açık, gün batımından sonra ve karanlık temada koyu
  harita (Liberty'den türetilen, ayrıntılı); açık haritada patikalar belirgin. Telefonda denenecekler yukarıda
  ("Telefonda ve gerçek sunucuda denenmemiş özellikler").
- [x] Kilit ekranı / bildirim sayacı sıfırlanıyordu (13 Kas 2026, Gökhan, `kilit-ekrani-sure`): `kaydedici.ts` süreyi
  saniye veriyordu, kilit ekranı modülü milisaniye bekliyor; her güncellemede (en sık saniyede bir, en geç 15 sn'de bir)
  sayaç ~0'dan yeniden başlıyordu. Android ve iOS ikisi de etkileniyordu. Yalnızca JS, yeni derleme gerekmez.
- [x] Bisiklet + "yol öncelikli" yol tarifi dolanıyordu (15 Kas 2026, İsmail, `claude/bike-route-distance-mismatch-333012`):
  Ankamall'a Google 3,5 km derken bizde 5,5 km. Sebep: BRouter'ın `fastbike` profili Avrupa'ya göre ayarlı, `trunk`
  yolları (Ankara'da İstanbul Yolu, Konya Yolu, FSM Bulvarı gibi bulvarlar; şehirler arası bölünmüş devlet yolları)
  bisiklete kapalı sayıp 10 kat cezalandırıyor. İsteğe profilin kendi ayarı eklendi: `&profile:allow_motorways=1`
  (`lib/yonlendirme.ts`; `trunk` ana yoldan biraz pahalı, otoyol yasak kalıyor). Ölçüm (Ankamall'a 2,6 km kuş uçuşu
  sekiz yönden, brouter.de ve kendi sunucumuz aynı): 5418 → 3744 m, 6209 → 4436 m, 5182 → 4197 m, 5070 → 4307 m.
  İki yönde yol uzadı (3682 → 4406 m, 3574 → 3814 m): ilkinde eski yol tek yönlü bağlantı yolunda ters yönde
  gidiyordu, ikincisi incelenmedi.
  Rota çizme ekranındaki "yola yapış" + bisiklet de aynı isteği kullanır. Sunucuda değişiklik yok (BRouter 1.7.10
  parametreyi tanıyor). Yalnızca JS; telefonlara **bir sonraki derlemeyle** gider (OTA yok).
- [~] "Yol öncelikli" yürüyüş / koşu da dolanıyordu (15 Kas 2026, İsmail, `claude/yaya-yol-oncelikli`): hazır `trekking`
  bisiklet profili kullanılıyordu (tek yönlere uyar, `trunk`'ı 10 kat cezalandırır, `allow_motorways` ayarı yok).
  Kendi sunucumuza yaya profili eklendi: `altyapi/brouter/profiller/lykiva-yaya-yol.brf` (Dockerfile `profiles2`'ye
  kopyalar). En kısa yola yakın gider, tek yön saymaz, toprak yol / patika 1,5 kat, zor dağ patikası 5 kat, otoyol yasak.
  Uygulama yol öncelikli yaya etkinliklerinde (yürüyüş, koşu, doğa yürüyüşü, patika koşusu) bunu ister; sunucu profili
  tanımıyorsa (boş gövdeli 500) ya da kendi sunucumuz tanımlı değilse (brouter.de) eskisi gibi `trekking`.
  Ölçüm (profil brouter.de'ye özel profil olarak yüklenerek; Ankamall'a 2,6 km kuş uçuşu sekiz yön, trekking → yeni,
  parantezde en kısa yol): 3657 → 3555 (3555), 3574 → 3526 (3526), 4452 → 3973 (3714), 3867 → 3233 (3193),
  4106 → 3391 (3262), 6110 → 3709 (3627), 5204 → 3644 (3615), 4189 → 3558 (3491) m. Kaş → Çukurbağ: en kısa yol
  4 km patikadan giderken (7671 m) profil asfaltta kalıyor (9415 m). Ankara çevre yolunda otoyola girmiyor.
  **Kalan:** sunucu yeniden kurulmadan profil yok (Bekleyen elle yapılacaklar 15); kendi sunucumuzda henüz denenmedi.
  Yalnızca JS + sunucu imajı; telefonlara bir sonraki derlemeyle gider.
- [x] Harita > yol tarifinde "Araba" (15 Kas 2026, İsmail, `claude/yol-tarifi-araba`): etkinlik çiplerinin sonunda
  "Araba" çipi. Yol BRouter'ın hazır `car-fast` profiliyle (kendi sunucumuzda ve brouter.de'de var; tek yönlere ve araç
  yasaklarına uyar), süre BRouter'ın hesabından (`total-time`; trafik verisi yok). Ankamall örneğinde 3574 m, 7 dk.
  **Araba etkinlik türü değil:** `ActivityType`'a, veritabanına ve Egzersiz'e eklenmedi (İsmail'in kararı). Rota çizme
  ekranına eklenmedi. Yalnızca JS, dört dilde.
  - **"Yola çık" arabada da var, kaydetmez** (15 Kas 2026, `claude/araba-yola-cik`, İsmail'in kararı): aynı rota takibi
    ekranı açılır. "Egzersiz olarak da kaydet" anahtarının `kaydetme` mekanizmasını kullanır (yukarıda, Harita ve
    Egzersiz): `baslat('car', …)` `kaydetme`'yi hep açar ve `Kayit.araba`'yı işaretler. Farkı: arabada "Aktivite olarak
    kaydet" seçeneği hiç sunulmaz (canlı ekrandaki bitirme uyarısında ve duraklatıldı ekranında) ve `bitir()` arabada
    `iptalEt()`'e düşer, yani hiçbir ekrandan kaydedilemez; anahtar arabada gizlidir. Rozet "Yol tarifi · Araba", kilit
    ekranı başlığı "Araba · Yol tarifi". Bilinen eksik: kilit ekranı simgesi iOS'ta bisiklet kalıyor
    (`index.ios.tsx`'teki `SIMGELER` derlemeyle gider).
  - **Yol / patika tercihi arabada da görünür:** araba patikaya giremez; "patika öncelikli" `car-fast`'e
    `profile:use_offroad=1` ekler, araca kapalı sayılan toprak yollar (`track`) açılır. Kendi sunucumuzda denendi (Kaş,
    toprak yol üstündeki hedef): yol öncelikli en yakın asfaltta bitiyor (11642 m), patika öncelikli 842 m toprak
    yoldan hedefe varıyor (12433 m). Hedef asfalttaysa iki tercih aynı yolu verir. Panelde kısa not çıkar.
  - **"Haritalar'da aç"** arabada ayrıntı bölümünde ikinci düğme: hedefi telefonun harita uygulamasında araba yol
    tarifiyle açar (iOS Apple Haritalar, Android Google Haritalar bağlantısı), çünkü bizde adım adım yönlendirme yok.
  - Telefonda denenecek: arabada "Yola çık" → canlı ekran → Bitir (aktivite oluşmamalı, akışta görünmemeli),
    duraklat → Bitir, uygulama kapanıp açılınca yolculuk sürüyor mu; "Haritalar'da aç" iki platformda.
- [ ] "Yol öncelikli" dağ bisikleti ve "patika öncelikli" bisiklet hâlâ `trekking` kullanıyor (`trunk` 10 kat).
  Patikada isteneni bu olabilir; dağ bisikletinde şikâyet gelirse `lykiva-yaya-yol` gibi kendi profilimiz yazılır.
- Serbest çizilen rotada yükseklik yok (BRouter'a sorulmuyor); ayrı bir yükseklik servisi gerekir.
- Karanlık mod (12 Kas 2026, `gorunum-ayari`): örnek veri ekranları (`Ornek*`) ve paylaşım kartı temaları sabit renkli
  bırakıldı. Harita artık karanlıkta ve gece koyu (13 Kas 2026, `harita-renkleri`); uydu, hibrit ve kış hep aynı.
- Gizlilik kontrolleri (12 Kas 2026, `gizlilik-kontrolleri`): `profiles` ve `follows` tablolarını doğrudan okuyan biri
  (uygulama değil, API'yi elle kullanan) gizlenmiş profilin hakkında / şehir bilgisini ve takipçi sayısını görebilir;
  uygulama ve web fonksiyonlardan okuduğu için ekranda görünmez. Kalıcı çözüm: bu sütunları istemciye kapatıp kendi
  profilini `profilim()` gibi bir fonksiyondan okumak. Profili gizli kişinin aktiviteleri akışta kendi görünürlükleriyle
  çıkmaya devam eder (yalnızca profil sayfasında listelenmez).
- Ek gizlilik kontrolleri (12 Kas 2026, `ek-gizlilik-kontrolleri`): gizli hız `activities` tablosunu API'den doğrudan
  okuyanlara açık (uygulama `aktivite_ozetleri` / fonksiyonlardan okur); paylaşım bağlantısı açılmış aktivitede web sayfası
  hızı ve mola sayısını göstermeye devam eder (bilerek: bağlantıyı sahibi açıyor). Başlangıç saatini gizleme yapılmadı
  (akışın sayfalaması başlangıç saatine göre). Engel ortak grup sohbetini, üye listesini ve meydan okuma sıralamasını
  etkilemez. Gizleme mesafesi sabit 200 m (seçilebilir değil).
- [ ] Birebir mesajlaşma + Gizlilik kontrolleri > Ek kontroller > Mesajlaşma ("kim mesaj atabilir"); engellenen mesaj atamaz.
  Ek kontrollerin ardından ayrı PR (Gökhan).

### [ ] Rakiplere göre eksikler (Kasım 2026 karşılaştırması)
Strava, Komoot, AllTrails, Wikiloc ve Garmin Connect ile karşılaştırıldı. Sıra öneri sırasıdır; (D) = yeni yerel modül, telefona yeni derleme gerekir.

**Önce — doğada güvenle kullanılabilmek için**
- [x] Çevrimdışı harita: rotanın çevresini telefona indir (30. aşama, `lib/cevrimdisi.ts`). Kalan: telefonda deneme;
  OpenFreeMap'in "en fazla 4 paralel istek" kuralını MapLibre'den ayarlayamıyoruz (bkz. Kararlar).
  Sonra: haritada serbest alan seçip indirme (rotasız), kayıt başlatırken "bu rota indirilmemiş" uyarısı.
- [x] Rotadan çıkınca titreşim + bildirim (15 Kas 2026; telefon cepteyken, ekran kapalıyken de). Karar `@lykiva/shared` >
  `rotaUyarisi` (testli): rotaya bir kez girmeden uyarmaz, 60 m'yi (GPS kötüyse doğrulukla büyür) 10 sn aşınca uyarır,
  40 m'ye dönünce kaldırır, dışarıda kalınırsa 2 dakikada bir en fazla 3 hatırlatma, son 50 m'de uyarmaz. Uyarı yerel
  bildirim (`kayit/rotaUyarisi.ts`): Android'de titreşimli yüksek öncelikli kanal (titreşimi sistem yapar; uygulamada
  `VIBRATE` izni yok, eklemek yeni derleme isterdi), iOS'ta sesli bildirim. Ayarlar > Bildirimler'den kapatılır.
  Yalnızca JS, yeni derleme gerekmez. **Telefonda denenmedi** (cepteyken / kilitliyken titriyor mu, iOS'ta arka planda
  bildirim geliyor mu). Sonra: sesli yönlendirme (dönüş dönüş).
- [x] Aileyle canlı konum (15 Kas 2026): Egzersiz yap > Canlı konum > "Bağlantıyla paylaş" (grupla birlikte de seçilebilir).
  Başlatınca paylaşım penceresi açılır, canlı kayıt ekranından yeniden paylaşılır. Adres `https://lykiva.app/c/<anahtar>`:
  uygulaması olmayan biri haritada canlı konumu ve izi (son ~2 saat), mesafe, geçen süre, hızı görür; 15 sn'de bir
  yenilenir; "Google Haritalar'da aç". Molada değilken 10 dk hareket yoksa ve 5 dk konum gelmezse sayfada uyarı.
  Bağlantı kayıt bitince ya da en geç 24 saatte kapanır. Sunucu `20261119000000_canli_baglanti.sql` (testli), web
  `apps/web/src/app/c/[anahtar]` (MapLibre GL, OpenFreeMap; `maplibre-gl` web'e eklendi), uygulama
  `kayit/canliPaylasim.ts`. Yalnızca JS + migration, yeni derleme gerekmez. Migration sunucuya uygulandı (15 Kas 2026,
  `uygula.sh`, SSH; anon yalnızca `canli_baglanti`'yı çağırabiliyor). **Telefondan uçtan uca denenmedi.** Sonra: hareketsizlikte kaydı yapanın telefonunda "İyi misin?" sorusu, cevap yoksa izleyene haber
  (izleyen uygulama kullanmıyor; e-posta / SMS gerekir).

**Sonra — veri alışverişi**
- [x] GPX içe aktarma (15 Kas 2026): Profil > Rotalar > "GPX içe aktar" (`app/rota/ice-aktar.tsx`). Dosya seçici
  expo-file-system'in `File.pickFileAsync`'i (derlemelerde var, yeni derleme gerekmez; eski derlemede açılmazsa ekran
  söyler). Okuyucu `@lykiva/shared` > `gpxOku` (testli): iz (trkseg parçaları) ya da rota (rte), ad, tür, rakım, zaman;
  ara noktalar (wpt) okunmaz. Rota olarak: `rotaSadelestir` (Douglas–Peucker, en fazla 5000 nokta) + `rotaKaydet`.
  Zaman bilgisi varsa aktivite olarak da: kayıt paketi + kuyruk (süre, hız, molalar kayıttaki gibi). **Telefonda
  denenmedi** (dosya seçici iOS / Android, Komoot / Strava / Garmin dosyaları). Sonra: paylaş menüsünden "Lykiva ile aç"
  (iOS belge türü / Android intent; `app.json` + yeni derleme).
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
- [~] Kayıtta kilit ekranında süre / mesafe / anlık ve ortalama hız (35. aşama). Kod iki platformda hazır
  (`modules/kilit-ekrani`): Android'de kayıt bildirimi canlı pencereye dönüşüyor (sürüm 4 / 5'te yok, Kotlin kodu
  repoya girmemişti), iOS'ta Live Activity (`expo-widgets`). Kalan: yeni derleme ve telefonda deneme (Bekleyen elle yapılacaklar 12).
- [~] Çok dilli arayüz: İngilizce, Almanca ve Rusça yapıldı (31. aşama); Arapça + sağdan sola düzen sıradaki PR.
- [ ] Saat uygulaması (Apple Watch / Wear OS) — büyük iş, sonraya.
- [ ] Karar: ücretli üyelik olacak mı, hangi özellikler (rakiplerde çevrimdışı harita ve yönlendirme ücretli katmanda).

### [~] Paylaşım kartları — tasarım aktarımı (`tasarim/AKTARIM.md`)
- [x] Paylaş ekranında tema seçimi (15 Kas 2026): Klasik (eski 4 renkli kart) + 8 tasarım teması, gerçek aktivite
  verisiyle durağan PNG: 01 Gece haritası, 02 Zirve profili, 03 Kartpostal, 04 Biniş kartı, 05 Minimal, 06 Fotoğrafın
  üstünde, 09 Hız haritası, 10 Günün akışı. Kod: `components/paylasim/` (`ortak.tsx`, `temalar.tsx`). Her tema kendi
  biçiminde (hikâye 9:16 / gönderi 4:5 / kare); gönderi ve kare kartlar "Hikâye" ile 9:16 zemine oturur. Fotoğraf yalnızca
  telefonda kalır, sunucuya yüklenmez (yakalanan görselde EXIF yok).
- [x] 01 Gece haritası ve 09 Hız haritasında harita zemini (15 Kas 2026): OpenFreeMap vektör karoları indirilip su, yeşil
  alan, akarsu ve yollar kartın içinde SVG olarak koyu renkte çiziliyor (`components/paylasim/haritaZemini.tsx`).
  Yalnızca JS paketleri eklendi (`@mapbox/vector-tile`, `pbf`), yeni derleme gerekmez. İnternet yoksa kart zeminsiz çıkar.
  Rotanın izdüşümü Web Mercator'a geçti (harita ile aynı). Eş yükselti / tepe gölgesi yok (OpenFreeMap'te yükseklik katmanı yok).
- [x] 07 Birlikte ve 08 Harita posteri (15 Kas 2026). Birlikte yalnızca birlikte yapılan aktivitede şeritte çıkar
  (sahip + katılanlar, baş harfli avatarlar, 5'ten fazlası "+N"). Harita posteri açık renkli vektör zemin; başlangıç → bitiş
  koordinatı 2 ondalıkla (~1 km), "Başlangıç ve bitişi gizle" açıksa kırpılmış izin uçlarından.
- [ ] Biniş kartında yer kodları: aktivite adı "A – B" biçimindeyse ilk üç harf, değilse saatler. Başlangıç / bitiş yerinin
  adı (Photon ile ters arama) eklenirse kodlar ve Kartpostal başlığı ("Kaş'tan selamlar") gerçek yer adını kullanabilir.
- [~] 3B kartlar (11–17) sunucuda video (MP4) olarak — `altyapi/kart-video/` (15 Kas 2026, karar İsmail'in: sunucuda video).
  Sahne MapLibre GL JS (OpenFreeMap harita + binalar, Terrarium arazi) başsız Chromium'da kare kare çizilir, ffmpeg MP4 yapar.
  Telefon izi (uçları kırpılmış) ve kendi dilindeki metinleri gönderir; servis veritabanına bağlanmaz.
  4 şablon: yörünge (11, 12, 16), şehir gecesi (13), şehir maketi (14; 15'in uydusu lisanslı olduğu için açık harita), takip (17).
  - [x] 1. aşama: servis, sahne, 4 şablon, yerelde deneme.
  - [x] 2. aşama: kurulum (15 Kas 2026). `kart-video` lykiva-altyapi'de, 17 Kas'tan beri Coolify'da ayrı `video` uygulaması (3 çekirdek, 3 GB), kapı `video.ismailtopcam.dev`
    (uygulama anahtarı; yeni iş IP başına dakikada 1 + 4 anlık, durum/indirme dakikada 60). DNS A kaydı eklendi.
    Hız (sunucuda, uçtan uca): ilk sürüm 12 sn'lik yörünge videosu 18 dk → hızlandırmadan sonra **2 dk 51 sn** (3B arazili).
    Ölçümler ve denenenler: `altyapi/kart-video/README.md` > Hız.
  - [~] Şehir şablonları yavaş: şehir maketi (İstanbul, 3,1 km) önce çöküyordu (kare 30 sn'yi aşınca servis düşüyordu,
    düzeltildi), şimdi **7,5 dk**. Binalar saydamlıkla beliriyor, 3B yalnız rota çevresinde (`distance` süzgeci). Kalan
    seçenekler: koridoru daraltmak, şehir videosunu 10 sn'ye indirmek, uzak binaların düz tabanını kaldırmak.
  - [x] 3. aşama: telefonda 3B video temaları (15 Kas 2026; yalnızca JS, yeni derleme gerekmez). Paylaş > tema şeridinin
    sonunda 4 video teması (şehir şablonları yalnız 20 km altı rotalarda). Seçince örnek kare, biçim (hikâye / gönderi),
    "3B videoyu hazırla" → ilerleme / sıradaki yer → hazır olunca "Videoyu paylaş". Ekrandan çıkılırsa yerel bildirim,
    dokununca paylaşım ekranı. Kod: `lib/kartVideo.ts`, `components/paylasim/videoTemalari.ts`. Uygulama anahtarı
    (`EXPO_PUBLIC_ALTYAPI_ANAHTARI`) yoksa video temaları görünmez; adres `EXPO_PUBLIC_VIDEO_URL` (varsayılan
    `https://video.ismailtopcam.dev`). Takip uygulama açıkken sürer (iOS arka planda durdurur, öne gelince devam eder).
  - Bilinen: haritada yer adları kapalı; şehir şablonları kısa rotalar için (uzun rotada uzaklaşınca binalar z14 altında kalır).
- Hız haritasında kademeler sabit 13 / 25 km/sa değil, aktivitenin ortalamasına göre (×0,85 ve ×1,2): koşu ve yürüyüşte de anlamlı.

### [~] Kulüpler (13 Kas 2026, `20261117000000_kulupler.sql`)
- [x] Gruplar sekmesi üç bölüm: Meydan okumalar (eski /meydan-okuma listesi, `MeydanOkumaListesi`), Kulüpler (gruplar,
  davet kodu, keşfet), Etkinlikler (yaklaşan etkinliklerin hepsi + oluştur).
- [x] Kulüp fotoğrafı: yönetici kulüp sayfasındaki fotoğrafa (ya da ⋯ > Grup fotoğrafı) dokunarak ekler / değiştirir / kaldırır.
- [x] Kulüp sayfasında Gönderiler, Paylaş (metin + en fazla 4 fotoğraf) ve Haftalık (toplam, gün gün, geçen hafta, sıralama) sekmeleri.
- [ ] Gönderiye beğeni / yorum; gönderiye aktivite ya da rota ekleme.
- [ ] Gönderi şikayeti: `reports.target_type`'a gönderi eklenmeli, yönetim paneline gönderi silme. Şimdilik grup yöneticisi siler.
- [ ] Yeni gönderi bildirimi (uygulama içi + push).
- [ ] Hesap ya da grup silinince gönderi fotoğrafları depoda kalıyor (satırlar siliniyor); `hesap.ts` > `fotograflariSil`'e
  ve grup silmeye `grup_gonderi` kovası eklenmeli.
- [ ] Grup kurarken fotoğraf seçme (şimdi kurduktan sonra kulüp sayfasından).

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
- [x] Profil sayaçlarında "aktivite" / "takip" sabit Türkçeydi (İngilizce arayüzde "0 aktivite · 0 followers · 0 takip");
  `profil.aktivite` / `profil.takip` anahtarlarına çevrildi (13 Kas 2026, Android emülatör denemesinde görüldü).
- [x] Sayaçlarda tekil / çoğul: uygulamada profil ve kişi sayfası, web'de `/u/<kullanıcı>` ("1 activity · 2 followers",
  Rusçada üç biçim). Kişi sayfasındaki sabit "aktivite" / "takip" de çeviriye bağlandı.

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

- **Paylaşım kartında harita zemini vektör karodan çiziliyor** (15 Kas 2026): uygulamanın haritasıyla aynı kaynak
  (OpenFreeMap, OpenMapTiles şeması), kartın içinde SVG. Raster karo (OpenTopoMap, Esri) lisans / kullanım sınırı yüzünden,
  MapLibre anlık görüntüsü görsel yakalamada güvenilmez olduğu için seçilmedi. Kart altında "© OpenStreetMap katkıcıları ·
  OpenMapTiles" satırı zorunlu (ODbL).
- **Egzersiz sekmesi yalnızca kayıt sürerken** (15 Kas 2026): egzersiz başlatma Harita sekmesine taşındı, alt menü dört
  sekmeye indi. Kayıt sürerken (ya da duraklatılmışken) Egzersiz sekmesi araya girer ve süren kaydı açar; yoksa başka
  sekmedeyken kayda dönmenin tek yolu Harita > "Süren kayda dön" olurdu. `useKayitDurumu` yalnızca durum değişince
  yeniden çizer (alt menü her GPS güncellemesinde çizilmesin). Yol tarifinde "Yola çık" panelin en üst bölümünde:
  panel tek sayfa olduğu ve kademeler aynı sayfanın bölümleri olduğu için, küçük kademede görünmesi gereken düğme
  sayfanın başında durmak zorunda.

- **Açılışta sekmeler giriş durumunu bekler** (13 Kas 2026): giriş durumu (oturum + "Şimdilik geç") 800 ms içinde belli olursa sekmeler hiç kurulmaz; doğrudan giriş
  ekranına ya da sekmelere gidilir. Önceden sekmeler kurulup hemen giriş ekranına geçiliyordu; expo-router 58'de sekme
  gezgininin açılışta kuyruğa koyduğu `ROUTE_NAMES_CHANGED` sekmeler kalkınca işlenemiyor, geliştirme derlemesinde
  "was not handled by any navigator" uyarısı çıkıyordu. 800 ms dolarsa (internetsiz açılışta oturum yenilemesi) sekmeler
  eskisi gibi açılır (`app/(tabs)/_layout.tsx`).

- **Kulüp haftalık istatistiği bakana göre** (`grup_haftalik_istatistik`, 13 Kas 2026): yalnızca bakan kişinin görebildiği
  (`aktivite_gorunur_mu`) ve "yalnızca ben" olmayan aktiviteler sayılır; bu yüzden iki üye farklı toplam görebilir
  ("takipçilere" kaydı yalnızca takip edenlerde sayılır). Meydan okumadaki gibi bütün aktiviteleri saymak için üyenin açık
  onayı gerekirdi; kulübe katılmak bunu vermiyor. Yalnızca toplamlar döner, aktivitenin kendisi / haritası dönmez.
  Hafta Pazartesi 00:00 Türkiye saatiyle başlar. Gönderi fotoğrafları gizli kovada (yalnızca üyeler), grup fotoğrafı
  herkese açık kovada (keşfette üye olmayan da görsün diye; profil fotoğrafı gibi).

- **Kullanıcı engelleme iki yönlü** (`20261116000000_ek_gizlilik.sql`): `engel_var_mi` `aktivite_gorunur_mu`'ya eklendi, böylece
  akış, aktivite, yorum, beğeni, mola ve fotoğraf kuralları kendiliğinden uyar; arama, kişi sayfası, takip, etiket ayrıca.
  Engellenen kişi engellendiğini doğrudan görmez (profil "bulunamadı"). Ek kontrollerdeki açık / kapalı ayarlar
  `gizlilik_bayragi_ayarla`, geçmişe toplu uygulama `gecmis_aktiviteleri_duzenle` ile; "Kişisel bilgilerimi paylaşmayın"
  bugün yalnızca tercih kaydı (Lykiva satış / reklam paylaşımı yapmıyor) — böyle bir paylaşım eklenirse bu sütuna uyulmalı.
- **Gizlilik kontrolleri** (Ayarlar > Gizlilik > Gizlilik kontrolleri, `20261115000000_gizlilik.sql`): dört ayar, her biri
  herkes / takipçiler / hiç kimse; "takipçiler" = seni takip edenler. Profil sayfası: ayrıntılar ve sayılar
  (`kisi_profili` `kisitli` döner); aktiviteler: yeni kayıtların varsayılan görünürlüğü (mobil artık `visibility`
  göndermiyor, sunucu kişinin ayarını kullanır; istenirse geçmişe uygulanır); grup aktiviteleri: başkasının aktivitesinde
  etiketli olduğunu kim görür (sahibi her zaman); bahsetmeler: seni kim etiketleyebilir ("herkes" = önceki kural, tanıdıklar).
  Web profili oturumsuz olduğu için yalnızca "herkes" iken açılır.
- **Karanlık mod: renkler okunduğu anda temadan gelir** (`apps/mobile/src/theme/renkler.ts`). `colors.ink` gibi her okuma
  o anki temanın değerini verir; dosya düzeyindeki stiller `temaliStil(() => StyleSheet.create({...}))` ile yazılır (her
  tema için bir kez kurulur). Tema değişince kök düzen dil değişimindeki gibi yeniden kurulur. Karanlık palet
  `packages/shared/src/tokens.ts` > `colorsDark` (adlar `colors` ile aynı). **Yeni ekran yazarken:** renkleri dosya
  düzeyinde bir değişkene kopyalama; dosya düzeyinde `colors.` içeren stil ya da nesne `temaliStil` içinde olmalı.
  Telefonun teması kayıt sürerken değişirse uygulanmaz (ekranlar baştan kurulmasın), uygulama sonraki öne gelişte uygular.
- **Kilit ekranı penceresi Android'de konum servisinin bildirimi** (`modules/kilit-ekrani`): expo-location'ın ön plan
  servisi bildirimini sonradan değiştirmenin yolu yok (seçenekleri değiştirmek konum güncellemelerini yeniden başlatıyor),
  bu yüzden yerel modül aynı kimlikle yeni bildirim göndererek onu güncelliyor (servis bağı korunur, tek bildirim kalır).
  Süre `Chronometer` ile telefonda sayar (ekran kapalıyken JS her saniye çalışmayabilir); mesafe / hız JS'ten, en sık
  saniyede bir; kayıt sürerken 2 sn'de bir de bakılır (durunca konum gelmez, anlık hız 0'a düşsün). Görünüm `RemoteViews`
  (kapalı: süre, mesafe, anlık hız; açık: 2×2, ortalama hız da), sistemin bildirim yazı stilleriyle (karanlık tema). Kanal varsayılan
  önemde ama sessiz: düşük önemli ("sessiz") bildirimler Android 10+ kilit ekranında görünmüyor. expo-notifications
  sayaç ve özel görünüm vermediği, üstelik ikinci bir bildirim açacağı için kullanılmadı. `expo-widgets`'ın Android
  özel bildirimi de servisin bildirimini devralamadığı ve sayaç vermediği için kullanılmadı.
- **Kilit ekranı iOS'ta `expo-widgets` Live Activity** (`modules/kilit-ekrani/index.ios.tsx`): Expo'nun resmi paketi
  (SDK 58); widget eklentisini (ExpoWidgetsTarget) config eklentisi üretir, `ios/`'a elle dokunmak ya da Swift yazmak
  gerekmez. Pencere `@expo/ui/swift-ui` ile JS'te yazılır, 'widget' yönergesiyle eklentinin içinde ayrı bir JS ortamında
  çalışır (dışarıdaki sabitlere erişemez, her şey props'tan). Süre SwiftUI timer'ıyla telefonda sayar. Paket Android'e
  bağlanmaz (`expo.autolinking.android.exclude`): Android'de kendi Kotlin modülümüz var, Glance / Compose yükü gereksiz.
  expo-widgets yerel modülü yoksa (Expo Go, eski derleme) paket hiç yüklenmez; yoksa içe aktarma uygulamayı düşürür.
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
- **Alan adları:** `lykiva.app` asıl adres (web), `api.lykiva.app` Supabase, `brouter.` / `photon.ismailtopcam.dev` kendi
  rota / yer arama sunucularımız (eski `*.lykiva.app` adları kaldırıldı). DNS Cloudflare'de, proxy kapalı (Coolify kendi sertifikasını alır; gosterge.app ile aynı düzen).
  `lykiva.com` ve `www.lykiva.com` Cloudflare yönlendirme kuralıyla `https://lykiva.app`'e 301 (yol ve sorgu korunur).
  E-posta Zoho Mail (AB sunucuları). ismailtopcam.dev artık Lykiva web'ini göstermiyor (yalnızca `brouter.` / `photon.` alt adları).
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
