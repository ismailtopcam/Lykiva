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

GPS kaydı, harita, fotoğraf ve bildirim yerel modül kullandığı için **Expo Go yetmez**; telefona Lykiva'nın
geliştirme derlemesi kurulur. Derleme Expo'nun bulut sunucularında yapılır (EAS Build; Windows'tan da olur,
Mac gerekmez). Proje: `@ismailtopcam/lykiva` (`apps/mobile/eas.json`, proje kimliği `app.json`'da).

Bir kerelik (`apps/mobile` klasöründe):

```bash
npx eas-cli@latest device:create
```

iPhone'u kaydeder: çıkan bağlantıyı / QR'ı iPhone'da Safari ile aç, profili yükle (Ayarlar > Profil İndirildi).
Android için gerekmez.

```bash
npx eas-cli@latest build --profile development --platform all
```

İlk iOS derlemesinde Apple hesabıyla giriş ister (ücretli Apple Developer hesabı); sertifikayı ve kayıtlı
iPhone'ları içeren profili kendisi oluşturur. "Push Notifications" anahtarı sorulursa evet de (telefon
bildirimleri için). Android imza anahtarını da kendisi üretir. Derleme bitince çıkan bağlantıyı / QR'ı
telefonda açıp uygulamayı kur. iPhone'da ilk açılışta: Ayarlar > Gizlilik ve Güvenlik > **Geliştirici Modu**'nu aç.

Yerel modül eklenmedikçe yeniden derlemek gerekmez; kod değişiklikleri aşağıdaki günlük komutla telefona gelir.
Mac'te kabloyla yerel derleme de mümkün: `npx expo run:ios --device` (Xcode gerekir).

iOS Simülatöründe konum: Features > Location > City Bicycle Ride / Freeway Drive.

**Mobil uygulama — günlük**

```bash
npm run mobile
```

Telefonda Lykiva geliştirme derlemesini aç; bilgisayardaki sunucuyu kendisi bulur. Bulamazsa terminaldeki
QR kodu telefonun kamerasıyla okut. Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.

