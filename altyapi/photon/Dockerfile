# Lykiva — kendi Photon sunucumuz (yer arama)
# Kaynak: https://github.com/komoot/photon (Apache 2.0). Veri: GraphHopper'ın haftalık Türkiye dökümü (OSM, ODbL)
FROM eclipse-temurin:21-jre

ARG PHOTON_SURUM=1.3.0
RUN apt-get update && apt-get install -y --no-install-recommends curl zstd ca-certificates && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /photon \
  && curl -fsSL -o /photon/photon.jar "https://github.com/komoot/photon/releases/download/${PHOTON_SURUM}/photon-${PHOTON_SURUM}.jar"

COPY baslat.sh veri-guncelle.sh /photon/
RUN chmod +x /photon/*.sh

# Veritabanı kalıcı birimde (ilk açılışta indirilip içe aktarılır)
VOLUME /veri
EXPOSE 2322

# Uygulamanın kullandığı istek: /api/?q=...&limit=6[&lat=..&lon=..]
HEALTHCHECK --interval=60s --timeout=20s --start-period=1800s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:2322/api/?q=Ka%C5%9F&limit=1" > /dev/null || exit 1

CMD ["/photon/baslat.sh"]
