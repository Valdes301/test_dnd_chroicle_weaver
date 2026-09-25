# ==========================================
# Fase 1: Dipendenze (con supporto prebuilt glibc per AMD64 e ARM64 / RPi)
# ==========================================
FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copia i file di dipendenza e installa in modo pulito e deterministico
# Con Debian (glibc), better-sqlite3 scarica istantaneamente i binari precompilati per ARM64/AMD64 evitando la compilazione C++ sotto QEMU
COPY package.json package-lock.json ./
RUN npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps

# ==========================================
# Fase 2: Build dell'applicazione Next.js
# ==========================================
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BUILD_STANDALONE=true

RUN npm run build

# ==========================================
# Fase 3: Runner di produzione (Ottimizzato per RPi 4 / ARM64 e x86)
# ==========================================
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# dumb-init per gestione sicura dei segnali PID 1 e curl per healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Crea un utente di sistema non-root
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs nextjs

# Crea e assegna i permessi alle directory persistenti prima del cambio utente
RUN mkdir -p /app/data /app/data/assets && \
    chown -R nextjs:nodejs /app/data

# Copia gli asset statici e il pacchetto standalone generato da Next.js
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Avvio con dumb-init per arresto e riavvio immediato senza zombie process
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]


