# Multi-stage build pour le backend SI-TCHA AI
# Node.js 22 LTS
FROM node:22-alpine AS base

WORKDIR /usr/src/app

# Dépendances système requises pour Prisma sur Alpine
RUN apk add --no-cache openssl libc6-compat

# ─── Étape 1 : Installation des dépendances complètes et build ───
FROM base AS build

# Copie des manifestes de dépendances et du schéma Prisma
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Installation déterministe
RUN npm ci

# Génération du client Prisma
RUN npx prisma generate

# Copie du code source et de la configuration TypeScript
COPY tsconfig.json ./
COPY src ./src/

# Compilation TypeScript
RUN npm run build

# ─── Étape 2 : Dépendances de production seules ───
FROM base AS prod-deps

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

# ─── Étape 3 : Image finale d'exécution minimale et durcie ───
FROM base AS final

ENV NODE_ENV=production
ENV PORT=4000

# Utiliser l'utilisateur système non-root 'node'
USER node

WORKDIR /usr/src/app

# Copie des artefacts indispensables avec les permissions de l'utilisateur node
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node prisma ./prisma

EXPOSE 4000

# Healthcheck de processus via l'endpoint /api/health (Node 22 fetch natif)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
