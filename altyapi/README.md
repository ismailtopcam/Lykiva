# Kendi rota ve yer arama sunucularımız

Uygulama şu an herkese açık **brouter.de** (rota çizme) ve **photon.komoot.io** (yer arama) sunucularını kullanıyor.
İkisi de ücretsiz ama "adil kullanım" ile sınırlı; kullanıcı sayısı artınca yetmez (DEV_NOTES). Bu klasör ikisinin
kendi kopyasını Coolify'da çalıştırmak için.

| Servis | Ne | Veri | Bellek |
| --- | --- | --- | --- |
| `brouter/` | BRouter 1.7.10 (Java 21). Uygulamanın profilleri: trekking, fastbike, hiking-mountain, mtb ve kendi `lykiva-yaya-yol` (aşağıda) | brouter.de segmentleri, Türkiye ve çevresi 8 karo, ~210 MB (Kasım 2026); haftalık yenilenir | `BROUTER_BELLEK` (varsayılan 512M) |
| `photon/` | Photon 1.3.0 (Java 21, gömülü OpenSearch) | GraphHopper'ın haftalık Türkiye dökümü (~143 MB sıkıştırılmış, Kasım 2026), Türkçe + İngilizce adlarla içe aktarılır | `PHOTON_BELLEK` (varsayılan 2g) |
| `kart-video/` | 3B paylaşım kartı videoları: MapLibre sahnesi başsız Chromium'da kare kare, ffmpeg ile MP4 (ayrıntı `kart-video/README.md`) | Yok (harita OpenFreeMap, arazi Terrarium; istek anında indirilir) | `KV_BELLEK` (varsayılan 3g), `KV_ISLEMCI` (3 çekirdek) |

İkisi de ilk açılışta verisini kendisi indirir (BRouter birkaç dakika, Photon içe aktarmayla birlikte daha uzun);
veriler kalıcı birimlerde durur, yeniden başlatmada tekrar indirilmez.

## Coolify'da üç ayrı uygulama (17 Kas 2026'dan beri)

Üçü de bu depodan, Base Directory `/altyapi`, sunucu "uygulama". Her birinin önünde kendi kapısı (`kapi/`, aynı imaj)
vardır; biri yeniden kurulunca diğerleri etkilenmez. Watch Paths sayesinde yalnızca kendi klasörü değişince kurulur
(mobil / web değişiklikleri bunları yeniden kurmaz).

| Coolify uygulaması | Compose dosyası | Alan adı (kapi servisine) | Watch Paths |
| --- | --- | --- | --- |
| `brouter` | `/brouter/docker-compose.yml` | `https://brouter.ismailtopcam.dev` | `altyapi/brouter/**`, `altyapi/kapi/**` |
| `photon` | `/photon/docker-compose.yml` | `https://photon.ismailtopcam.dev` | `altyapi/photon/**`, `altyapi/kapi/**` |
| `video` | `/docker-compose.yml` | `https://video.ismailtopcam.dev` | `altyapi/docker-compose.yml`, `altyapi/kart-video/**`, `altyapi/kapi/**` |

`brouter` ve `photon`'da **Connect To Predefined Network** açıktır: Gösterge (aynı sunucu) onlara Coolify'ın `coolify`
ağından `http://brouter:17777` ve `http://photon:2322` ile, kapısız ve anahtarsız gider (Gösterge deposu
`altyapi/rota/README.md`). Bu servis adları ağda tek olmalı; başka bir uygulamaya `brouter` / `photon` adlı servis eklenmez.
Kapı değişirse (`altyapi/kapi/**`) üç uygulama birden yeniden kurulur.

## Kendi BRouter profillerimiz (`brouter/profiller/`)

Klasördeki `.brf` dosyaları imaja, hazır profillerin yanına (`/brouter/profiles2`) kopyalanır; istekte dosya adıyla
çağrılır (`profile=lykiva-yaya-yol`). brouter.de'de bu profiller yoktur; uygulama kendi sunucumuz tanımlı değilse ya da
sunucu profili tanımıyorsa (boş gövdeli 500) hazır profile düşer (`apps/mobile/src/lib/yonlendirme.ts`).

| Profil | Ne için | Neden |
| --- | --- | --- |
| `lykiva-yaya-yol` | "Yol öncelikli" yürüyüş / koşu | Hazır `trekking` bisiklet profili: tek yönlere uyar, `trunk` yolları 10 kat cezalandırır; Ankara'da 3,6 km'lik yürüyüş 6,1 km çıkıyordu |

Profil değişince servis yeniden kurulmalı: `altyapi/brouter/**` değiştiği için `main`'e birleşince Coolify'daki `brouter` kendiliğinden kurulur. Sunucuya koymadan denemek için:
profil metni `POST https://brouter.de/brouter/profile` ile yüklenir, dönen `custom_…` kimliği `profile=` olarak
kullanılır (brouter-web de böyle yapar).

