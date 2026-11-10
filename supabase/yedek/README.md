# Yedekleme

Supabase veritabanının ve dosya deposunun gecelik yedeği. Betikler "uygulama" sunucusunda (91.90.81.195) çalışır;
diğer uygulamalara (artieksi, fatosunkitapligi, gosterge, tez, paylaşılan postgres) dokunmaz.

| Betik | Ne yapar |
| --- | --- |
| `kur.sh` | Bir kez çalıştırılır: betikleri `/opt/lykiva`'ya indirir, `/etc/lykiva-yedek.env` ayar dosyasını yazar, her gece 03:30 için cron ekler, hemen bir deneme yedeği alır |
| `yedekle.sh` | Yedek alır: `pg_dump` (özel biçim, doğrulanır) + roller + dosya deposu (MinIO `/data` ya da storage klasörü) + `SHA256SUMS` + o anki aktivite/kullanıcı/rota sayıları. S3 ayarı varsa sunucu dışına kopyalar (rclone, Docker imajıyla). Yerelde 14, uzakta 60 günden eskileri siler |
| `geri-yukle-dene.sh` | Yedeğin geri yüklenebildiğini dener: canlı veritabanıyla aynı imajdan geçici bir konteyner açar, dökümü boş bir veritabanına yükler, sayıları yedek anındakilerle karşılaştırır, konteyneri siler. **Canlı veritabanına dokunmaz** |

## Kurulum (bir kez)

Coolify > Terminal > uygulama sunucusu:

```bash
curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/yedek/kur.sh -o /tmp/yedek-kur.sh && bash /tmp/yedek-kur.sh
```

Sonra:

1. **Sunucu dışı depolama** (disk ya da sunucu kaybında yedeğin işe yaraması için şart): bir S3 uyumlu kova aç
   (Backblaze B2, Cloudflare R2, Contabo Object Storage…), yalnızca o kovaya yazabilen bir anahtar oluştur ve
   `nano /etc/lykiva-yedek.env` ile `S3_ENDPOINT`, `S3_BOLGE`, `S3_KOVA`, `S3_ANAHTAR`, `S3_GIZLI` alanlarını doldur.
   Anahtarlar bu dosyada kalır (yalnızca root okur); sohbete ya da repoya yazılmaz.
2. Bir yedek al ve uzakta göründüğünü kontrol et: `bash /opt/lykiva/yedekle.sh`
3. **Geri yüklemeyi bir kez dene:** `bash /opt/lykiva/geri-yukle-dene.sh` → "✓ Geri yükleme doğrulandı" görmelisin.

Günlük: `tail -n 50 /var/log/lykiva-yedek.log` · Yerel yedekler: `ls /var/backups/lykiva`

## Gerçek geri yükleme (felaket durumunda)

Önce `geri-yukle-dene.sh` ile yedeğin sağlam olduğunu doğrula. Sonra (Supabase servisi Coolify'da yeniden kurulmuşsa,
boş veritabanına):

```bash
Y=/var/backups/lykiva/<tarih>          # uzaktaysa önce indir: rclone copy uzak:<kova>/<tarih> $Y
DB=supabase-db-nqyujqqkkjyba4flthzcf9uf
docker exec -i $DB pg_restore -U postgres -d postgres --clean --if-exists --no-owner < $Y/postgres.dump
# Dosya deposu (MinIO): konteyneri durdur, /data bağlamasına aç, yeniden başlat
tar -C "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' supabase-minio-nqyujqqkkjyba4flthzcf9uf)" -xzf $Y/dosyalar.tar.gz
```

`--clean` mevcut nesneleri silip yeniden kurar; canlı ve dolu bir veritabanında **çalıştırma**.

## Not

- Konteyner adları farklıysa `/etc/lykiva-yedek.env` içinde `LYKIVA_DB`, `LYKIVA_MINIO`, `LYKIVA_STORAGE` ile değiştirilebilir.
- Coolify'ın kendi "Scheduled Backups" özelliği de veritabanını S3'e yedekleyebilir; bu betikler ek olarak dosya deposunu ve geri yükleme denemesini kapsar.
- Bu betikler Windows'ta sahte bir `docker` komutuyla denendi (akış, sağlama toplamı, S3 komutları, eski yedek temizliği); gerçek sunucuda henüz çalıştırılmadı.
