# Lykiva — 3B kart video servisi (başsız Chromium + MapLibre + ffmpeg). Ayrıntı: altyapi/kart-video/README.md
# Playwright imajı Chromium'u ve bağımlılıklarını içerir; sürüm package.json'daki playwright ile aynı olmalı.
FROM mcr.microsoft.com/playwright:v1.65.1-noble

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-noto-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /uygulama
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
COPY sahne ./sahne

ENV NODE_ENV=production \
  PORT=8080 \
  KV_GL=swiftshader \
  KV_CIKTI=/tmp/kart-video

USER pwuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/saglik').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/sunucu.js"]
