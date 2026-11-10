#!/bin/sh
# Eksik segmentleri indirir, sonra BRouter sunucusunu başlatır.
set -eu

/brouter/segment-guncelle.sh --eksik

# Bellek ve eşzamanlı istek sayısı ortam değişkeniyle ayarlanır
exec java -Xmx"${BROUTER_BELLEK:-512M}" -DmaxRunningTime="${BROUTER_ZAMAN_ASIMI:-60}" -DuseRFCMimeType=false \
  -cp /brouter/brouter.jar btools.server.RouteServer \
  /segments /brouter/profiles2 /brouter/customprofiles 17777 "${BROUTER_ISLEM:-4}" 0.0.0.0
