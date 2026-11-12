#!/usr/bin/env bash
# Lykiva — gecelik yedek: Supabase veritabanı + dosya deposu (MinIO / storage), isteğe bağlı sunucu dışına kopya.
#
# "uygulama" sunucusunda çalışır (Coolify > Terminal ya da cron). Ayrıntı: supabase/yedek/README.md
#
#   bash /opt/lykiva/yedekle.sh            # yedek al
#   bash /opt/lykiva/yedekle.sh --kuru     # ne yapacağını göster, bir şey yazma
#
# Ayarlar /etc/lykiva-yedek.env dosyasından (yoksa varsayılanlar):
#   YEDEK_DIZIN=/var/backups/lykiva       yerel yedek klasörü
#   YEDEK_SAKLA_GUN=14                    yerelde kaç günlük yedek kalsın
#   UZAK_SAKLA_GUN=60                     uzakta kaç günlük yedek kalsın
#   SAKLA_ADET=1                          doluysa gün yerine adet: yerelde ve uzakta yalnızca son N yedek kalır
#                                         (eskiler, yeni yedek alınıp uzağa kopyalandıktan sonra silinir)
#   LYKIVA_SUPABASE_ID=nqyujqqkkjyba4flthzcf9uf
#   # Sunucu dışı kopya (S3 uyumlu: Backblaze B2, Cloudflare R2, Contabo…). Boşsa yalnızca yerel yedek.
#   S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
#   S3_BOLGE=eu-central-003
#   S3_KOVA=lykiva-yedek
#   S3_ANAHTAR=...
#   S3_GIZLI=...
#
# Sunucu dışına kopyalama rclone ile yapılır; sunucuya kurmak gerekmez (rclone/rclone Docker imajı).
set -euo pipefail

AYAR=/etc/lykiva-yedek.env
# shellcheck disable=SC1090
[ -f "$AYAR" ] && . "$AYAR"

KIMLIK="${LYKIVA_SUPABASE_ID:-nqyujqqkkjyba4flthzcf9uf}"
DB="${LYKIVA_DB:-supabase-db-$KIMLIK}"
MINIO="${LYKIVA_MINIO:-supabase-minio-$KIMLIK}"
STORAGE="${LYKIVA_STORAGE:-supabase-storage-$KIMLIK}"
YEDEK_DIZIN="${YEDEK_DIZIN:-/var/backups/lykiva}"
YEDEK_SAKLA_GUN="${YEDEK_SAKLA_GUN:-14}"
UZAK_SAKLA_GUN="${UZAK_SAKLA_GUN:-60}"
SAKLA_ADET="${SAKLA_ADET:-}"
case "$SAKLA_ADET" in ''|*[!0-9]*|0) SAKLA_ADET="" ;; esac
# SAKLA_ADET için: verilen ad listesinden, son SAKLA_ADET yedek ve bu çalışmanınki dışındakileri yazar.
# Yalnızca yedek adlarına (20261112-023001) bakar; başka klasörlere dokunmaz.
eskiler() {
  printf '%s\n' "$1" | grep -E '^[0-9]{8}-[0-9]{6}$' | sort | head -n -"$SAKLA_ADET" | grep -vx "$ZAMAN" || true
}
KURU=0
[ "${1:-}" = "--kuru" ] && KURU=1

ZAMAN="$(date -u +%Y%m%d-%H%M%S)"
HEDEF="$YEDEK_DIZIN/$ZAMAN"
log() { echo "[$(date -u +%H:%M:%S)] $*"; }
calistir() { if [ "$KURU" = 1 ]; then echo "  (kuru) $*"; else "$@"; fi; }

konteyner_var() { docker ps --format '{{.Names}}' < /dev/null | grep -qx "$1"; }

if ! konteyner_var "$DB"; then
  log "HATA: veritabanı konteyneri yok: $DB (LYKIVA_DB ile değiştirilebilir)"
  exit 1
fi

calistir mkdir -p "$HEDEF"
chmod 700 "$YEDEK_DIZIN" 2>/dev/null || true

# 1) Veritabanı: özel biçim (pg_restore ile seçerek geri yüklenebilir) + roller
log "Veritabanı dökümü: $DB"
if [ "$KURU" = 1 ]; then
  echo "  (kuru) docker exec $DB pg_dump -U postgres -Fc postgres > $HEDEF/postgres.dump"
  echo "  (kuru) docker exec $DB pg_dumpall -U postgres --roles-only > $HEDEF/roller.sql"
else
  docker exec "$DB" pg_dump -U postgres -Fc --no-owner postgres < /dev/null > "$HEDEF/postgres.dump"
  docker exec "$DB" pg_dumpall -U postgres --roles-only < /dev/null > "$HEDEF/roller.sql"
  # Döküm okunabiliyor mu (içindekiler listesi çıkıyor mu)
  if ! docker exec -i "$DB" pg_restore --list < "$HEDEF/postgres.dump" > /dev/null; then
    log "HATA: döküm doğrulanamadı"
    exit 1
  fi
  docker exec "$DB" psql -U postgres -tAc "select 'aktivite=' || (select count(*) from public.activities) || ' kullanici=' || (select count(*) from auth.users) || ' rota=' || (select count(*) from public.routes)" < /dev/null > "$HEDEF/sayilar.txt"
  log "  $(du -h "$HEDEF/postgres.dump" | cut -f1) · $(cat "$HEDEF/sayilar.txt")"
