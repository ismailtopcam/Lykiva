#!/usr/bin/env bash
# Lykiva — yedeğin gerçekten geri yüklenebildiğini dener (canlı veritabanına DOKUNMAZ).
#
#   bash /opt/lykiva/geri-yukle-dene.sh                 # en son yerel yedek
#   bash /opt/lykiva/geri-yukle-dene.sh /var/backups/lykiva/20261111-033000
#
# Ne yapar:
#   1. Yedeğin sağlama toplamlarını (SHA256SUMS) denetler
#   2. Canlı veritabanıyla aynı imajdan geçici bir Postgres konteyneri açar
#   3. Dökümü bu geçici konteynerde "deneme" adlı boş bir veritabanına yükler
#   4. Aktivite / kullanıcı / rota sayılarını yedek anındaki sayılarla karşılaştırır
#   5. Geçici konteyneri siler
set -euo pipefail

AYAR=/etc/lykiva-yedek.env
# shellcheck disable=SC1090
[ -f "$AYAR" ] && . "$AYAR"
KIMLIK="${LYKIVA_SUPABASE_ID:-nqyujqqkkjyba4flthzcf9uf}"
DB="${LYKIVA_DB:-supabase-db-$KIMLIK}"
YEDEK_DIZIN="${YEDEK_DIZIN:-/var/backups/lykiva}"
GECICI=lykiva-geri-yukle-deneme

KAYNAK="${1:-$(find "$YEDEK_DIZIN" -mindepth 1 -maxdepth 1 -type d | sort | tail -n1)}"
if [ -z "$KAYNAK" ] || [ ! -f "$KAYNAK/postgres.dump" ]; then
  echo "Yedek bulunamadı ($YEDEK_DIZIN). Önce yedekle.sh çalıştır."
  exit 1
fi
echo "Yedek: $KAYNAK"

(cd "$KAYNAK" && sha256sum -c --quiet SHA256SUMS) && echo "  ✓ sağlama toplamları doğru"

IMAJ="$(docker inspect -f '{{.Config.Image}}' "$DB" < /dev/null)"
echo "Geçici konteyner: $IMAJ"
docker rm -f "$GECICI" > /dev/null 2>&1 < /dev/null || true
SIFRE="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
docker run -d --name "$GECICI" -e POSTGRES_PASSWORD="$SIFRE" "$IMAJ" > /dev/null < /dev/null
temizle() { docker rm -f "$GECICI" > /dev/null 2>&1 < /dev/null || true; }
trap temizle EXIT

printf "  açılması bekleniyor"
for _ in $(seq 1 90); do
  if docker exec "$GECICI" pg_isready -U postgres -q < /dev/null 2>/dev/null; then break; fi
  printf "."; sleep 2
done
echo
# İlk açılış betikleri bitene kadar biraz daha bekle
sleep 5

docker exec "$GECICI" psql -U postgres -q -c "create database deneme" < /dev/null
echo "Döküm yükleniyor (Supabase'in kendi şemalarıyla ilgili uyarılar normaldir)"
docker exec -i "$GECICI" pg_restore -U postgres -d deneme --no-owner --no-privileges < "$KAYNAK/postgres.dump" > /tmp/lykiva-geri-yukle.log 2>&1 || true
echo "  pg_restore çıktısı: /tmp/lykiva-geri-yukle.log ($(grep -c 'error' /tmp/lykiva-geri-yukle.log || true) hata satırı)"

SIMDI="$(docker exec "$GECICI" psql -U postgres -d deneme -tAc "select 'aktivite=' || (select count(*) from public.activities) || ' kullanici=' || (select count(*) from auth.users) || ' rota=' || (select count(*) from public.routes)" < /dev/null 2>/dev/null || echo "okunamadı")"
BEKLENEN="$(cat "$KAYNAK/sayilar.txt" 2>/dev/null || echo "bilinmiyor")"
echo "  yedek anında: $BEKLENEN"
echo "  geri yüklenen: $SIMDI"
if [ "$SIMDI" = "$BEKLENEN" ]; then
  echo "✓ Geri yükleme doğrulandı: sayılar aynı."
else
  echo "✗ Sayılar farklı ya da okunamadı. /tmp/lykiva-geri-yukle.log dosyasına bak."
  exit 1
fi
