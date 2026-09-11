# Multi-stage build durci pour le backend SI-TCHA AI
# Node.js 22 LTS Alpine avec isolation stricte des dépendances

# ─── Stage 1 : Base système commune ───
FROM node:22-alpine AS base

WORKDIR /usr/src/app

# Dépendances système requises pour Prisma sur Alpine
RUN apk add --no-cache openssl libc6-compat

# ─── Stage 2 : Build complet & compilation TypeScript ───
FROM base AS build

# Manifestes et configuration Prisma
COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Installation complète pour le build (avec devDependencies)
RUN npm ci

# Génération du client Prisma
RUN npx prisma generate

# Sources et configuration TypeScript
COPY tsconfig.json ./
COPY src ./src/

# Compilation TypeScript
RUN npm run build

# ─── Stage 3 : Dépendances de production strictes (sans devDependencies) ───
FROM base AS runtime-deps

COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Installation déterministe réservée au runtime
RUN npm ci --omit=dev

# ─── Stage 4 : Image finale d'exécution minimale et durcie ───
FROM base AS final

ENV NODE_ENV=production
ENV PORT=4000

# Utiliser l'utilisateur système non-root standard 'node'
USER node

WORKDIR /usr/src/app

# Copie des manifestes avec permissions utilisateur node
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma.config.ts ./

# Copie des dépendances de production élaguées depuis le stage runtime-deps
COPY --chown=node:node --from=runtime-deps /usr/src/app/node_modules ./node_modules

# Conservation des artefacts Prisma nécessaires :
# 1. Le client Prisma généré (.prisma)
# 2. La CLI Prisma et binaires associés pour les migrations (npx prisma migrate deploy)
COPY --chown=node:node --from=build /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=build /usr/src/app/node_modules/prisma ./node_modules/prisma
COPY --chown=node:node --from=build /usr/src/app/node_modules/.bin ./node_modules/.bin

# Copie des artefacts compilés JavaScript
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

# Copie du schéma et des migrations Prisma
COPY --chown=node:node prisma ./prisma

EXPOSE 4000

# Healthcheck de préparation via /api/health/ready (Node 22 fetch natif)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
