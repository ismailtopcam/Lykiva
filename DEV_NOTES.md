# Lykiva — Geliştirme Notları

Bisiklet, koşu, yürüyüş ve doğa sporları için takip + sosyal paylaşım uygulaması.
Ekran tasarımları: Lykiva — Mobil Uygulama (Claude Design canvas'ı).

## Yapılacaklar

### [x] Hava durumu (20. aşama)
Servis: **MET Norway** (api.met.no locationforecast 2.0) — anahtarsız, ticari kullanım dahil ücretsiz, CC BY 4.0
(uygulamada "Kaynak: MET Norway"). Open-Meteo'nun ücretsiz katmanı ticari olmayan kullanımla sınırlı olduğu için seçilmedi.
Kurallar: tanıtıcı User-Agent (`Lykiva/0.1 (+https://lykiva.ismailtopcam.dev)`), koordinat en fazla 4 ondalık (3 kullanılıyor),
aynı yer için 30 dk önbellek. Adres `EXPO_PUBLIC_HAVA_URL` ile değişir. Yapılmayan: rota detayında tahmin (rotanın planlanan
tarihi yok), web paylaşım sayfasında hava, aktivite boyunca aralıklarla ölçüm (yalnızca başta bir kez).

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

### [~] Yedekleme
Betikler hazır (`supabase/yedek/`, nasıl kurulacağı `supabase/yedek/README.md`'de); sunucuya kurulup S3 kovası
bağlanınca ve geri yükleme bir kez denenince [x] olacak. O zamana kadar yedek alınmıyor.

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

### [ ] Giriş: Google ve Apple — sunucu ve konsol ayarı
Kod hazır (4. aşama). Kalanlar `supabase/README.md` > Giriş bölümünde:
- Kalıcı bundle ID kararı (şu an `app.lykiva.mobile`)
- Coolify'da `supabase-auth` ortam değişkenleri, `20261109000000_giris.sql` migration'ının uygulanması
- Google Cloud OAuth istemcisi, Apple Developer'da Sign in with Apple