fi

# 2) Dosya deposu: MinIO varsa onun /data'sı, yoksa storage konteynerinin dosya klasörü
baglama_kaynagi() { docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$2\"}}{{.Source}}{{end}}{{end}}" "$1" < /dev/null 2>/dev/null || true; }
DOSYA_KAYNAK=""
if konteyner_var "$MINIO"; then
  DOSYA_KAYNAK="$(baglama_kaynagi "$MINIO" /data)"
elif konteyner_var "$STORAGE"; then
  DOSYA_KAYNAK="$(baglama_kaynagi "$STORAGE" /var/lib/storage)"
fi
if [ -n "$DOSYA_KAYNAK" ] && [ -d "$DOSYA_KAYNAK" ]; then
  log "Dosya deposu: $DOSYA_KAYNAK"
  calistir tar -C "$DOSYA_KAYNAK" -czf "$HEDEF/dosyalar.tar.gz" .
  [ "$KURU" = 1 ] || log "  $(du -h "$HEDEF/dosyalar.tar.gz" | cut -f1)"
else
  log "Uyarı: dosya deposu bulunamadı ($MINIO / $STORAGE). Yalnızca veritabanı yedeklendi."
fi

# 3) Sağlama toplamları
if [ "$KURU" = 0 ]; then
  (cd "$HEDEF" && sha256sum ./* > SHA256SUMS)
  chmod -R go-rwx "$HEDEF"
fi

# 4) Sunucu dışı kopya (rclone, Docker imajıyla)
if [ -n "${S3_KOVA:-}" ] && [ -n "${S3_ANAHTAR:-}" ] && [ -n "${S3_GIZLI:-}" ]; then
  log "Sunucu dışına kopya: s3://$S3_KOVA/$ZAMAN"
  RCLONE=(docker run --rm -v "$YEDEK_DIZIN:/yedek:ro"
    -e RCLONE_CONFIG_UZAK_TYPE=s3 -e RCLONE_CONFIG_UZAK_PROVIDER=Other
    -e RCLONE_CONFIG_UZAK_ENDPOINT="${S3_ENDPOINT:-}" -e RCLONE_CONFIG_UZAK_REGION="${S3_BOLGE:-auto}"
    -e RCLONE_CONFIG_UZAK_ACCESS_KEY_ID="$S3_ANAHTAR" -e RCLONE_CONFIG_UZAK_SECRET_ACCESS_KEY="$S3_GIZLI"
    "${RCLONE_IMAJ:-rclone/rclone:latest}")
  calistir "${RCLONE[@]}" copy "/yedek/$ZAMAN" "uzak:$S3_KOVA/$ZAMAN" --s3-no-check-bucket
  # Uzakta eski yedekleri temizle (buraya ancak kopya başarılıysa gelinir: set -e)
  if [ -n "$SAKLA_ADET" ]; then
    log "Uzakta son $SAKLA_ADET yedek kalıyor, eskiler siliniyor"
    if UZAKTAKILER="$("${RCLONE[@]}" lsf --dirs-only "uzak:$S3_KOVA" --s3-no-check-bucket < /dev/null)"; then
      eskiler "$(printf '%s\n' "$UZAKTAKILER" | sed 's#/$##')" | while read -r eski; do
        log "  siliniyor: s3://$S3_KOVA/$eski"
        calistir "${RCLONE[@]}" purge "uzak:$S3_KOVA/$eski" --s3-no-check-bucket < /dev/null \
          || log "  Uyarı: silinemedi, yarın yeniden denenecek"
      done
    else
      log "  Uyarı: uzaktaki yedekler listelenemedi; eski yedekler yarın silinecek"
    fi
  else
    calistir "${RCLONE[@]}" delete "uzak:$S3_KOVA" --min-age "${UZAK_SAKLA_GUN}d" --s3-no-check-bucket
    calistir "${RCLONE[@]}" rmdirs "uzak:$S3_KOVA" --leave-root --s3-no-check-bucket
  fi
else
  log "Uyarı: S3 ayarı yok; yedek yalnızca bu sunucuda ($YEDEK_DIZIN). Disk kaybında işe yaramaz."
fi

# 5) Yerelde eski yedekleri temizle
if [ -n "$SAKLA_ADET" ]; then
  log "Yerelde son $SAKLA_ADET yedek kalıyor, eskiler siliniyor"
  eskiler "$(find "$YEDEK_DIZIN" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null)" | while read -r eski; do
    log "  siliniyor: $YEDEK_DIZIN/$eski"
    calistir rm -rf -- "${YEDEK_DIZIN:?}/$eski"
  done
elif [ "$KURU" = 1 ]; then
  log "Yerelde $YEDEK_SAKLA_GUN günden eski yedekler siliniyor"
  find "$YEDEK_DIZIN" -mindepth 1 -maxdepth 1 -type d -mtime +"$YEDEK_SAKLA_GUN" -print 2>/dev/null | sed 's/^/  (kuru) silinecek: /' || true
else
  log "Yerelde $YEDEK_SAKLA_GUN günden eski yedekler siliniyor"
  find "$YEDEK_DIZIN" -mindepth 1 -maxdepth 1 -type d -mtime +"$YEDEK_SAKLA_GUN" -exec rm -rf {} + 2>/dev/null || true
fi

log "Tamam: $HEDEF"
