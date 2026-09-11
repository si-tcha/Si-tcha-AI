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

# Vérification préliminaire des variables d'environnement obligatoires
if [ -z "${EXPO_PUBLIC_API_URL:-}" ]; then
  echo "❌ ERREUR: La variable EXPO_PUBLIC_API_URL est obligatoire pour valider la préparation production."
  echo "Veuillez la définir avant d'exécuter ce script, par exemple:"
  echo "  EXPO_PUBLIC_API_URL=\"https://<API_HOST>/api\" ./scripts/validate-production-readiness.sh"
  exit 1
fi
node "$ROOT_DIR/scripts/validate-api-url.mjs" "$EXPO_PUBLIC_API_URL" >/dev/null

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

echo "➤ Attente bornée de la disponibilité de PostgreSQL (max 30s)..."
MAX_ATTEMPTS=30
ATTEMPT=1
PG_READY=false

while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
  if docker exec "$POSTGRES_CONTAINER" pg_isready -U sitcha_val_user -d sitcha_val_db >/dev/null 2>&1; then
    PG_READY=true
    break
  fi
  sleep 1
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$PG_READY" != "true" ]; then
  echo ""
  echo "❌ ERREUR TECHNIQUE: PostgreSQL n'est pas devenu disponible après ${MAX_ATTEMPTS} secondes."
  echo "--- Logs du conteneur PostgreSQL ($POSTGRES_CONTAINER) ---"
  docker logs "$POSTGRES_CONTAINER" || true
  echo "---------------------------------------------------------"
  exit 3
fi
echo "✓ PostgreSQL prêt et opérationnel (tentative $ATTEMPT/$MAX_ATTEMPTS)."

VAL_DB_URL="postgresql://sitcha_val_user:sitcha_val_password@localhost:$POSTGRES_PORT/sitcha_val_db?schema=public"

echo "➤ Application des migrations Prisma existantes (prisma migrate deploy)..."
DATABASE_URL="$VAL_DB_URL" npx prisma migrate deploy

echo "➤ Vérification de l'état des migrations (prisma migrate status)..."
DATABASE_URL="$VAL_DB_URL" npx prisma migrate status

echo "➤ Contrôle strict de dérive de schéma (drift) via prisma migrate diff --exit-code..."
set +e
DATABASE_URL="$VAL_DB_URL" npx prisma migrate diff --exit-code --from-config-datasource --to-schema ./prisma/schema.prisma
DIFF_EXIT_CODE=$?
set -e

if [ "$DIFF_EXIT_CODE" -eq 2 ]; then
  echo ""
  echo "❌ ÉCHEC DU CONTRÔLE DE DRIFT PRISMA (code de sortie 2) :"
  echo "Une divergence (drift) existe entre les migrations déployées et prisma/schema.prisma."
  echo "Il s'agit d'un drift historique de la branche de base, dont la réconciliation est prise en charge dans le chantier correctif du Bloc 3."
  echo "Conformément aux directives, le Bloc 5 ne modifie pas le schéma métier et s'arrête en échec."
  exit 2
elif [ "$DIFF_EXIT_CODE" -ne 0 ]; then
  echo ""
  echo "❌ ERREUR TECHNIQUE LORS DU DIFF PRISMA (code de sortie $DIFF_EXIT_CODE) :"
  echo "Une erreur d'outil, de connexion ou de configuration est survenue lors de l'exécution de prisma migrate diff."
  exit "$DIFF_EXIT_CODE"
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

echo "➤ Validation stricte de la variable EXPO_PUBLIC_API_URL fournie..."
if [ -z "${EXPO_PUBLIC_API_URL:-}" ]; then
  echo "❌ ERREUR: La variable EXPO_PUBLIC_API_URL est obligatoire pour valider la préparation production."
  echo "Veuillez la définir avant d'exécuter ce script, par exemple:"
  echo "  EXPO_PUBLIC_API_URL=\"https://<API_HOST>/api\" ./scripts/validate-production-readiness.sh"
  exit 1
fi
node "$ROOT_DIR/scripts/validate-api-url.mjs" "$EXPO_PUBLIC_API_URL" >/dev/null
echo "✓ EXPO_PUBLIC_API_URL validée avec succès."

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
