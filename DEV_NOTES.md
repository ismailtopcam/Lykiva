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