> **Harita:** Gerçek harita MapLibre ile çizilir ve Expo Go'da çalışmaz. Expo Go'da haritanın yerinde
> tasarımdaki stilize çizim görünür. Gerçek haritayı görmek için uygulamanın geliştirme derlemesi
> (development build) gerekir: `npx eas-cli build --profile development`. Harita stili
> `apps/mobile/.env` içindeki `EXPO_PUBLIC_MAP_STYLE_URL` ile değişir (örnek: `.env.example`).
> Kullanıcı haritadaki katman düğmesinden standart, uydu, hibrit ya da kış türünü seçer
> (`apps/mobile/src/components/map/haritaTurleri.ts`); bu adres standart türün stilidir.

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
npm run test:sql             # migration'ları bellekteki veritabanında dener (sunucuya dokunmaz)
```

## Aşamalar

1. **İskelet + tasarım + gezinme** — proje yapısı, ortak tasarım dili, mobil alt menü ve tüm ekranların kabukları, web karşılama sayfası ve yönetim paneli kabuğu, veritabanı şeması.
2. **Tasarımın koda dökülmesi** — 18 ekran örnek verilerle, MapLibre haritası, web için Dockerfile.
3. **Gerçek GPS kaydı** — ekran kapalıyken de kayıt (arka plan konum), duraklat/devam, mesafe/hız/tırmanış/mola hesapları (birim testli), çevrimdışı kuyruk, Supabase'e kaydetme, güvenlik kuralları (RLS), geçici (anonim) giriş, aktivite özeti ve hız/mola sayfası gerçek veriden.
4. **Google / Apple girişi** — iOS'ta yerel Apple girişi, Google için tarayıcı (PKCE). Geçici hesaba kimlik bağlanır, kayıtlar kaybolmaz; o kimlik başka hesaptaysa kayıtlar oraya taşınır. Açılışta giriş ekranı ("Şimdilik geç" ile atlanabilir), ayarlarda hesap ve çıkış. Kod hazır; sunucu ve Google/Apple konsol ayarları bekliyor (bkz. `supabase/README.md`).
5. **Rotalar** — haritaya dokunarak rota çizme (patikaya / yola yapışarak, BRouter), yer arama, mesafe/tırmanış/tahmini süre/zemin/zorluk, aktiviteyi rota olarak kaydetme, Rotalarım, rota detayı; rotayla kayıtta ilerleme çubuğu, kalan km, ortalama hıza göre varış süresi ve "rotadan çıktın" uyarısı.
6. **Paylaşım** — gerçek izle paylaşım kartı (4 şablon, gösterilecek istatistikler), Instagram hikâyesi için 9:16 görsel ve kart görseli (telefonun paylaşım menüsü), başlangıç/bitişi gizleme, Lykiva akışında görünürlük, GPX dışa aktarımı.
7. **3B görünüm** — aktivitenin gerçek izi gerçek yüksekliklerle: sürükleyerek döndür/eğ, yükseklik abartısı (1x gerçek, 3x, 10x), eğime göre renk, yükseklik profilinde imleçle konum/yükseklik/eğim/hız. İnternetsiz çalışır.
8. **Gruplar** — özel grup (davet kodu / bağlantısı) ve açık topluluk (keşfet, doğrudan ya da onaylı katılım), üyeler ve yönetici işlemleri, gruba rota paylaşma, canlı grup sohbeti (Supabase Realtime) ve okunmamış sayısı; "Gruplarım" görünürlüğü.
9. **Etkinlikler** — gruba bağlı ya da herkese açık etkinlik: tarih/saat, buluşma noktası, rota, seviye, kontenjan; Katılıyorum / Belki / Gelemem, dolunca bekleme listesi (yer açılınca otomatik), grup sohbetinde etkinlik kartı, grup sayfasında Etkinlikler, Gruplar sekmesinde yaklaşanlar.
10. **Canlı konum** — kayıt başlatırken isteğe bağlı olarak bir grupla son konumu paylaşma (≈15 sn’de bir, arka planda da), duraklatınca "molada", kayıt bitince silinir; grubun canlı haritası (10 sn’de bir yenilenir), grup sayfası ve sohbetten erişim.
11. **Akış ve takip** — ana sayfa akışı gerçek veriden: Takip ettiklerim / Gruplarım / Yakınımda (25 km), aşağı çekerek yenileme, kaydırdıkça devamı; beğeni; kişi arama ve öneriler (seni takip edenler, grup arkadaşların); kişi sayfası, Takip et, takipçi / takip listeleri; aktivitede sahibinin adı kişi sayfasına gider. Hesap devrinde takipler ve grup üyelikleri de taşınır. Migration'lar `npm run test:sql` ile sunucusuz denenir.
12. **Yorumlar** — aktiviteye yorum yazma (akış kartından ya da aktivite detayından), yazan ya da aktivitenin sahibi basılı tutarak siler; aktivite detayında beğeni ve yorum satırı; yorum / beğeni başka ekranda değişince akış kartı da güncellenir. Yorum 1–1000 karakter, dakikada en fazla 10.
13. **Web paylaşım sayfası** — paylaşım stüdyosundaki "Bağlantı" ile aktivite için `lykiva.app/a/<anahtar>` bağlantısı açılır ve telefonun paylaşım menüsüyle gönderilir; bağlantısı olan herkes giriş yapmadan web'de görür (rota, değerler, yükseklik profili). WhatsApp / Telegram / X önizlemesinde rota görseli çıkar. Sahibi bağlantıyı istediği an kapatır; başlangıç/bitiş gizliyse iz kırpılır, sayfa arama motorlarına kapalı.
14. **Bildirimler (uygulama içi)** — yeni takipçi, beğeni, yorum, gruba katılma isteği ve kabulü, grupta yeni etkinlik; akışın üstündeki zilde okunmamış sayısı (yeni bildirim gelince canlı güncellenir), bildirimler ekranında dokununca ilgili sayfaya gider, takipçiye oradan geri takip. Telefona anlık bildirim (push) ayrı aşama.
15. **Birlikte yapılan aktivite** — aktivitenin sahibi birlikte gittiği kişileri ekler (takipleştiği ya da ortak grubu olanlar); aynı saatlerde aynı yoldan geçen tanıdıklar öneri olarak çıkar. Eklenen kişi bildirim alır, aktiviteyi görür, akışında çıkar ve kendini kaldırabilir. Akış kartında "Mert ve 2 kişiyle", aktivite detayında "Ayşe ve Mert ile birlikte", paylaşım kartında @kullanıcı adları.
16. **Keşfet gerçek veriden** — yaklaşan etkinlikler (herkese açık + gruplarının, 30 gün), herkese açık rotalar, katılabileceğin topluluklar ve kişi arama; konum izni varsa yakından uzağa sıralı ("Yakınındakileri önce göster" izni ister), tek arama kutusu hepsinde arar, Tümü / Rotalar / Topluluklar / Etkinlikler / Kişiler sekmeleri, topluluğa katıl / istek gönder, "Topluluk kur" açık topluluk seçili açılır.
17. **Yönetim paneli** — `lykiva.app/admin`: e-posta + şifreyle giriş (yalnızca `is_admin` hesaplar; oturum HttpOnly çerezde, süresi dolarken yenilenir), genel bakış (sayılar, 14 günlük grafik), şikayetler (durum + not, içeriği kaldırma), kullanıcılar (e-posta ile arama, yönetici yap / yetkiyi al), aktiviteler (silme), rotalar (herkese kapatma), gruplar ve etkinlikler (silme). Yönetici hesabı `supabase/yonetici.sh` ile açılır.
18. **Şikayet et** — başkasının aktivitesi, kişi sayfası, rota ve etkinlik altında "… şikayet et" bağlantısı; yorum ve grup mesajında basılı tutunca "Şikayet et"; grup menüsünde "Şikayet et". Neden seçilir (+ isteğe bağlı açıklama), şikayet yönetim paneline düşer, şikayet edilen kişi görmez.
19. **Yedekleme betikleri** — `supabase/yedek/`: gecelik veritabanı + dosya deposu yedeği, S3 uyumlu depolamaya kopya, eski yedek temizliği, canlıya dokunmadan geri yükleme denemesi; tek komutla kurulum (`kur.sh`). Sunucuya kurulması ve S3 kovası bağlanması bekliyor.
20. **Hava durumu** — kayıt başlarken (ilk konumla) hava bir kez alınır ve aktiviteyle saklanır (MET Norway; anahtarsız, ticari kullanım ücretsiz): aktivite detayında Hava kartı (sıcaklık, hissedilen, rüzgâr yönü ve rotaya göre "çoğunlukla karşıdan / arkadan", nem, yağış, UV), akış kartında kısa özet, paylaşım kartında "Hava" seçeneği, etkinlik detayında buluşma noktası için tahmin (9 güne kadar). İnternet yoksa kayıt havasız kaydedilir.
21. **Telefona anlık bildirim (push)** — her uygulama içi bildirim, alıcının telefonlarına Expo Push Service ile de gider (sunucuda pg_net; yoksa ya da başarısız olursa uygulama içi bildirim yine yazılır). İzin, Bildirimler ekranındaki "Telefonuna da gelsin mi?" kartından ya da Ayarlar > Telefona bildirim'den istenir; bildirime dokununca ilgili sayfa açılır; çıkışta bu telefonun jetonu silinir. Çalışması için EAS proje kimliği, Apple push anahtarı ve yeni telefon derlemesi gerekir (aşağıda).
22. **Kendi rota ve yer arama sunucularımız (kurulum dosyaları)** — `altyapi/`: BRouter 1.7.10 ve Photon 1.3.0 için Dockerfile'lar ve Coolify Docker Compose; ilk açılışta Türkiye segmentlerini (~210 MB) ve Photon Türkiye verisini kendileri indirir, haftalık güncelleme betikleri. Komutlar yerelde gerçek veriyle denendi; Coolify'da kurulması bekliyor.
23. **Profil düzenleme ve web profili** — Profil > "Profili düzenle": ad, kullanıcı adı (yazarken boş mu diye bakılır; Türkçe harfler sadeleşir), şehir, hakkında. Profilde paylaş düğmesi web profilini (`lykiva.app/u/<kullanıcı adı>`) paylaşır: ad, sayılar ve yalnızca herkese açık aktivitelerin özeti (iz yok, arama motorlarına kapalı; geçici hesapların web profili yok). Profilin Gruplar sekmesi grupları listeler. Kendi aktiviteni ve rotanı sağ üstteki "…" ile yeniden adlandırıp silebilirsin; rotada not ve görünürlük de değişir. **Güvenlik düzeltmesi:** önceden bir kullanıcı kendi profil satırındaki `is_admin` alanını değiştirip kendini yönetici yapabiliyordu; artık istemci yalnızca ad ve fotoğraf adresini doğrudan yazabilir (`20261110090000_profil.sql` uygulanınca kapanır).
24. **Fotoğraflar** — Profili düzenle'de profil fotoğrafı (galeriden ya da kamerayla; kare kırpılır, 512 px'e küçültülür, konum bilgisi taşınmaz); fotoğraf akış kartında, kişi listelerinde, grup üyelerinde ve profillerde görünür. "Hız & molalar" ekranında her molaya en fazla 6 fotoğraf (1600 px); aktiviteyi görebilen herkes görür, yalnızca sahibi ekler / siler (basılı tut ya da büyütüp "Sil"). Fotoğraflar Supabase Storage'da: `profil` kovası herkese açık, `mola` kovası gizli (bir saatlik imzalı adres). Aktivite silinince mola fotoğrafları da silinir. Telefonda çalışması için yeni derleme gerekir (yeni yerel modül: expo-image-picker, expo-image-manipulator).
25. **Yönetimde yorum / mesaj kaldırma ve engelleme** — şikayet edilen yorum ve grup mesajı panelden kaldırılır; şikayet edilen kullanıcı ya da Kullanıcılar sayfasından herhangi biri engellenir (Supabase Auth girişi ve oturum yenilemeyi kapatır, açık oturum en geç 1 saatte kapanır; telefon bildirim jetonları silinir). Engel aynı sayfadan kaldırılır; yöneticiyi engellemeden önce yetkisi alınır.
26. **Paylaşım sayfasında hava, bildirim jetonu temizliği** — web paylaşım sayfası (`/a/<anahtar>`) kayıt başındaki havayı da gösterir (sıcaklık, hissedilen, rüzgâr ve yola göre etkisi, nem, UV). Telefon bildirimleri gönderilirken Expo'nun yanıtı saklanır; uygulaması silinmiş ya da bildirimi kapatılmış telefonun jetonu ("DeviceNotRegistered") bir sonraki bildirimde kendiliğinden silinir.
27. **Hesap silme ve yasal sayfalar** — Ayarlar > "Hesabımı sil" (App Store ve Google Play zorunluluğu): fotoğraflar depodan, hesap ve tüm verisi sunucudan silinir; kurduğu gruplar en kıdemli yöneticiye ya da üyeye devredilir. Web'de `/gizlilik`, `/kosullar`, `/hesap-silme` sayfaları (Ayarlar > Hakkında ve ana sayfanın altından bağlantılı). İletişim e-postası ve veri sorumlusu yönetim paneli > Site ayarları'ndan değişir. Metinler taslaktır; mağazaya göndermeden önce gözden geçirilmeli.
28. **Rota eğimi** — rota çizerken ve rota detayında tırmanış, iniş, en dik çıkış / iniş; eğime göre renklenen yükseklik profili (iniş, düz, %3–6, %6–10, %10+) ve haritada aynı renklerle rota çizgisi; profilde parmağını gezdirince haritada o nokta, yükseklik ve eğim görünür. Rota detayında tırmanış bölümleri (uzunluk, kazanç, ortalama ve en dik eğim; dokununca profilde gösterir). Eğim 100 m'lik pencereyle ölçülür. Serbest çizimde yükseklik yok.
29. **E-posta + şifreyle giriş** — giriş ekranında "E-postayla devam et": giriş yap, hesap aç (ad isteğe bağlı), şifremi unuttum. Doğrulama ve şifre sıfırlama e-postadaki 6 haneli kodla (bağlantı yok; posta bilgisayarda açılsa da olur), kod 60 sn sonra yeniden istenebilir. Geçici hesaptan kayıt olunursa e-posta o hesaba eklenir, kayıtlar aynı kalır; var olan hesaba girilirse kayıtlar oraya taşınır. Türkçe e-posta şablonları `apps/web/public/eposta/`; SMTP (Zoho, `noreply@lykiva.app`) ve şablon ayarı `supabase/README.md` > E-posta. Yeni yerel modül yok.
30. **Çevrimdışı harita** — rota sayfasında "Haritayı indir": rotanın iki yanındaki 1 km'lik harita (yakınlaştırma 10–14) ve rotanın kendisi telefona iner; çekmeyen yerde harita indirilenden çizilir, rota ve "Bu rotayı başlat" telefondaki kopyadan açılır. Rota kısa kutulara bölünür, kare sayısı indirmeden önce hesaplanır (OpenFreeMap kuralı: bir indirme en fazla 3.000 kare / 50 MB). İlerleme, vazgeç, güncelle, sil; Ayarlar > Çevrimdışı haritalar listesi. Rota silinince çevrimdışı kopyası da silinir. MapLibre'nin zaten kurulu modülüyle; yeni yerel modül yok.
31. **Dil desteği (Türkçe, İngilizce, Almanca, Rusça)** — uygulama telefonun diliyle açılır, Ayarlar > Dil'den değiştirilir; bütün ekranlar, tarih ve sayı biçimleri (27,4 / 27.4), aktivite türleri, hava metinleri ve otomatik aktivite başlığı dile göre. Telefon bildirimleri alıcının dilinde (`profiles.dil`, `20261112000000_dil.sql`). Web sayfaları (karşılama, paylaşım, web profili, önizleme görseli) tarayıcının dilinde, `?dil=en` ile değiştirilebilir; yasal sayfalar ve yönetim paneli Türkçe. Çeviriler `apps/mobile/src/i18n/` (yeni metin: `tr.ts` + `en.ts` + `de.ts` + `ru.ts`). Rusçada birimler Kiril (км, м, км/ч) ve üç biçimli çoğul. Yeni yerel modül yok. Arapça ve sağdan sola düzen sonraki aşama.
32. **Kişisel rekorlar** — Profil > Kişisel rekorlar: en uzun mesafe, en uzun süre, en yüksek hız, en çok tırmanış; aktivite türüne göre süzülür, dokununca o aktivite açılır. Üstte bu yılın ve tüm zamanların toplamları. Kendi aktivitende rekor kırdıysan aktivite sayfasında "Kişisel rekor" rozeti. Hesap `packages/shared/src/rekor.ts`; sunucuda değişiklik ve yeni yerel modül yok.
33. **Hedefler, meydan okumalar, rozetler** — Profil > Başarılar. **Hedefler:** haftalık / aylık / yıllık mesafe, süre, aktivite sayısı ya da tırmanış (istersen tek bir türe), ilerleme çubuğu ve "planda mısın" çizgisi; hedefler sunucuda, ilerleme telefonda (`packages/shared/src/hedef.ts`). **Meydan okumalar:** herkese açık olanları yönetim panelinden (`/admin/meydan-okumalar`), grup meydan okumasını grup sayfasındaki "Meydan" sekmesinden üyeler açar; katıl / ayrıl, sıralama (yalnızca toplam görünür). **Rozetler:** 28 rozet (toplam, tek seferde, seri, özel, meydan okuma), telefonda hesaplanır (`packages/shared/src/rozet.ts`); kazandıran aktivitenin sayfasında "Yeni rozet". Migration `20261113000000_hedefler_meydan_okumalar.sql`; yeni yerel modül yok.
34. **Harita türleri ve ısı haritaları** — haritadaki katman düğmesi: standart, uydu, hibrit, kış (OpenSnowMap pistleri); ısı haritası küresel, haftalık, gece (güneş battıktan sonra) ve kişisel. Isı haritası sunucuda görünen alan için hesaplanır (`isi_haritasi`), yalnızca herkese açık aktivitelerden; Ayarlar > Gizlilik'ten çıkılabilir. Migration `20261114000000_isi_haritalari.sql`; yeni yerel modül yok.
35. **Kilit ekranında kayıt (Android ve iOS)** — kayıt sürerken ekran kapatılınca kilit ekranında süre, mesafe (km) ve anlık hız (km/sa) görünür; bildirim açılınca ortalama hız da (2×2). Hızlar kayıt ekranındakiyle aynı hesap (ortalama yalnızca hareket hâlindeyken). Süre telefonda kendi kendine sayar, duraklatılınca durur; mesafe ve hız her yeni konumda (en sık saniyede bir) yenilenir, durunca anlık hız birkaç saniyede 0'a düşer. Konum servisinin bildirimi bu pencereye dönüşür, ayrı bir bildirim çıkmaz; servis yokken (duraklatıldı, arka plan izni yok) aynı pencere tek başına gösterilir. Android 13+'ta kayıt başlarken bildirim izni bir kez sorulur. Bildirim kanalı "Süren kayıt" sessizdir (Android "sessiz" bildirimleri kilit ekranında göstermediği için varsayılan önemde). **Yeni yerel modül** (`apps/mobile/modules/kilit-ekrani`, Kotlin): telefona yeni derleme gerekir. iOS'ta aynı bilgiler (2×2) Live Activity olarak kilit ekranında ve Dynamic Island'da görünür (`expo-widgets` + `@expo/ui`, widget eklentisi `app.lykiva.mobile.ExpoWidgetsTarget`, App Group `group.app.lykiva.mobile`); yeni iOS derlemesi gerekir.

### Telefona bildirim için bir kerelik ayar

1. EAS projesi bağlandı: `@ismailtopcam/lykiva` (proje kimliği `app.json` > `extra.eas.projectId`).
2. iOS: ilk `eas build` sırasında push anahtarı sorulursa evet de; sorulmadıysa `npx eas-cli@latest credentials` > iOS > Push Notifications ile oluştur ya da Apple Developer > Keys'ten indirdiğin `.p8`'i yükle.
3. Telefona geliştirme derlemesi (yukarıda, "Mobil uygulama — ilk kez").
4. Uygulamada Bildirimler ekranında "Aç" → izin ver. Sunucuda `20261110080000_push.sql` uygulanmış ve `pg_net` eklentisi açık olmalı (`uygula.sh` kurmayı dener).

## Sunucu

- Supabase (kendi sunucumuzda, Coolify): https://api.lykiva.app
- Web: https://lykiva.app (Coolify, `apps/web/Dockerfile`). Paylaşım sayfası (`/a/<anahtar>`) ve yönetim paneli (`/admin`) için web uygulamasının
  ortam değişkenlerinde `SUPABASE_ANON_KEY` (lykiva-supabase > `SERVICE_SUPABASEANON_KEY`) olmalı; isteğe bağlı `SUPABASE_URL`, `SITE_URL`.
  Tam yetkili servis anahtarı web'e konmaz; panel her işlemi yöneticinin kendi oturumuyla yapar, yetkiyi veritabanı denetler.
- Yönetici hesabı: Coolify > Terminal > uygulama sunucusunda
  `curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/yonetici.sh -o /tmp/yonetici.sh && bash /tmp/yonetici.sh`
  (e-posta ve şifre sorar, hesabı açar ve yönetici yapar).