## Kapı: uygulama anahtarı ve istek sınırı (`kapi/`)

Dışarıya yalnızca `kapi` (nginx) açıktır; `brouter` ve `photon`'a alan adı verilmez, yalnızca kapı onlara ulaşır.
Telefonlar sunuculara doğrudan bağlandığı için IP ile kapatmak mümkün değil; bunun yerine:

- **Uygulama anahtarı:** `X-Lykiva-Anahtar` başlığı `LYKIVA_UYGULAMA_ANAHTARI` ile aynı değilse **403**. Anahtar
  Coolify'da (brouter, photon ve video uygulamalarının üçünde de > Environment Variables) ve uygulamada `EXPO_PUBLIC_ALTYAPI_ANAHTARI` (EAS + yerel `.env`)
  olarak durur; repoya yazılmaz. Boş ya da 24 karakterden kısaysa kapı açılmaz. Uygulamanın içinde durduğu için
  kararlı biri çıkarabilir: sıradan kullanımı ve botları keser, asıl koruma istek sınırıdır.
- **IP başına istek sınırı (aşılınca 429):** rota dakikada 60 (+30 anlık), arama dakikada 120 (+40 anlık);
  `LYKIVA_ROTA_SINIRI` / `_YIGIN`, `LYKIVA_ARAMA_SINIRI` / `_YIGIN` ile değişir. Gerçek IP Traefik'in
  `X-Forwarded-For`'undan alınır. Türkiye'de mobil hatlar çoğunlukla ortak IP (CGNAT) kullandığı için sınırlar geniş;
  aynı IP'deki çok kullanıcı 429 alırsa artırılır.
- **Video (`video.ismailtopcam.dev`):** yeni iş (`POST /video`) IP başına dakikada 1 (+4 anlık; `LYKIVA_VIDEO_SINIRI` /
  `_YIGIN`), durum sorgusu ve indirme (`GET /video/<id>[/mp4]`) dakikada 60 (+30). Gövde en fazla 1 MB. Ayrıca servis
  kendi sırasını 20 işle sınırlar (dolunca 503).
- Yalnızca `/brouter`, `/api` ve `/video` geçer; başka yol 404, tanınmayan alan adı bağlantıyı kapatır. `/saglik` sağlık kontrolü.
- Anahtar değişirse: Coolify'da üç uygulamada da yeni değeri gir ve yeniden kur, EAS'ta `EXPO_PUBLIC_ALTYAPI_ANAHTARI`'yı güncelle,
  yeni derleme al. Eski sürümler o andan itibaren 403 alır.

Deneme (anahtar `$A`):

```bash
curl -H "X-Lykiva-Anahtar: $A" "https://photon.ismailtopcam.dev/api/?q=Kaş&limit=3"
curl -H "X-Lykiva-Anahtar: $A" "https://brouter.ismailtopcam.dev/brouter?lonlats=29.6386,36.2018|29.6012,36.2088&profile=trekking&format=geojson"
```

## Kurulu (12 Kas 2026)

Coolify > Uygulamalar > production, sunucu "uygulama". İlk kurulumda tek uygulamaydı (`lykiva-altyapi`); 17 Kas 2026'da
**`brouter`**, **`photon`** ve **`video`** olarak üçe ayrıldı (yukarıdaki tablo; veriler eski birimlerden kopyalandı,
yeniden indirilmedi). Alan adları `https://brouter.ismailtopcam.dev` ve `https://photon.ismailtopcam.dev`. Eski
`brouter.` / `photon.lykiva.app` adları 12 Kas 2026'da kaldırıldı. Ortam: `PHOTON_BELLEK=3g`.
Ölçülen: Photon ilk içe aktarma ~5 dk, ~3 GB bellek; çalışırken ~400 MB. BRouter ~50 MB (boşta).
Haftalık güncelleme (her uygulamanın kendi Scheduled Tasks'ı): pazartesi 05:00 `brouter` uygulaması, `brouter` servisi →
`/brouter/segment-guncelle.sh`; 05:30 `photon` uygulaması, `photon` servisi → `/photon/veri-guncelle.sh && kill 1` (Photon'un 1 numaralı süreci Java; `kill 1` düzgün kapatır,
`restart: unless-stopped` yeni veriyle açar, ~13 sn).

## 3B kart video (`kart-video`) kurulumu

Coolify'daki `video` uygulamasında çalışır (17 Kas 2026'ya kadar adı `lykiva-altyapi`, BRouter ve Photon da içindeydi). Uygulama yalnızca
video üretir; servisin depodaki adı `kart-video` olarak kaldı:

