#!/usr/bin/env bash
# Lykiva — yönetim paneli için yönetici hesabı aç ya da var olan hesaba yönetici yetkisi ver.
#
# Coolify > Terminal > "uygulama" sunucusunda (şifre soracağı için önce indirip sonra çalıştır):
#   curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/yonetici.sh -o /tmp/yonetici.sh && bash /tmp/yonetici.sh
#
# - E-posta sorar. Bu e-postayla hesap yoksa şifre sorar ve hesabı (e-postası onaylı) açar.
# - Sonra hesaba yönetici yetkisi verir (profiles.is_admin = true).
# - Hesap açmak için Supabase servis anahtarı gerekir; betik onu Kong konteynerinden okur.
#   Okuyamazsa: LYKIVA_SERVICE_KEY=... bash /tmp/yonetici.sh
#   (Coolify > lykiva-supabase > Environment Variables > SERVICE_SUPABASESERVICE_KEY). Anahtar hiçbir yere yazılmaz.
# - Sonra giriş: https://lykiva.ismailtopcam.dev/admin
set -euo pipefail

KIMLIK="${LYKIVA_SUPABASE_ID:-nqyujqqkkjyba4flthzcf9uf}"
DB="${LYKIVA_DB:-supabase-db-$KIMLIK}"
KONG="${LYKIVA_KONG:-supabase-kong-$KIMLIK}"
URL="${LYKIVA_URL:-https://api.lykiva.ismailtopcam.dev}"

sorgu() { docker exec "$DB" psql -U postgres -tAq -v ON_ERROR_STOP=1 -c "$1" < /dev/null; }

if ! docker ps --format '{{.Names}}' < /dev/null | grep -qx "$DB"; then
  echo "Veritabanı konteyneri bulunamadı: $DB"
  echo "Bu betik 'uygulama' sunucusunda çalışmalı. Ad farklıysa: LYKIVA_DB=ad bash /tmp/yonetici.sh"
  exit 1
fi

if [ "$(sorgu "select to_regprocedure('public.yonetici_mi()') is not null")" != "t" ]; then
  echo "Yönetim migration'ı (20261110060000_yonetim.sql) uygulanmamış. Önce: supabase/uygula.sh ... | bash -s -- uygula"
  exit 1
fi

read -rp "Yöneticinin e-postası: " EPOSTA
EPOSTA="$(echo "$EPOSTA" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
if ! [[ "$EPOSTA" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$ ]]; then
  echo "E-posta geçersiz."
  exit 1
fi

KISI="$(sorgu "select id from auth.users where lower(email) = '$EPOSTA'")"

if [ -z "$KISI" ]; then
  echo "Bu e-postayla hesap yok; yeni hesap açılacak."
  read -rsp "Şifre (en az 12 karakter): " SIFRE; echo
  read -rsp "Şifre (tekrar): " SIFRE2; echo
  if [ "$SIFRE" != "$SIFRE2" ]; then echo "Şifreler aynı değil."; exit 1; fi
  if [ "${#SIFRE}" -lt 12 ]; then echo "Şifre en az 12 karakter olmalı."; exit 1; fi

  SERVIS="${LYKIVA_SERVICE_KEY:-$(docker exec "$KONG" printenv SUPABASE_SERVICE_KEY < /dev/null 2>/dev/null || true)}"
  if [ -z "$SERVIS" ]; then
    echo "Servis anahtarı okunamadı ($KONG)."
    echo "Coolify > lykiva-supabase > Environment Variables > SERVICE_SUPABASESERVICE_KEY değeriyle:"
    echo "  LYKIVA_SERVICE_KEY=... bash /tmp/yonetici.sh"
    exit 1
  fi

  # JSON için şifredeki \ ve " kaçışlanır
  SIFRE_JSON="${SIFRE//\\/\\\\}"
  SIFRE_JSON="${SIFRE_JSON//\"/\\\"}"
  YANIT="$(curl -sS -w '\n%{http_code}' -X POST "$URL/auth/v1/admin/users" \
    -H "apikey: $SERVIS" -H "Authorization: Bearer $SERVIS" -H "Content-Type: application/json" \
    -d "{\"email\":\"$EPOSTA\",\"password\":\"$SIFRE_JSON\",\"email_confirm\":true}" < /dev/null)"
  KOD="$(echo "$YANIT" | tail -n1)"
  unset SIFRE SIFRE2 SIFRE_JSON SERVIS
  if [ "$KOD" != "200" ] && [ "$KOD" != "201" ]; then
    echo "Hesap açılamadı (HTTP $KOD): $(echo "$YANIT" | head -n -1 | head -c 300)"
    exit 1
  fi
  KISI="$(sorgu "select id from auth.users where lower(email) = '$EPOSTA'")"
  if [ -z "$KISI" ]; then echo "Hesap açıldı ama veritabanında bulunamadı."; exit 1; fi
  echo "Hesap açıldı."
fi

if [ "$(sorgu "select coalesce(is_anonymous, false) from auth.users where id = '$KISI'")" = "t" ]; then
  echo "Bu hesap geçici (anonim); yönetici yapılamaz."
  exit 1
fi

sorgu "update public.profiles set is_admin = true where id = '$KISI'" > /dev/null
if [ "$(sorgu "select is_admin from public.profiles where id = '$KISI'")" != "t" ]; then
  echo "Profil bulunamadı ya da yetki verilemedi (kişi: $KISI)."
  exit 1
fi

echo ""
echo "Tamam: $EPOSTA artık yönetici."
echo "Giriş: https://lykiva.ismailtopcam.dev/admin"
echo "Not: web uygulamasında SUPABASE_ANON_KEY ortam değişkeni tanımlı olmalı ve e-postayla giriş açık olmalı (node scripts/sunucu-kontrol.mjs)."
