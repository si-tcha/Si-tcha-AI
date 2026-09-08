#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SI-TCHA AI - Script de Validation Non Destructif de Préparation Production
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "🚀 Démarrage de la suite de validation de production SI-TCHA AI"
echo "📂 Répertoire racine: $ROOT_DIR"
echo ""

# Configuration d'un dossier temporaire dédié et d'un trap borné
TMP_DIR=$(mktemp -d -t sitcha-val-XXXXXX)
cleanup() {
  local exit_code=$?
  if [ -n "${TMP_DIR:-}" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

# Sauvegarde de l'état Git avant exécution pour vérification de non-régression / non-destruction
GIT_STATUS_BEFORE=$(git status --porcelain)

# 1. Vérification Backend
echo "=================================================="
echo "🔧 [1/4] Validation Backend"
echo "=================================================="
cd "$ROOT_DIR/backend"

echo "➤ Validation du schéma Prisma..."
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

# 2. Vérification Frontend
echo "=================================================="
echo "📱 [2/4] Validation Frontend (Expo SDK 56)"
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

# 3. Vérification de l'absence de secrets et fichiers indexés
echo "=================================================="
echo "🔒 [3/4] Audit Sécurité des Fichiers Indexés"
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

# 4. Vérification de non-altération du dépôt
echo "=================================================="
echo "🛡️ [4/4] Vérification d'Intégrité et Non-Destruction"
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