1. **DNS:** `video.ismailtopcam.dev` için A kaydı → 91.90.81.195. `*.ismailtopcam.dev` başka sunucuya gittiği için
   ayrı kayıt şart.
2. Coolify > video > `kapi` servisinin alan adı `https://video.ismailtopcam.dev`.
   `kart-video` servisine alan adı verilmez.
3. Redeploy. İlk kurulumda Playwright imajı (~2 GB) iner, birkaç dakika sürer.
4. Dene (anahtar `$A`): `curl -H "X-Lykiva-Anahtar: $A" https://video.ismailtopcam.dev/video/00000000-0000-0000-0000-000000000000`
   → 404 `iş yok` (anahtarsız 403).

## Kurulum (Coolify)

1. **DNS:** `brouter.ismailtopcam.dev` ve `photon.ismailtopcam.dev` için A kaydı → uygulama sunucusu (91.90.81.195),
   diğer alt alan adları nasıl tanımlıysa öyle.
2. Her servis için ayrı **Coolify > + New > Docker Compose** (kaynak: bu GitHub deposu, dal `main`, Base Directory `/altyapi`),
   sunucu: "uygulama". Compose dosyası, alan adı ve Watch Paths yukarıdaki "Coolify'da üç ayrı uygulama" tablosunda.
3. Alan adını yalnızca **`kapi` servisine** ver; `brouter`, `photon` ve `kart-video` boş kalır (dışarıya kapalı).
   `brouter` ve `photon`'da Connect To Predefined Network'ü aç (Gösterge iç ağdan kullanıyor). Environment Variables'a `LYKIVA_UYGULAMA_ANAHTARI` gir (en az 24
   karakter, harf / rakam / - / _), uygulamadaki `EXPO_PUBLIC_ALTYAPI_ANAHTARI` ile aynı.
4. Deploy. İlk açılışta günlükte "segmentler hazır" ve Photon'un içe aktarma satırları görünür; sağlık kontrolü yeşile dönünce hazır.
5. Dene: yukarıdaki "Kapı" bölümündeki komutlar (anahtarsız istek 403 almalı).
6. Uygulamayı yeni sunuculara bağla — `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_BROUTER_URL=https://brouter.ismailtopcam.dev/brouter
   EXPO_PUBLIC_PHOTON_URL=https://photon.ismailtopcam.dev/api/
   ```
   ve telefona yeniden derle (`.env` derleme sırasında okunur).

## Güncelleme (haftalık, isteğe bağlı)

Coolify > servis > **Scheduled Tasks**:

- `brouter` konteynerinde, haftada bir: `/brouter/segment-guncelle.sh` (dosyaları yerinde değiştirir; BRouter yeni dosyayı okur)
- `photon` konteynerinde, haftada bir: `/photon/veri-guncelle.sh` (yeni klasöre içe aktarır, sonra yer değiştirir — **iki kat disk** ister),
  ardından servisi yeniden başlat.

## Yerel deneme (10 Kasım 2026, Windows, Temurin 21)

Dockerfile'lardaki komutlar Docker olmadan, aynı sürümlerle ve aynı parametrelerle çalıştırıldı:

- **BRouter 1.7.10**, tek karo (`E25_N35`, Kaş): Kaş içinde iki nokta arası rota dört profilde de döndü
  (trekking / fastbike / mtb 3653 m, hiking-mountain 3774 m; 50–110 ms). İstek biçimi uygulamanınkiyle aynı.
- **Photon 1.3.0**, Türkiye dökümü (`-languages tr,en`): 1.177.709 kayıt **124 saniyede** içe aktarıldı, diskte **449 MB**
  (`-Xmx3g` ile). `serve -default-language tr` ile "Kaş", "Uludağ", "Likya Yolu" Türkçe adlarıyla bulundu; konumla
  aramada ("kas", Kaş yakınında) yakındaki yerler öne geldi. Sağlık kontrolü sorgusu 200 döndü.
- Docker imajları ve Coolify kurulumu **denenmedi** (bu makinede Docker yok).

## Notlar

- Photon belgesi dünya verisi için 64 GB RAM önerir; tek ülke çok daha küçüktür. Türkiye verisi bir Windows
  makinesinde Photon 1.3.0 ile içe aktarılıp denendi (yukarıda: 449 MB disk, -Xmx3g). Sunucuda bellek yetmezse `PHOTON_BELLEK` artırılır.
- Kaynaklar ve lisanslar: BRouter (MIT), Photon (Apache 2.0), veri © OpenStreetMap katkıcıları (ODbL). Uygulamanın harita
  ve rota ekranlarında OSM atfı zaten var.
- Uygulama, sunucu adresi değişince kendiliğinden yenisini kullanmaz; `.env` ile derlenir. Eski (herkese açık) sunucular
  yedek olarak kalabilir.
