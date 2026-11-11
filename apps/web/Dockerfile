# Lykiva web (karşılama + admin) — derleme bağlamı: depo kökü
#   docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS deps
WORKDIR /repo
# Önce sadece paket dosyaları: bağımlılık katmanı önbellekte kalsın
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @lykiva/web --include-workspace-root --ignore-scripts --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @lykiva/web

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S lykiva && adduser -S lykiva -G lykiva
COPY --from=build --chown=lykiva:lykiva /repo/apps/web/.next/standalone ./
COPY --from=build --chown=lykiva:lykiva /repo/apps/web/.next/static ./apps/web/.next/static
# Sabit dosyalar (ör. Supabase'in okuduğu e-posta şablonları: /eposta/*.html)
COPY --from=build --chown=lykiva:lykiva /repo/apps/web/public ./apps/web/public
USER lykiva
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
