# Lykiva — Geliştirme Notları

Bisiklet, koşu, yürüyüş ve doğa sporları için takip + sosyal paylaşım uygulaması.
Ekran tasarımları: Lykiva — Mobil Uygulama (Claude Design canvas'ı).

## Yapılacaklar

### [ ] Hava durumu
Aktivitenin hangi havada yapıldığı kaydedilecek ve gösterilecek.

- Kayıt başlarken (ve gerekirse aktivite boyunca aralıklarla) o konumun hava bilgisini al:
  sıcaklık, hissedilen sıcaklık, rüzgâr hızı ve yönü, nem, yağış durumu, UV
- Aktivite özetinde "Hava" bölümü (ör. 24°C, parçalı bulutlu, 14 km/sa batı rüzgârı)
- Akıştaki aktivite kartında ve paylaşım kartında hava bilgisi
  (paylaşım stüdyosundaki "Kartta göster" seçeneklerine eklenecek)
- Rüzgârı rota yönüne göre yorumla: karşıdan / arkadan / yandan rüzgâr
- Rota detayı ve etkinlik detayında, planlanan tarih-saat için hava tahmini
- Tasarımda karşılığı henüz yok: Aktivite özeti, Akış kartı, Paylaşım stüdyosu,
  Rota detayı ve Etkinlik detayı ekranlarına eklenecek
- Karar bekleyen: hangi hava durumu servisi kullanılacak (seçenekler araştırılacak)

### [ ] Yedekleme
Şu an Supabase veritabanının ve dosyalarının yedeği alınmıyor. Sunucu ya da disk kaybında veri geri gelmez.

- Supabase veritabanını (`lykiva-supabase` servisindeki `supabase-db`) her gece yedekle
- Yedekleri sunucu dışında tut (S3 uyumlu depolama: Contabo Object Storage, Backblaze B2, Cloudflare R2…)
- Supabase Storage'daki dosyalar (fotoğraflar, MinIO) da yedeğe dahil edilmeli
- Geri yükleme bir kez denenip doğrulanmalı
- Gerçek kullanıcılar gelmeden önce yapılmalı

### [ ] Kendi rota hesaplama ve yer arama sunucumuz
Rota çizimi şu an herkese açık sunucuları kullanıyor: BRouter (brouter.de) ve Photon (photon.komoot.io).
İkisi de ücretsiz ama "adil kullanım" ile sınırlı; kullanıcı sayısı artınca yetmez.

- Uygulama sunucusuna BRouter kur (Java; Türkiye + çevresi için segment dosyaları birkaç yüz MB)
- Photon ya da Nominatim kur (Türkiye verisiyle)
- Mobilde adresler `.env` ile değişir: `EXPO_PUBLIC_BROUTER_URL`, `EXPO_PUBLIC_PHOTON_URL`
- Gerçek kullanıcılar gelmeden önce yapılmalı

### [ ] Giriş: Google ve Apple
En sona bırakıldı. Gerekenler: kalıcı bundle ID kararı (şu an `app.lykiva.mobile`), Apple Developer Program üyeliği,
Google Cloud'da OAuth istemcileri. Anonim hesaplar `linkIdentity` ile Google/Apple'a bağlanacak, kayıtlar kaybolmayacak.
