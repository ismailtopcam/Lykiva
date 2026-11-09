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
13. **Web paylaşım sayfası** — paylaşım stüdyosundaki "Bağlantı" ile aktivite için `lykiva.ismailtopcam.dev/a/<anahtar>` bağlantısı açılır ve telefonun paylaşım menüsüyle gönderilir; bağlantısı olan herkes giriş yapmadan web'de görür (rota, değerler, yükseklik profili). WhatsApp / Telegram / X önizlemesinde rota görseli çıkar. Sahibi bağlantıyı istediği an kapatır; başlangıç/bitiş gizliyse iz kırpılır, sayfa arama motorlarına kapalı.
14. Sırada: birlikte yapılan aktivite, bildirimler.

## Sunucu

- Supabase (kendi sunucumuzda, Coolify): https://api.lykiva.ismailtopcam.dev
- Web: https://lykiva.ismailtopcam.dev (Coolify, `apps/web/Dockerfile`). Paylaşım sayfası (`/a/<anahtar>`) için web uygulamasının
  ortam değişkenlerinde `SUPABASE_ANON_KEY` (lykiva-supabase > `SERVICE_SUPABASEANON_KEY`) olmalı; isteğe bağlı `SUPABASE_URL`, `SITE_URL`.
