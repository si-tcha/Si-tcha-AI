# Création contrôlée du premier agent

Ce script crée un compte `Admin` utilisable par le dashboard. Il est réservé à
la personne qui possède l'accès à la **base Render active** de production.

## Principes

- Ne jamais créer d'agent depuis l'application mobile ni par une API publique.
- Ne jamais versionner `DATABASE_URL` ou le mot de passe de l'agent.
- Le script refuse tout écrasement d'un agent existant.
- Utiliser un mot de passe unique d'au moins 12 caractères et le transmettre au
  futur agent par un canal privé.

## Exécution depuis un terminal sécurisé

Après avoir récupéré le dépôt à jour et installé les dépendances du backend :

```bash
cd backend
export DATABASE_URL='connexion de la base Render active'
export ADMIN_NAME='agent-entreprise-01'
export ADMIN_CONTACT='contact professionnel de l’agent'
export ADMIN_PASSWORD='mot de passe long, unique et privé'
export CONFIRM_CREATE_ADMIN=CREATE_ADMIN
npm run admin:create
```

Le résultat attendu est :

```text
Agent créé avec succès : agent-entreprise-01
```

L'agent peut ensuite se connecter sur le dashboard, créer les GIC et leurs
leaders, mais aucun nouvel agent ne peut être créé depuis le dashboard.
