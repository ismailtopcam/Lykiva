# Lykiva — kendi BRouter sunucumuz (rota çizme: patikaya / yola yapışma)
# Kaynak: https://github.com/abrensch/brouter (MIT). Segmentler: https://brouter.de/brouter/segments4 (OSM, ODbL)
FROM eclipse-temurin:21-jre

ARG BROUTER_SURUM=1.7.10
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip ca-certificates && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL -o /tmp/brouter.zip "https://github.com/abrensch/brouter/releases/download/v${BROUTER_SURUM}/brouter-${BROUTER_SURUM}.zip" \
  && unzip -q /tmp/brouter.zip -d /tmp \
  && mkdir -p /brouter/customprofiles \
  && mv "/tmp/brouter-${BROUTER_SURUM}/brouter-${BROUTER_SURUM}-all.jar" /brouter/brouter.jar \
  && mv "/tmp/brouter-${BROUTER_SURUM}/profiles2" /brouter/profiles2 \
  && rm -rf /tmp/brouter*

COPY baslat.sh segment-guncelle.sh /brouter/
RUN chmod +x /brouter/*.sh

# Segment dosyaları kalıcı birimde (ilk açılışta indirilir, haftalık güncellenebilir)
VOLUME /segments
EXPOSE 17777

# Uygulamanın kullandığı istek: /brouter?lonlats=...&profile=trekking|fastbike|hiking-mountain|mtb&format=geojson
HEALTHCHECK --interval=60s --timeout=20s --start-period=600s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:17777/brouter?lonlats=29.6386,36.2018%7C29.6012,36.2088&profile=trekking&format=geojson" > /dev/null || exit 1

CMD ["/brouter/baslat.sh"]
