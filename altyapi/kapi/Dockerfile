# Lykiva — BRouter ve Photon'un önündeki kapı (uygulama anahtarı + IP başına istek sınırı). Ayrıntı: altyapi/README.md
FROM nginx:1.27-alpine

# Şablon /etc/nginx/conf.d/default.conf olarak doldurulur (imajın varsayılanının yerine)
COPY varsayilan.conf.template /etc/nginx/templates/default.conf.template
# Şablon adımından (20-...) önce çalışır; anahtar yoksa konteyner açılmaz
COPY 05-anahtar-denetle.sh /docker-entrypoint.d/05-anahtar-denetle.sh
RUN chmod +x /docker-entrypoint.d/05-anahtar-denetle.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/saglik || exit 1
