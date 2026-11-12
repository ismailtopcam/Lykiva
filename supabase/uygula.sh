#!/bin/bash
# Lykiva — sunucudaki veritabanına eksik migration'ları uygular.
#
# Coolify > Terminal > "uygulama" sunucusunda çalıştır:
#
#   Önce yalnızca durumu gör (hiçbir şey değiştirmez):
#     curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/uygula.sh | bash
#
#   Eksikleri uygula:
#     curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/uygula.sh | bash -s -- uygula
#
# Her migration'ın uygulanıp uygulanmadığını, o migration'ın oluşturduğu bir tablo ya da fonksiyona
# bakarak anlar; yalnızca eksik olanları sırayla, her birini tek bir işlem (transaction) içinde uygular.
# Bir migration hata verirse o migration'ın hiçbir parçası kalmaz ve betik durur.
set -euo pipefail

DB="${LYKIVA_DB:-supabase-db-nqyujqqkkjyba4flthzcf9uf}"
KAYNAK="${LYKIVA_KAYNAK:-https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/migrations}"
MOD="${1:-durum}"

# dosya | uygulanmış mı diye bakılan SQL ifadesi (true / false döner)
MIGRATIONLAR=(
  "20261107000000_ilk_sema.sql|to_regclass('public.profiles') is not null"
  "20261108000000_kayit_ve_kurallar.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'aktivite_detay')"
  "20261109000000_giris.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'devir_kodu_al')"
  "20261109010000_rotalar.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'kaydet_rota')"
  "20261109020000_paylasim.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'aktivite_noktalari')"
  "20261109030000_gruplar.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'grup_olustur')"
  "20261109040000_etkinlikler.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'etkinlik_olustur')"
  "20261109050000_canli_konum.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'canli_konum_gonder')"
  "20261110000000_akis_takip.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'akis')"
  "20261110010000_yorumlar.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'yorum_yaz')"
  "20261110020000_paylasim_baglantisi.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'paylasilan_aktivite')"
  "20261110030000_bildirimler.sql|to_regclass('public.bildirimler') is not null"
  "20261110040000_birlikte.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'birlikte_ekle')"
  "20261110050000_kesfet.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'kesfet_rotalar')"
  "20261110060000_yonetim.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'yonetim_ozet')"
  "20261110070000_hava.sql|exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activities' and column_name = 'weather')"
  "20261110080000_push.sql|to_regclass('public.push_jetonlari') is not null"
  "20261110090000_profil.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'profil_guncelle')"
  "20261110100000_fotograflar.sql|exists (select 1 from storage.buckets where id = 'mola')"
  "20261110110000_yonetim_moderasyon.sql|exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'yonetim_engelle')"
  "20261110120000_hava_paylasim_push_temizligi.sql|to_regclass('public.push_istekleri') is not null"
  "20261111000000_hesap_silme_ayarlar.sql|to_regclass('public.site_ayarlari') is not null"
  "20261112000000_dil.sql|exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'dil')"
  "20261113000000_hedefler_meydan_okumalar.sql|to_regclass('public.meydan_okumalar') is not null"
  "20261114000000_isi_haritalari.sql|exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'isi_haritasinda')"
  "20261115000000_gizlilik.sql|exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'profil_gizliligi')"
  "20261116000000_ek_gizlilik.sql|to_regclass('public.engellemeler') is not null"
  "20261117000000_kulupler.sql|to_regclass('public.grup_gonderileri') is not null"
)

# Betik "curl ... | bash" ile çalışırken kendi girdisi betiğin geri kalanıdır: sorgular girdi okumamalı,
# yoksa docker exec -i betiğin kalanını yutar ve betik sessizce biter
sorgu() { docker exec "$DB" psql -U postgres -tAq -v ON_ERROR_STOP=1 -c "$1" < /dev/null; }

if ! docker ps --format '{{.Names}}' < /dev/null | grep -qx "$DB"; then
  echo "Veritabanı konteyneri bulunamadı: $DB"
  echo "Bu betik 'uygulama' sunucusunda çalışmalı. Konteyner adı farklıysa: LYKIVA_DB=ad bash ..."
  exit 1
fi

echo ""
echo "Veritabanı: $DB ($(sorgu 'show server_version'))"
echo ""
EKSIK=()
for satir in "${MIGRATIONLAR[@]}"; do
  dosya="${satir%%|*}"
  ifade="${satir#*|}"
  if [ "$(sorgu "select $ifade")" = "t" ]; then
    echo "  ✓ $dosya"
  else
    echo "  · $dosya  (uygulanmamış)"
    EKSIK+=("$dosya")
  fi
done
echo ""

if [ "${#EKSIK[@]}" -eq 0 ]; then
  echo "Bütün migration'lar uygulanmış."
elif [ "$MOD" != "uygula" ]; then
  echo "${#EKSIK[@]} migration eksik. Uygulamak için aynı komutu sonuna '-s -- uygula' ekleyerek çalıştır:"
  echo "  curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/uygula.sh | bash -s -- uygula"
  exit 0
else
  for dosya in "${EKSIK[@]}"; do
    echo "→ $dosya uygulanıyor..."
    if curl -fsSL "$KAYNAK/$dosya" | docker exec -i "$DB" psql -U postgres -q -v ON_ERROR_STOP=1 -1 > /tmp/lykiva-migration.log 2>&1; then
      echo "  tamam"
    else
      echo "  HATA — bu migration geri alındı, sonrakiler uygulanmadı. Ayrıntı:"
      tail -n 20 /tmp/lykiva-migration.log
      exit 1
    fi
  done
  echo ""
  echo "Eksik migration'lar uygulandı."
fi

echo ""
echo "Canlı sohbet (Realtime):"
if docker ps --format '{{.Names}} {{.Status}}' < /dev/null | grep -i realtime; then
  :
else
  echo "  Realtime konteyneri çalışmıyor görünüyor — grup sohbeti canlı akmaz (sayfa yenilenince görünür)."
fi
YAYIN=$(sorgu "select coalesce(string_agg(tablename, ', '), '') from pg_publication_tables where pubname = 'supabase_realtime'" || true)
echo "  Realtime yayınındaki tablolar: ${YAYIN:-(yok)}"
