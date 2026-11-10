#!/usr/bin/env bash
# Lykiva — yönetim paneli için yönetici hesabı aç ya da var olan hesaba yönetici yetkisi ver.
#
# Coolify > Terminal > "uygulama" sunucusunda (şifre soracağı için önce indirip sonra çalıştır):
#   curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/yonetici.sh -o /tmp/yonetici.sh && bash /tmp/yonetici.sh
#
# - E-posta sorar. Bu e-postayla hesap yoksa şifre sorar ve hesabı (e-postası onaylı) açar.
# - Hesap zaten varsa (ör. Google ile açılmış, şifresi yok ya da şifre unutuldu) yeni şifre belirlemeyi önerir.
# - Sonra hesaba yönetici yetkisi verir (profiles.is_admin = true).
# - Hesap açmak / şifre belirlemek için Supabase servis anahtarı gerekir; betik onu Kong konteynerinden okur.
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

# Şifreyi iki kez sorar; SIFRE_JSON'a JSON içinde kullanılabilir (kaçışlanmış) hâlini yazar
sifre_sor() {
  local s1 s2
  read -rsp "Şifre (en az 12 karakter): " s1; echo
  read -rsp "Şifre (tekrar): " s2; echo
  if [ "$s1" != "$s2" ]; then echo "Şifreler aynı değil."; exit 1; fi
  if [ "${#s1}" -lt 12 ]; then echo "Şifre en az 12 karakter olmalı."; exit 1; fi
  # JSON için şifredeki \ ve " kaçışlanır. Desen ve yerine konan metin tırnak içinde: bash sürümünden
  # bağımsız olarak harfi harfine işlenir (tırnaksız \\ yazımı bash 5.2'de farklı yorumlanıyor)
  local bs='\' q='"'
  SIFRE_JSON="${s1//"$bs"/"$bs$bs"}"
  SIFRE_JSON="${SIFRE_JSON//"$q"/"$bs$q"}"
  # Denetim karakterleri (sekme vb.) JSON'u bozar
  if [[ "$s1" =~ [[:cntrl:]] ]]; then echo "Şifrede sekme gibi görünmeyen karakter olmamalı."; exit 1; fi
}

servis_anahtari() {
  SERVIS="${LYKIVA_SERVICE_KEY:-$(docker exec "$KONG" printenv SUPABASE_SERVICE_KEY < /dev/null 2>/dev/null || true)}"
  if [ -z "$SERVIS" ]; then
    echo "Servis anahtarı okunamadı ($KONG)."
    echo "Coolify > lykiva-supabase > Environment Variables > SERVICE_SUPABASESERVICE_KEY değeriyle:"
    echo "  LYKIVA_SERVICE_KEY=... bash /tmp/yonetici.sh"
    exit 1
  fi
}

# Supabase Auth yönetim API'si: $1 yöntem, $2 yol, $3 JSON gövde → YANIT (gövde + son satırda HTTP kodu), KOD
auth_api() {
  YANIT="$(curl -sS -w '\n%{http_code}' -X "$1" "$URL/auth/v1/admin/$2" \
    -H "apikey: $SERVIS" -H "Authorization: Bearer $SERVIS" -H "Content-Type: application/json" \
    -d "$3" < /dev/null)"
  KOD="$(echo "$YANIT" | tail -n1)"
}

KISI="$(sorgu "select id from auth.users where lower(email) = '$EPOSTA'")"

if [ -z "$KISI" ]; then
  echo "Bu e-postayla hesap yok; yeni hesap açılacak."
  sifre_sor
  servis_anahtari
  auth_api POST users "{\"email\":\"$EPOSTA\",\"password\":\"$SIFRE_JSON\",\"email_confirm\":true}"
  unset SIFRE_JSON SERVIS
  if [ "$KOD" != "200" ] && [ "$KOD" != "201" ]; then
    echo "Hesap açılamadı (HTTP $KOD): $(echo "$YANIT" | head -n -1 | head -c 300)"
    exit 1
  fi
  KISI="$(sorgu "select id from auth.users where lower(email) = '$EPOSTA'")"
  if [ -z "$KISI" ]; then echo "Hesap açıldı ama veritabanında bulunamadı."; exit 1; fi
  echo "Hesap açıldı."
else
  SAGLAYICI="$(sorgu "select coalesce(raw_app_meta_data ->> 'providers', raw_app_meta_data ->> 'provider', '?') from auth.users where id = '$KISI'")"
  SIFRELI="$(sorgu "select coalesce(encrypted_password, '') <> '' from auth.users where id = '$KISI'")"
  if [ "$SIFRELI" = "t" ]; then DURUM="şifresi var"; else DURUM="şifresi YOK"; fi
  echo "Bu e-postayla hesap var (giriş yöntemi: $SAGLAYICI; $DURUM)."
  read -rp "Bu hesaba yeni şifre belirlensin mi? Panele şifreyle girilir. [e/H]: " CEVAP
  if [[ "$CEVAP" =~ ^[eEyY] ]]; then
    sifre_sor
    servis_anahtari
    auth_api PUT "users/$KISI" "{\"password\":\"$SIFRE_JSON\",\"email_confirm\":true}"
    unset SIFRE_JSON SERVIS
    if [ "$KOD" != "200" ]; then
      echo "Şifre belirlenemedi (HTTP $KOD): $(echo "$YANIT" | head -n -1 | head -c 300)"
      exit 1
    fi
    echo "Şifre belirlendi."
  fi
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
