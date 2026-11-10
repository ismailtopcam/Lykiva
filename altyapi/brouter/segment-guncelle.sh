#!/bin/sh
# BRouter segmentlerini indirir. brouter.de segmentleri haftalık yeniler.
#   segment-guncelle.sh --eksik   yalnızca olmayanları indir (açılışta)
#   segment-guncelle.sh           hepsini yenile (haftalık; çalışan sunucu yeniden başlatılmadan yeni dosyayı okur)
#
# Varsayılan alan: Türkiye ve çevresi (5°×5° karolar, ad = güneybatı köşesi; toplam ~210 MB, Kasım 2026).
# Değiştirmek için: BROUTER_SEGMENTLER="E25_N35 E30_N35 ..."
set -eu

KAYNAK="${BROUTER_SEGMENT_KAYNAGI:-https://brouter.de/brouter/segments4}"
SEGMENTLER="${BROUTER_SEGMENTLER:-E25_N35 E30_N35 E35_N35 E40_N35 E25_N40 E30_N40 E35_N40 E40_N40}"
mkdir -p /segments

for s in $SEGMENTLER; do
  hedef="/segments/$s.rd5"
  if [ "${1:-}" = "--eksik" ] && [ -s "$hedef" ]; then
    continue
  fi
  echo "segment indiriliyor: $s"
  # Önce geçici dosyaya; tamamlanınca yerine koy (yarım dosya kullanılmasın)
  curl -fsSL --retry 3 -o "$hedef.indiriliyor" "$KAYNAK/$s.rd5"
  mv "$hedef.indiriliyor" "$hedef"
done
echo "segmentler hazır: $(ls /segments/*.rd5 2>/dev/null | wc -l) dosya, $(du -sh /segments | cut -f1)"
