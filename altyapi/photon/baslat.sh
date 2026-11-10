#!/bin/sh
# Veritabanı yoksa Türkiye dökümünü indirip içe aktarır, sonra Photon'u başlatır.
set -eu

if [ ! -d /veri/photon_data ]; then
  echo "Photon veritabanı yok; ilk içe aktarma başlıyor (birkaç dakika sürer)"
  /photon/veri-guncelle.sh
fi

exec java -Xmx"${PHOTON_BELLEK:-2g}" -jar /photon/photon.jar serve \
  -data-dir /veri -listen-ip 0.0.0.0 -listen-port 2322 -default-language tr
