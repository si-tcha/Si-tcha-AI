# SI-TCHA AI - Système d'Orchestration Agricole

## 📝 Description du projet
Le secteur agricole camerounais est porteur mais impitoyable pour les producteurs. En cause : un manque de rigueur financière accentué par l'asymétrie d'information excluant les fermiers des crédits, l'absence d'étude de marché face à des intermédiaires qui imposent leurs prix, et la sous-estimation des exigences technique.

**SI-TCHA AI** résout ces failles par une application mobile *Offline-First* et un accompagnement terrain. Ciblant GIC, exploitations familiales et femmes, la solution orchestre les flux de la ferme à l'entrepôt. Elle harmonise les ventes, ouvre l'accès aux financements et diffuse l'expertise pour structurer la croissance des producteurs, du champ jusqu'à la commercialisation et l'industrialisation.

---

## 🛠️ Stack Technique & Choix des APIs

Pour garantir la viabilité sur le terrain camerounais, l'architecture repose sur des choix technologiques précis :

### Technologies Clés
* **Mobile (Frontend) :** `React Native` + `Expo Router` (SDK 56). Permet un développement rapide en TypeScript avec un routage natif basé sur les fichiers.
* **Base de Données Mobile :** `WatermelonDB` / `SQLite`. Indispensable pour l'approche **Offline-First**. L'application reste utilisable à 100% au fond des bassins de production sans réseau.
* **Serveur (Backend) :** `Node.js (Express ou NestJS)` en TypeScript. Assure une cohérence de langage (Fullstack TS) et gère la logique lourde de fusion des données.
* **Base de Données Centrale :** `PostgreSQL`. Idéale pour modéliser les relations complexes (GIC, Membres, Commandes, Acheteurs).

### Services & APIs Intégrés
1.  **Météo & Pluviométrie :** `OpenWeatherMap API`. Les données sont téléchargées dès qu'un réseau est détecté puis stockées localement pour la consultation hors-ligne.
2.  **Paiements & Préfinancements :** Agrégateurs locaux (`Campay` / `Monetbil`). API unique pour orchestrer les flux Mobile Money (MTN MoMo & Orange Money) indispensables au Cameroun.
3.  **Cartographie :** `Mapbox API`. Utilisée pour géolocaliser les bassins de production et optimiser les trajets des acheteurs à moindres coûts.

---

## 🚀 Lancement du Projet en Local

### 1. Clonage et Configuration Git
```bash
git clone git@github.com:sitcha-admin/si-tcha-ai-mobile.git

cd si-tcha-ai-mobile
```

### 2. Lancement de la partie backend 
Le serveur central doit obligatoirement tourner en arrière-plan pour traiter les requêtes de l'application mobile.
```bash
# 1. Naviguer dans le dossier du serveur
cd backend

# 2. Installer les packages requis
npm install

# 3. Créer votre fichier d'environnement local
cp .env.example .env

# 4. Lancer le serveur en mode développement
npm run dev
```

### 3. Lancement de la partie frontend
Puisque le projet intègre des fonctionnalités de bas niveau (mode hors-ligne WatermelonDB, synchronisation Wi-Fi), l'application classique Expo Go du Play Store ne fonctionnera pas. Vous devez utiliser le build personnalisé de l'équipe.

#### Etape1 : récupérer l'APK personnalisé

1. Connecte-toi à ton tableau de bord sur expo.dev.
2. Accède au projet si-tcha-mobile, va dans la section Development builds, et clique sur le dernier build Android réussi (Android internal distribution build).
3. Un QR Code s'affiche à l'écran : scanne-le avec ton smartphone pour télécharger et installer le fichier .apk personnalisé de l'application (autorise l'installation de sources inconnues si ton système Android le demande).

#### Étape 2 : Configuration locale et installation du code
Ouvre ton terminal sur ta machine de développement, puis exécute la série de commandes suivante :
```bash
# 1. Naviguer dans le dossier frontend du projet cloné
cd si-tcha-ai-mobile/frontend

# 2. Installer les modules et dépendances du projet
npm install

# 3. Installer l'outil de développement natif requis pour le monorepo
npx expo install expo-dev-client
```

#### Étape 3 : Authentification et Lancement du serveur local
Pour que ton environnement sache à quel projet EAS se rattacher, tu dois lier ton terminal local à l'organisation :
```bash
# 1. Initialiser le projet avec tes propres identifiants Expo (dev1@gmail.com)
eas project:init

# 2. Lancer le serveur d'écoute Expo en mode "dev-client"
npx expo start --dev-client
```

#### Étape 4 : Connexion au téléphone (Live Reload)
1. Assure-toi que ton ordinateur et ton smartphone sont connectés sur le même réseau Wi-Fi.
2. Ouvre l'application SI-TCHA AI que tu as installée sur ton téléphone à l'Étape 1
3. Utilise le scanner intégré à l'application mobile pour flasher le QR Code affiché dans le terminal de ton ordinateur.
4. L'application va charger le bundle de ton code local. Désormais, chaque modification sauvegardée dans ton éditeur (VS Code) se mettra à jour en temps réel sur ton smartphone !

---

