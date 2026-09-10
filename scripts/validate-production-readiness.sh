#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SI-TCHA AI - Script de Validation Non Destructif de Préparation Production
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "🚀 Démarrage de la suite de validation de production SI-TCHA AI"
echo "📂 Répertoire racine: $ROOT_DIR"
echo ""

# Configuration d'un dossier temporaire dédié et conteneur PostgreSQL éphémère
TMP_DIR=$(mktemp -d -t sitcha-val-XXXXXX)
POSTGRES_CONTAINER="sitcha-postgres-val-$$"

cleanup() {
  local exit_code=$?
  echo ""
  echo "🧹 Nettoyage des ressources éphémères..."
  if [ -n "${POSTGRES_CONTAINER:-}" ]; then
    echo "  → Arrêt et suppression du conteneur PostgreSQL éphémère ($POSTGRES_CONTAINER)..."
    docker rm -f "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [ -n "${TMP_DIR:-}" ] && [ -d "$TMP_DIR" ]; then
    echo "  → Suppression du répertoire temporaire de validation ($TMP_DIR)..."
    rm -rf "$TMP_DIR"
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

# Sauvegarde de l'état Git avant exécution pour vérification de non-régression / non-destruction
GIT_STATUS_BEFORE=$(git status --porcelain)

# 1. Vérification Backend
echo "=================================================="
echo "🔧 [1/5] Validation Backend & Tests"
echo "=================================================="
cd "$ROOT_DIR/backend"

echo "➤ Validation syntaxique du schéma Prisma..."
npx prisma validate

echo "➤ Vérification de la compilation TypeScript Backend..."
npx tsc --noEmit

echo "➤ Exécution des tests automatisés Backend..."
npm test

echo "➤ Test de build de production Backend (vers dossier temporaire)..."
mkdir -p "$TMP_DIR/backend-dist"
npx tsc --outDir "$TMP_DIR/backend-dist"

echo "✅ Validation Backend réussie avec succès !"
echo ""

# 2. Base de Données Éphémère & Audit de Schéma / Drift Prisma
echo "=================================================="
echo "🐘 [2/5] Base PostgreSQL Éphémère & Audit Drift Prisma"
echo "=================================================="
cd "$ROOT_DIR/backend"

# Recherche d'un port disponible pour le conteneur jetable
POSTGRES_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("", 0)); print(s.getsockname()[1]); s.close()')
echo "➤ Démarrage de l'instance PostgreSQL éphémère isolée (port hôte: $POSTGRES_PORT)..."

docker run -d \
  --name "$POSTGRES_CONTAINER" \
  -e POSTGRES_USER=sitcha_val_user \
  -e POSTGRES_PASSWORD=sitcha_val_password \
  -e POSTGRES_DB=sitcha_val_db \
  -p "$POSTGRES_PORT:5432" \
  postgres:16-alpine >/dev/null

echo "➤ Attente de la disponibilité de PostgreSQL..."
docker exec "$POSTGRES_CONTAINER" sh -c 'until pg_isready -U sitcha_val_user -d sitcha_val_db; do sleep 0.5; done'

VAL_DB_URL="postgresql://sitcha_val_user:sitcha_val_password@localhost:$POSTGRES_PORT/sitcha_val_db?schema=public"

echo "➤ Application des migrations Prisma existantes (prisma migrate deploy)..."
DATABASE_URL="$VAL_DB_URL" npx prisma migrate deploy

echo "➤ Vérification de l'état des migrations (prisma migrate status)..."
DATABASE_URL="$VAL_DB_URL" npx prisma migrate status

echo "➤ Contrôle strict de dérive de schéma (drift) via prisma migrate diff --exit-code..."
if ! DATABASE_URL="$VAL_DB_URL" npx prisma migrate diff --exit-code --from-config-datasource --to-schema ./prisma/schema.prisma; then
  echo ""
  echo "❌ ÉCHEC DU CONTRÔLE DE DRIFT PRISMA (code de sortie 2) :"
  echo "Une divergence (drift) existe entre les migrations déployées et prisma/schema.prisma."
  echo "Ce blocage est hérité du schéma non réconcilié du Bloc 3."
  echo "Conformément aux directives, le Bloc 5 ne modifie pas le schéma métier et s'arrête en échec."
  exit 2
