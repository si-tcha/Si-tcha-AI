# Passation opérationnelle — SI-TCHA AI

Dernière mise à jour : 28 septembre 2026 (Africa/Douala).

Ce document permet de reprendre le projet sans dépendre d'une discussion antérieure. Vérifier l'état Git avant toute action et ne jamais considérer un compte, une clé API ou une base distante comme acquis.

## 1. Référence officielle

| Élément | Valeur |
|---|---|
| Dépôt | `https://github.com/si-tcha/Si-tcha-AI.git` |
| Branche officielle livrable | `main` |
| HEAD officiel à cette date | `7c1c0e8` — fusion de la PR SMS #9 |
| Ancienne branche locale Jimmy | `elsonkjimmy`, en retard de 19 commits sur `main` le 28/09/2026 ; ne pas l'utiliser pour livrer |
| Application Android | `com.sitcha.sitchamobile` |
| API publique attendue | `https://si-tcha-ai.onrender.com/api` |
| Paiement | Commande et règlement en espèces à la remise/livraison ; pas de paiement en ligne |

Ne pas committer de secrets, de sauvegardes de base, de PIN ou de numéros de téléphone personnels. Les fichiers locaux non suivis `failed_log.txt`, `full_log.txt`, `gh_log.txt` et `test-prisma.js` appartiennent au workspace historique et doivent être préservés.

## 2. Ce qui est livré et vérifié

| Domaine | État | Notes |
|---|---:|---|
| Acheteur | Validé sur appareil | Catalogue distant consolidé, recherche/filtres, panier persistant, commande cash idempotente, historique et bordereau QR. L'évaluation nécessite encore une commande livrée/terminée. |
| Vendeur/GIC | Validé sur appareil | Session persistante, profil GIC, Terrain SIG, journal de croissance et B2B accessibles. |
| Parcelles | Validé sur appareil | Création, modification de stade et persistance contrôlées. |
| Formulaires Android | Corrigé | PR #8 : stabilisation du clavier/modales et protection contre les doubles soumissions ; APK autonome de contrôle réussie au run 36092714794. |
| APK Android autonome | Disponible | Workflow GitHub Actions construit une APK `assembleRelease` avec bundle JS embarqué. Elle dépend d'Internet pour joindre l'API Render, mais jamais de Metro, du PC ou du même Wi-Fi. |
| Base distante | Réconciliée | Réconciliation et consolidation déjà exécutées ; les migrations Prisma standard sont cohérentes. Ne pas relancer un script de réconciliation ni `db push` contre cette base. |
| Backend CI | Vert | PR #9 / commit 2ff3688 : deux contrôles Backend CI réussis avant fusion. |
| OTP LeTexto | Intégré, non activé | Adaptateur et tests présents dans `main`, mais aucune clé LeTexto ne doit être ajoutée dans Git. |
| Agronome IA Gemini | Limite externe | L'interface gère l'échec ; une réponse réelle attend `GEMINI_API_KEY` et des crédits valides. |

## 3. Déploiement et APK

### Backend Render

Le service Render doit employer le code de `main`, Node 22 et la commande de démarrage fondée sur les migrations Prisma suivies. Ne pas utiliser `prisma db push` en production : cette commande a déjà bloqué un déploiement à cause d'un avertissement de contrainte unique.

Avant tout déploiement, vérifier en lecture seule :

```bash
cd backend
npx prisma migrate status
```

Puis appliquer seulement la procédure de déploiement documentée dans `docs/EXPLOITATION.md`. Toute écriture dans la base distante, tout changement de `DATABASE_URL` ou toute migration nécessite une sauvegarde et une autorisation explicite.

### APK autonome

Dans GitHub Actions, lancer **Build Android APK** manuellement et saisir exactement l'URL HTTPS publique incluant `/api` :

```text
https://si-tcha-ai.onrender.com/api
```

Télécharger l'artefact `SI-TCHA-AI-Standalone-Release-APK`, extraire l'APK, puis installer :

```bash
adb devices
adb -s <DEVICE_ID> install -r /chemin/vers/app-release.apk
```

Le workflow valide l'URL et refuse une URL locale ou privée. L'APK est autonome ; elle a néanmoins besoin d'une connexion Internet normale pour appeler Render.

## 4. Activation SMS LeTexto (P0)

La PR #9 a ajouté `OTP_PROVIDER=letexto` et l'adaptateur LeTexto sans clé versionnée. Pour l'activer dans Render, le propriétaire du compte LeTexto doit renseigner uniquement dans les variables d'environnement privées :

```text
OTP_PROVIDER=letexto
LETEXTO_API_KEY=<clé secrète fournie par LeTexto>
LETEXTO_SENDER_ID=<expéditeur réellement approuvé par LeTexto>
# LETEXTO_API_URL=https://apis.letexto.com   (facultatif : valeur par défaut)
```

Ne jamais partager `LETEXTO_API_KEY` dans un chat, un commit, une capture ou un fichier `.env.example`.

Après redéploiement :

1. Vérifier `GET /api/health/ready`.
2. Inscrire un numéro de test volontaire.
3. Vérifier la réception, l'expiration et la validation de l'OTP.
4. Supprimer le compte de test seulement si la politique produit le permet.

L'OTP existe pour l'inscription et le renvoi de code. La connexion des comptes déjà vérifiés ne nécessite pas un nouvel OTP.

## 5. Travail encore en attente

| Priorité | Responsable / dépendance | Critère de fin |
|---:|---|---|
| P0 | Render + titulaire LeTexto | Un vrai OTP est reçu et validé en production, sans exposition de la clé. |
| P1 | Collaboratrice, branche `service-sms` | Livraison de son bloc météo/AgroMonitoring/marché. Ne pas fusionner directement : cette branche doit être auditée et portée sélectivement dans `main`. |
| P1 | Équipe produit | Définir consentement SMS, préférences agriculteur, ciblage par GIC/culture, anti-doublon, limite quotidienne et historique de livraison avant toute alerte météo ou marché en masse. |
| P1 | Clé/solde Gemini | Réponse agronome réelle et persistance contrôlée. |
| P2 | Test métier | Mettre une commande en état livré/terminé puis tester la notation 1–5 et le commentaire. |
| P2 | Décision produit | Décider ultérieurement si un paiement numérique est exigé ; le cash est le comportement actuel validé. |

Les fichiers `backend/src/jobs/marketSms.cron.ts` et `backend/src/jobs/agroMonitoring.cron.ts` constituent seulement une ébauche. Ne pas les activer en production sans le P1 ci-dessus : sinon ils peuvent envoyer des SMS non désirés ou en double.

## 6. Reprise sûre

```bash
cd /home/qwerty/PROJETS/si-tcha-ai-mobile
git fetch origin --prune
git switch main
git pull --ff-only
git status --short
git log -5 --oneline
```

Avant un changement :

- consulter les tests ciblés et lancer ceux concernés ;
- créer une branche dédiée depuis `main` ;
- ouvrir une PR, attendre les CI, puis fusionner ;
- ne jamais faire `git reset --hard`, `prisma db push`, `migrate dev`, ou une opération SQL distante sans validation explicite.

## 7. Prompt de reprise minimal

> Nous reprenons SI-TCHA AI dans `/home/qwerty/PROJETS/si-tcha-ai-mobile`. Lis intégralement `docs/HANDOFF.md`. La référence de livraison est `origin/main`, pas l'ancienne branche locale `elsonkjimmy`. Vérifie l'état Git en lecture seule, préserve les fichiers non suivis, puis propose la prochaine action P0 sans jamais afficher de secret ni modifier Render, GitHub ou PostgreSQL sans accord explicite.
