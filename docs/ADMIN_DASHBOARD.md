# Dashboard agent — SI-TCHA AI

## Objectif

Le dashboard web `/admin` est réservé aux agents de l'entreprise. Il permet de créer un GIC et son premier Leader GIC, puis de consulter le nombre de membres approuvés, en attente et rejetés par groupement.

Il ne remplace pas l'application mobile : les producteurs et acheteurs continuent d'utiliser l'APK.

## Workflow

1. L'entreprise crée un compte `Admin` par une procédure interne sécurisée. Il n'existe aucune inscription publique agent.
2. L'agent se connecte sur `/admin/login` avec cet identifiant.
3. Après contrôle de l'identité du responsable, l'agent crée le GIC et son premier leader : bassin, référence, activités, statut de légalisation, nom, téléphone et PIN initial.
4. Le serveur hash le PIN, active le leader et ne renvoie jamais le PIN ni ses hashes dans sa réponse.
5. Le leader se connecte à l'APK et décide des demandes d'adhésion de son seul GIC.
6. L'agriculteur inscrit choisit un GIC existant, valide son OTP et reste `EN_ATTENTE` jusqu'à l'approbation du leader.

## API utilisée

Toutes les routes ci-dessous exigent un JWT de rôle `admin`, sauf la connexion :

| Méthode | Route | Usage |
|---|---|---|
| `POST` | `/api/auth/admin/login` | Ouvrir une session agent |
| `GET` | `/api/admin/bootstrap` | Charger les bassins disponibles |
| `GET` | `/api/admin/gics` | Lire les GIC et compteurs de membres |
| `POST` | `/api/admin/gics` | Créer un GIC et le premier leader |

Le backend valide strictement le téléphone camerounais, le PIN à 4–6 chiffres, les identifiants numériques et les champs métier. Les données inconnues sont refusées. Les secrets ne doivent jamais être écrits dans un ticket, un rapport, Git ou les logs.

## Déploiement web restant à décider

Le code Expo Router peut être exporté avec :

```bash
cd frontend
npm ci
EXPO_PUBLIC_API_URL="https://<api-publique>/api" npm run export:web
```

L'export statique doit être hébergé sur un domaine HTTPS distinct, par exemple `https://admin.<domaine>/admin/login`. Il faut alors ajouter ce domaine exactement à `CORS_ORIGIN` du backend Render.

Le choix de l'hébergeur et du domaine est une décision du propriétaire du projet. Ne jamais mettre une URL locale, une URL de base de données ou des identifiants dans le bundle web.