fi

echo "✅ Schéma Prisma parfaitement synchronisé sans dérive !"
echo ""

# 3. Vérification Frontend
echo "=================================================="
echo "📱 [3/5] Validation Frontend (Expo SDK 56)"
echo "=================================================="
cd "$ROOT_DIR/frontend"

echo "➤ Vérification de la compilation TypeScript Frontend..."
npx tsc --noEmit

echo "➤ Analyse statique ESLint..."
npm run lint

echo "➤ Diagnostic Expo Doctor (SDK 56)..."
npm run doctor

echo "➤ Exécution des tests automatisés Frontend..."
npm test

echo "➤ Test d'exportation Web (vers dossier temporaire)..."
mkdir -p "$TMP_DIR/web-dist"
npx expo export --platform web --output-dir "$TMP_DIR/web-dist"

echo "➤ Test d'exportation Android Hermes Bytecode (vers dossier temporaire)..."
mkdir -p "$TMP_DIR/android-dist"
npx expo export --platform android --output-dir "$TMP_DIR/android-dist"

echo "✅ Validation Frontend réussie avec succès !"
echo ""

# 4. Audit Sécurité, Fichiers Indexés & Docker
echo "=================================================="
echo "🔒 [4/5] Audit Sécurité & Fichiers Docker"
echo "=================================================="
cd "$ROOT_DIR"

echo "➤ Vérification de l'absence de fichiers .env réels suivis par git..."
TRACKED_ENVS=$(git ls-files | grep -E "\.env(\.|$)" | grep -v "\.env\.example" || true)
if [ -n "$TRACKED_ENVS" ]; then
  echo "❌ ERREUR: Des fichiers d'environnement réels sont suivis par Git:"
  echo "$TRACKED_ENVS"
  exit 1
fi
echo "✓ Aucun fichier .env réel n'est suivi par Git."

echo "➤ Vérification de l'absence d'artefacts de build indexés..."
TRACKED_BUILDS=$(git ls-files | grep -E "(^|/)(dist|build|\.apk|\.aab)/" || true)
if [ -n "$TRACKED_BUILDS" ]; then
  echo "❌ ERREUR: Des artefacts de compilation sont suivis par Git:"
  echo "$TRACKED_BUILDS"
  exit 1
fi
echo "✓ Aucun artefact de build n'est indexé."

echo "➤ Vérification de la configuration Docker Compose Développement (backend/compose.dev.yaml)..."
docker compose -f backend/compose.dev.yaml config >/dev/null
echo "✓ backend/compose.dev.yaml valide."

echo "➤ Vérification de la configuration Docker Compose Production Durci (backend/compose.yaml)..."
POSTGRES_PASSWORD=val_password \
JWT_SECRET=val_jwt_secret_min_32_characters_key \
CORS_ORIGIN=https://sitcha.app \
docker compose -f backend/compose.yaml config >/dev/null
echo "✓ backend/compose.yaml valide (variables obligatoires appliquées)."

echo "➤ Vérification du build Dockerfile..."
docker build --check backend >/dev/null
echo "✓ Dockerfile backend syntaxiquement et structurellement valide."

# 5. Vérification de non-altération du dépôt
echo "=================================================="
echo "🛡️ [5/5] Vérification d'Intégrité et Non-Destruction"
echo "=================================================="
GIT_STATUS_AFTER=$(git status --porcelain)

if [ "$GIT_STATUS_BEFORE" != "$GIT_STATUS_AFTER" ]; then
  echo "❌ ERREUR: L'exécution du script a altéré le dépôt (fichiers créés, modifiés ou supprimés) !"
  diff -u <(echo "$GIT_STATUS_BEFORE") <(echo "$GIT_STATUS_AFTER") || true
  exit 1
fi
echo "✓ Intégrité parfaite : aucun fichier suivi ou non-suivi n'a été altéré ou supprimé."
echo ""

echo "=================================================="
echo "🎉 Toutes les validations de production sont au VERT !"
echo "=================================================="
