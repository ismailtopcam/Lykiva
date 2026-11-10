# Kendi rota ve yer arama sunucularımız

Uygulama şu an herkese açık **brouter.de** (rota çizme) ve **photon.komoot.io** (yer arama) sunucularını kullanıyor.
İkisi de ücretsiz ama "adil kullanım" ile sınırlı; kullanıcı sayısı artınca yetmez (DEV_NOTES). Bu klasör ikisinin
kendi kopyasını Coolify'da çalıştırmak için.

| Servis | Ne | Veri | Bellek |
| --- | --- | --- | --- |
| `brouter/` | BRouter 1.7.10 (Java 21). Uygulamanın profilleri: trekking, fastbike, hiking-mountain, mtb | brouter.de segmentleri, Türkiye ve çevresi 8 karo, ~210 MB (Kasım 2026); haftalık yenilenir | `BROUTER_BELLEK` (varsayılan 512M) |
| `photon/` | Photon 1.3.0 (Java 21, gömülü OpenSearch) | GraphHopper'ın haftalık Türkiye dökümü (~143 MB sıkıştırılmış, Kasım 2026), Türkçe + İngilizce adlarla içe aktarılır | `PHOTON_BELLEK` (varsayılan 2g) |

İkisi de ilk açılışta verisini kendisi indirir (BRouter birkaç dakika, Photon içe aktarmayla birlikte daha uzun);
veriler kalıcı birimlerde durur, yeniden başlatmada tekrar indirilmez.

## Kurulum (Coolify)

1. **DNS:** `brouter.lykiva.app` ve `photon.lykiva.app` için A kaydı → uygulama sunucusu (91.90.81.195),
   diğer alt alan adları nasıl tanımlıysa öyle.
2. **Coolify > + New > Docker Compose** (kaynak: bu GitHub deposu, dal `main`, dosya `altyapi/docker-compose.yml`), sunucu: "uygulama".
3. Servislerin alan adlarını ver: `brouter` → `https://brouter.lykiva.app:17777`, `photon` → `https://photon.lykiva.app:2322`
   (Coolify'da adresin sonundaki `:port`, isteği konteynerin o portuna yönlendirir).
4. Deploy. İlk açılışta günlükte "segmentler hazır" ve Photon'un içe aktarma satırları görünür; sağlık kontrolü yeşile dönünce hazır.
5. Dene:
   ```bash
   curl "https://brouter.lykiva.app/brouter?lonlats=29.6386,36.2018|29.6012,36.2088&profile=trekking&format=geojson" | head -c 300
   curl "https://photon.lykiva.app/api/?q=Kaş&limit=3"
   ```
6. Uygulamayı yeni sunuculara bağla — `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_BROUTER_URL=https://brouter.lykiva.app/brouter
   EXPO_PUBLIC_PHOTON_URL=https://photon.lykiva.app/api/
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
