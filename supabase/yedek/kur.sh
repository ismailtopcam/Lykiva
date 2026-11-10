#!/usr/bin/env bash
# Lykiva — gecelik yedeği "uygulama" sunucusuna kurar (bir kez; tekrar çalıştırmak güvenli).
#
# Coolify > Terminal > uygulama sunucusunda:
#   curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/yedek/kur.sh -o /tmp/yedek-kur.sh && bash /tmp/yedek-kur.sh
#
# - Betikleri /opt/lykiva altına indirir (yedekle.sh, geri-yukle-dene.sh)
# - /etc/lykiva-yedek.env yoksa örnek ayar dosyasını yazar (yalnızca root okur)
# - Her gece 03:30'da (sunucu saati) yedek alan cron satırını ekler; günlük: /var/log/lykiva-yedek.log
# - Hemen bir deneme yedeği alır
set -euo pipefail

KAYNAK="${LYKIVA_KAYNAK:-https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/yedek}"
HEDEF=/opt/lykiva
AYAR=/etc/lykiva-yedek.env

if [ "$(id -u)" != 0 ]; then
  echo "root olarak çalıştır (sudo bash /tmp/yedek-kur.sh)."
  exit 1
fi

mkdir -p "$HEDEF"
for f in yedekle.sh geri-yukle-dene.sh; do
  curl -fsSL "$KAYNAK/$f" -o "$HEDEF/$f" < /dev/null
  chmod 700 "$HEDEF/$f"
done
echo "✓ Betikler: $HEDEF"

if [ ! -f "$AYAR" ]; then
  cat > "$AYAR" <<'AYARLAR'
# Lykiva yedek ayarları (yalnızca root okur). Değiştirince bir şey yeniden başlatmak gerekmez.
YEDEK_DIZIN=/var/backups/lykiva
YEDEK_SAKLA_GUN=14
UZAK_SAKLA_GUN=60
LYKIVA_SUPABASE_ID=nqyujqqkkjyba4flthzcf9uf

# Sunucu dışı kopya (S3 uyumlu). Doldurulmazsa yedek yalnızca bu sunucuda kalır.
# Örnek (Backblaze B2): S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com  S3_BOLGE=eu-central-003
# Örnek (Cloudflare R2): S3_ENDPOINT=https://<hesap-id>.r2.cloudflarestorage.com  S3_BOLGE=auto
S3_ENDPOINT=
S3_BOLGE=
S3_KOVA=
S3_ANAHTAR=
S3_GIZLI=
AYARLAR
  chmod 600 "$AYAR"
  echo "✓ Ayar dosyası yazıldı: $AYAR (S3 bilgilerini buraya gir: nano $AYAR)"
else
  echo "· Ayar dosyası zaten var: $AYAR"
fi

SATIR="30 3 * * * root bash $HEDEF/yedekle.sh >> /var/log/lykiva-yedek.log 2>&1"
echo "$SATIR" > /etc/cron.d/lykiva-yedek
chmod 644 /etc/cron.d/lykiva-yedek
echo "✓ Cron: her gece 03:30 (/etc/cron.d/lykiva-yedek)"

echo ""
echo "Deneme yedeği alınıyor…"
bash "$HEDEF/yedekle.sh"
echo ""
echo "Sonraki adım: geri yüklemeyi bir kez dene → bash $HEDEF/geri-yukle-dene.sh"
