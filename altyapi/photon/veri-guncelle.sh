#!/bin/sh
# Photon Türkiye verisini indirip yeni bir klasöre içe aktarır, bitince eskisinin yerine koyar.
# Photon belgesine göre veritabanı yerinde güncellenmez (bozulur); bu yüzden iki kat disk gerekir.
#   veri-guncelle.sh            içe aktarır; yeni veriyi kullanmak için konteyneri yeniden başlat
#
# Kaynak değiştirilebilir: PHOTON_DOKUM="https://download1.graphhopper.com/public/europe/turkey/photon-dump-turkey-1.0-latest.jsonl.zst"
# Diller: PHOTON_DILLER="tr,en" (aramada ve sonuçlarda kullanılabilecek diller)
set -eu

DOKUM="${PHOTON_DOKUM:-https://download1.graphhopper.com/public/europe/turkey/photon-dump-turkey-1.0-latest.jsonl.zst}"
DILLER="${PHOTON_DILLER:-tr,en}"
YENI=/veri/yeni

rm -rf "$YENI"
mkdir -p "$YENI"
echo "döküm indiriliyor ve içe aktarılıyor: $DOKUM"
curl -fsSL --retry 3 "$DOKUM" | zstd -dc | java -Xmx"${PHOTON_BELLEK:-2g}" -jar /photon/photon.jar import -data-dir "$YENI" -languages "$DILLER" -import-file -

if [ ! -d "$YENI/photon_data" ]; then
  echo "HATA: içe aktarma veritabanı üretmedi"
  exit 1
fi

# Yer değiştir: eskisini kenara al, yenisini koy, eskisini sil
if [ -d /veri/photon_data ]; then mv /veri/photon_data /veri/eski_photon_data; fi
mv "$YENI/photon_data" /veri/photon_data
rm -rf /veri/eski_photon_data "$YENI"
echo "Photon verisi hazır: $(du -sh /veri/photon_data | cut -f1)"
