# Passation SI-TCHA AI

Dernière mise à jour : 16 septembre 2026 (Africa/Douala).

Ce fichier est la source de reprise rapide pour une nouvelle discussion Codex. Lire aussi `docs/EXPLOITATION.md` uniquement lorsqu'un déploiement ou une configuration de production est demandé.

## 1. Référence du projet

| Élément | Valeur |
|---|---|
| Dépôt officiel | `https://github.com/si-tcha/Si-tcha-AI.git` |
| Branche livrable de Jimmy | `elsonkjimmy` |
| HEAD livré | `5aa8ef6124d5a8ed037d210d6ed50465fc56968e` |
| Workspace | `/home/qwerty/PROJETS/si-tcha-ai-mobile` |
| Application Android | `com.sitcha.sitchamobile` |
| Téléphone de test | TECNO KM5, Android 15, ADB `14413155CP015543` |
| Stratégie fonctionnelle actuelle | Paiement en espèces à la remise/livraison ; aucun paiement en ligne simulé |

La branche `elsonkjimmy` est la branche de référence. Ne pas prendre une autre branche comme vérité sans audit et décision explicite de Jimmy.

## 2. État des livrables

| Domaine | État | Preuve / remarque |
|---|---:|---|
| Parcours acheteur | Validé | Catalogue réel, recherche, panier persistant, commande cash idempotente, commandes et bordereau |
| QR de commande | Corrigé | Génération locale/offline, vérifiée sur téléphone |
| Authentification vendeur | Corrigée | Jeton vendeur persisté et envoyé sur les routes privées ; persiste après `force-stop` |
| Profil GIC | Validé | Identité et informations serveur affichées |
| Journal de croissance | Validé | Création, modification et persistance d'une parcelle |
| Accès au journal | Corrigé | Bouton « Journal de croissance » ajouté dans Terrain SIG |
| B2B | Validé | Création et persistance d'une offre après relance |
| Agronome IA réel | En attente externe | Gestion d'erreur validée, mais aucune réponse Gemini réelle sans `GEMINI_API_KEY` |
| OTP par SMS réel | En attente externe | Fournisseur et identifiants commerciaux non fournis |
| Paiement en ligne | Hors périmètre actuel | Le produit utilise explicitement le cash à la livraison |
| Nouveau backend Heroku | À faire | Tester puis déployer le backend actuel et sa base/migrations ; ne pas réutiliser aveuglément l'ancien déploiement |

## 3. Derniers commits importants

| Commit | Objet |
|---|---|
| `5aa8ef6` | Exposer la navigation vers le Journal de croissance |
| `e903d6e` | Persister les sessions vendeur pour les requêtes protégées |
| `77acaf2` | Générer les QR acheteur hors ligne |
| `5042c27` | Débloquer la commande acheteur sur installations mises à niveau |
| `56c6875` | Permettre les APK de test LAN via GitHub Actions |
| `493cc81` | Aligner la migration Bloc 4 sur le schéma BigInt canonique |

## 4. Validation obtenue au HEAD `5aa8ef6`

| Contrôle | Résultat |
|---|---:|
| Tests frontend | 254 réussis sur 254 |
| TypeScript frontend | Réussi |
| Tests backend standards | 188 réussis, 1 test PostgreSQL facultatif ignoré |
| TypeScript backend | Réussi |
| `git diff --check` | Réussi |
| Frontend CI GitHub | Réussi — run `34775905761` |
| Backend CI GitHub | Réussi — run `34775905810` |
| Build Android APK | Réussi — run `34775961195` |

APK : <https://github.com/si-tcha/Si-tcha-AI/actions/runs/34775961195>

Le build APK embarque l'URL de test LAN `http://172.20.10.3:4000/api`. Il ne fonctionnera contre ce backend local que si le téléphone peut joindre cette adresse et si le backend y est lancé.

## 5. Données de test locales créées

| Type | Valeur |
|---|---|
| GIC local | `GIC Agro-Vallée Bafoussam` |
| Leader local | `Mlk`, téléphone `+237695715021` |
| Statut | Activé manuellement dans PostgreSQL local uniquement |
| Parcelle | `ParcelleTest1309`, Tomates, stade `Levée`, 2 500 kg |
| Offre B2B | `MotopompeTest1309`, location, 5 000 FCFA/jour |

Le PIN n'est pas connu de Codex. Ne jamais déconnecter le compte de test sans accord de Jimmy ou sans disposer de ses identifiants.

## 6. Prochaine roadmap

| Priorité | Action | Critère de fin |
|---:|---|---|
| P0 | Télécharger puis installer l'APK du run `34775961195` sur le téléphone connecté | APK installée et ouverte sans erreur |
| P0 | Rejouer un smoke test sur l'APK autonome | Connexion/session, acheteur, profil GIC, journal, B2B et QR fonctionnent sans Metro |
| P0 | Préparer et déployer le backend actuel sur Heroku | Health/readiness verts, migrations appliquées, application mobile connectée à l'URL publique |
| P1 | Configurer le fournisseur SMS OTP réel | Un vrai téléphone reçoit et valide l'OTP ; aucun OTP n'est exposé dans les logs de production |
| P1 | Configurer `GEMINI_API_KEY` | Une consultation agronomique réelle réussit et persiste |
| P1 | Refaire un APK avec l'URL Heroku HTTPS | L'APK fonctionne hors réseau LAN |
| P2 | Tester l'évaluation acheteur | Disposer d'une commande `livré/terminé`, noter de 1 à 5 et vérifier les validations |
| P2 | Décider si un paiement numérique est réellement requis | Conserver le cash ou intégrer un prestataire après décision produit |

## 7. Reprise opérationnelle

```bash
cd /home/qwerty/PROJETS/si-tcha-ai-mobile
git branch --show-current
git status --short
git log -5 --oneline
```

Avant tout changement, vérifier que la branche est `elsonkjimmy`. Préserver les fichiers non suivis préexistants : `failed_log.txt`, `full_log.txt`, `gh_log.txt` et `test-prisma.js`.

Pour installer une APK téléchargée :

```bash
adb devices
unzip -l /chemin/vers/SI-TCHA-AI-Internal-Test-Debug-APK.zip
adb -s 14413155CP015543 install -r /chemin/vers/app-debug.apk
```

Ne pas pousser, déployer, modifier une base distante ou supprimer des fichiers sans demande explicite de Jimmy.

## 8. Prompt minimal pour une nouvelle discussion

> Nous continuons le projet SI-TCHA AI dans `/home/qwerty/PROJETS/si-tcha-ai-mobile`. Lis intégralement `docs/HANDOFF.md`, vérifie l'état Git sans modifier les fichiers, puis reprends à la première action P0 non terminée. La branche livrable est `elsonkjimmy`. Signale toute divergence entre le fichier et l'état réel avant d'agir.
