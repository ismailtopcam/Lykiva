#!/bin/sh
# Uygulama anahtarı boş ya da kısaysa kapı açılmaz. Boş anahtarla şablondaki map, başlıksız her isteği kabul ederdi.
set -eu
anahtar="${LYKIVA_UYGULAMA_ANAHTARI:-}"
if [ "${#anahtar}" -lt 24 ]; then
  echo "HATA: LYKIVA_UYGULAMA_ANAHTARI boş ya da 24 karakterden kısa; kapı açılmıyor (Coolify > lykiva-altyapi > Environment Variables)" >&2
  exit 1
fi
case "$anahtar" in
  *[!A-Za-z0-9_-]*)
    echo "HATA: LYKIVA_UYGULAMA_ANAHTARI yalnızca harf, rakam, - ve _ içermeli" >&2
    exit 1
    ;;
esac
