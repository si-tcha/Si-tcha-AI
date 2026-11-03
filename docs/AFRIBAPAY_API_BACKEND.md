# API backend AfribaPay (sandbox)

Cette intégration fournit les appels de paiement entrant nécessaires aux parcours d’achat et de préfinancement décrits dans [la conception mobile](./CONCEPTION_ECRANS_PAIEMENT_AFRIBAPAY.md).

## Sécurité et activation

- Tous les endpoints sont sous `/api/payments` et exigent un JWT `Bearer` valide d’un compte `ACHETEUR`. Le compte acheteur doit être vérifié.
- Les commandes et préfinancements sont recherchés côté serveur et doivent appartenir à l’acheteur connecté. Le client ne fournit jamais le montant, la devise, les frais, ni une destination de paiement.
- `Idempotency-Key` n’est pas un champ du contrat AfribaPay et n’est pas demandé par les endpoints de paiement Si-Tcha. Le backend AfribaPay identifie une collecte avec `order_id` et `reference_id`; Si-Tcha empêche aussi plusieurs paiements actifs sur le même dossier. Une opération incertaine doit être vérifiée avant tout nouvel essai.
- Pour `POST /orders`, `Idempotency-Key` est une option propre à Si-Tcha, non fournie par AfribaPay. Sans cette clé, un renvoi de la création peut générer une seconde commande.
- Le numéro n’est jamais renvoyé en clair ni conservé en base, seul son suffixe est conservé. Le PIN Mobile Money n’est jamais demandé. L’OTP n’est ni stocké ni journalisé.
- Le backend pointe exclusivement vers `https://api-sandbox.afribapay.com/v1`. L’intégration est désactivée par défaut : aucun appel de paiement n’est effectué tant que `AFRIBAPAY_ENABLED=false`.
- Ne jamais remplacer l’URL sandbox par une URL de production ou activer une configuration de production dans cette intégration.
- Le statut de référence est celui relu côté serveur auprès d’AfribaPay, jamais le retour de l’application mobile. Aucun callback client ne peut déclarer une transaction réussie.

Les variables backend reprennent les libellés fournis par AfribaPay :

| Variable backend | Valeur fournie par AfribaPay |
|---|---|
| `AFRIBAPAY_PUBLIC_API_USER` | Utilisateur public API |
| `AFRIBAPAY_API_SECRET_KEY` | Clé secrète API; utilisée comme mot de passe de l’authentification Basic du endpoint `/token` |
| `AFRIBAPAY_MERCHANT_KEY` | Clé du marchand |
| `AFRIBAPAY_AGENT_ID` | Identifiant Agent; conservé en configuration, mais non envoyé aux appels payin actuellement documentés |
| `AFRIBAPAY_PAYIN_URL` | URL API Payin sandbox; doit être `https://api-sandbox.afribapay.com/v1/pay/payin` |
| `AFRIBAPAY_PAYOUT_URL` | URL API Payout sandbox; réservé à une future intégration des versements, non utilisé par les endpoints payin présents |
| `AFRIBAPAY_RETURN_URL` | URL HTTPS optionnelle de retour après paiement |
| `AFRIBAPAY_CANCEL_URL` | URL HTTPS optionnelle de retour après annulation |
| `AFRIBAPAY_NOTIFY_URL` | URL HTTPS optionnelle de notification configurée par le marchand |

Configurer ces valeurs dans le `.env` local du backend à partir de `backend/.env.example`. `AFRIBAPAY_AGENT_ID` et `AFRIBAPAY_PAYOUT_URL` sont documentés et conservés pour correspondre aux informations du compte, mais ces endpoints ne font pas de payout et n’envoient pas d’identifiant agent. `PAYMENT_OTP_FINGERPRINT_SECRET` est un secret interne Si-Tcha, distinct des clés AfribaPay; il sert uniquement à vérifier que le numéro donné à la confirmation OTP est celui de la demande, sans enregistrer le numéro complet. Il doit faire au moins 32 caractères. Il n’est pas nécessaire pour un payin sans OTP. Aucun secret ne doit être envoyé à l’application mobile.

## Ordre des appels fournisseur

Le service `backend/src/services/afribapay.service.ts` suit le flux de la documentation AfribaPay :

1. **Token** — `POST https://api-sandbox.afribapay.com/v1/token`, corps vide, `Content-Type: application/json` et `Authorization: Basic <base64(AFRIBAPAY_PUBLIC_API_USER:AFRIBAPAY_API_SECRET_KEY)>`. Le texte encodé est exactement `UtilisateurPublicAPI:CleSecreteAPI`, sans espaces ajoutés. Le jeton est gardé côté backend et réutilisé jusqu’à son expiration.
2. **Pays et opérateurs** — `GET /v1/countries` avec `Authorization: Bearer <access_token>`.
3. **Payin** — `POST /v1/pay/payin` avec le même Bearer token et la clé marchand dans le corps métier.
4. **OTP et statut** — `POST /v1/pay/otp` ou `GET /v1/status`, également authentifiés avec Bearer.

Le frontend ne demande pas directement le token AfribaPay : `GET /api/payments/methods` et les autres routes backend appellent le fournisseur côté serveur. Aucun endpoint public Si-Tcha ne révèle le token ou les clés fournisseur.

La documentation AfribaPay du [PAYIN](https://docs.afribapay.com/) expose `order_id`, `reference_id`, `return_url`, `cancel_url` et `notify_url` dans le corps de l’exemple; elle ne documente pas de header `Idempotency-Key`. Si les variables de redirection/notification sont définies, le backend les envoie au fournisseur. Choisissez des URL HTTPS réellement accessibles et acceptées par AfribaPay. Si-Tcha ne traite pas de callback `notify_url` pour le moment : le statut reste vérifié en interrogeant l’API AfribaPay avec `GET /payments/{paymentId}/status`.

## Contrat

Base URL : `/api`

### `GET /payments/methods?countryCode=CM`

Retourne les opérateurs et la devise retournés par AfribaPay pour le Cameroun. `requiresOtp` indique si l’opérateur demande l’OTP, lorsque cette information est fournie par AfribaPay.

Dans Swagger, le paramètre facultatif `countryCode` apparaît sous **Parameters**. Cliquez d’abord sur **Try it out**, puis saisissez `CM`. Il est facultatif car le backend filtre déjà les méthodes disponibles sur le Cameroun par défaut.

```json
{
  "countries": [
    {
      "countryCode": "CM",
      "countryName": "Cameroon",
      "currency": "XAF",
      "prefix": "237",
      "operators": [
        {
          "code": "orange",
          "name": "Orange",
          "requiresOtp": false,
          "instructions": ""
        }
      ]
    }
  ]
}
```

### `GET /payments?resourceType=ORDER&resourceId=...`

Retrouve le paiement le plus récent créé pour ce dossier par l’acheteur connecté. Retourne `{ "payment": null }` en l’absence d’opération. Utiliser cet endpoint au retour dans l’application avant de proposer un nouvel essai.

### `POST /orders`

Crée une commande pour l’acheteur connecté à partir d’une offre de récolte existante. Requiert un JWT acheteur vérifié. Le header `Idempotency-Key` est facultatif et propre à Si-Tcha; il n’est pas transmis à AfribaPay.

```json
{
  "recolteOffreId": "ID_DE_L_OFFRE_DE_RECOLTE",
  "quantity": 2
}
```

`recolteOffreId` est l’identifiant de `RecolteOffre`, pas celui de `ProduitAgricole`. Le client ne choisit ni son acheteur, ni son GIC, ni le prix. Le backend vérifie la quantité disponible puis lit le prix unitaire depuis `ProduitAgricole.prix`. Si le prix est absent, la commande est refusée. Le montant XAF total est `quantity × prix unitaire` et doit être un nombre entier positif.

La quantité n’est **pas réservée ni déduite du stock** lors de la création, conformément à la politique choisie. Le stock peut donc évoluer avant le paiement; `POST /payments` effectue une nouvelle vérification et peut refuser une commande devenue indisponible. Le GIC doit confirmer la disponibilité effective séparément.

La réponse `201` contient `order.id`, à transmettre ensuite en `resourceId` à `POST /payments` :

```json
{
  "order": {
    "id": "uuid-commande",
    "status": "en_attente_paiement",
    "product": {
      "offerId": "uuid-offre",
      "name": "Produit",
      "unit": "kg",
      "gicId": "uuid-gic",
      "gicName": "Nom du GIC"
    },
    "quantity": "2",
    "unitPrice": "500",
    "totalAmount": "1000",
    "currency": "XAF"
  }
}
```

Si la clé facultative est fournie, répéter la requête avec la même clé et le même corps retourne la même commande (`200`), et réutiliser cette clé avec une autre offre ou quantité renvoie `409`. Sans clé, chaque appel crée une nouvelle commande (`201`); l’application doit éviter les doubles soumissions ou envoyer une clé pour les protéger.

### `GET /orders/offers`

Liste, pour un acheteur authentifié, les offres qui ont une quantité disponible positive et un prix unitaire configuré. L’identifiant `offers[].id` est la valeur à fournir comme `recolteOffreId` dans la création de commande. Les offres sans prix ou sans stock ne sont pas retournées.

### `POST /payments`

Pour les opérateurs sans OTP. Aucun header `Idempotency-Key` n’est requis.

```json
{
  "resourceType": "ORDER",
  "resourceId": "id-de-transaction-acheteur",
  "countryCode": "CM",
  "operator": "orange",
  "phoneNumber": "2376XXXXXXXX"
}
```

`resourceType` vaut `ORDER` ou `PREFINANCEMENT`. Pour un achat, le montant vient de `quantite × prixConvenu` de la commande créée par `POST /orders`. Pour un préfinancement, il vient de `montantValeur` du dossier déjà enregistré. Les montants XAF non entiers ou non positifs sont refusés. L’API ne crée pas de dossier de préfinancement.

Réponse `202 Accepted` :

```json
{
  "payment": {
    "id": "uuid",
    "type": "ORDER",
    "status": "PENDING",
    "amount": "12500",
    "currency": "XAF",
    "reference": "sitcha-uuid",
    "providerTransactionId": null,
    "paymentLink": null,
    "operator": "orange",
    "countryCode": "CM",
    "phoneNumberMasked": "****1234",
    "createdAt": "2026-10-28T17:00:00.000Z",
    "updatedAt": "2026-10-28T17:00:00.000Z"
  }
}
```

La réponse HTTP positive ne signifie pas que le paiement est confirmé. Si le dossier a déjà un paiement `PENDING`, `AWAITING_OTP` ou `SUCCESS`, l’API retourne cette opération existante et ne lance pas un second payin. Vérifiez son statut avant toute autre action. Après un échec confirmé, un nouvel appel peut créer une nouvelle tentative avec de nouvelles références `order_id` et `reference_id`. Pour une commande, le statut métier devient `payee` après confirmation `SUCCESS` et `paiement_echoue` après échec confirmé.

### Parcours OTP

1. `POST /payments/otp` avec le même corps que `POST /payments` : demande l’envoi d’un OTP et crée un paiement `AWAITING_OTP`, sans lancer de débit. Un nouveau POST pour ce même dossier renvoie le paiement en attente au lieu de demander un autre code.
2. `POST /payments/{paymentId}/confirm` avec `{ "phoneNumber": "...", "otpCode": "..." }` : transmet l’OTP à AfribaPay et passe le paiement à `PENDING`.
3. Le numéro doit être identique à celui utilisé à l’étape 1. L’OTP est éphémère et n’est jamais enregistré.

Le backend refuse le parcours standard pour un opérateur marqué `requiresOtp`, et inversement.

### `GET /payments/{paymentId}/status`

Le paiement est toujours recherché dans le périmètre de l’acheteur connecté. Tant qu’il est `PENDING`, le backend interroge AfribaPay par `transaction_id` ou par `order_id`.

Valeurs possibles : `AWAITING_OTP`, `PENDING`, `SUCCESS`, `FAILED`, `UNKNOWN`. `UNKNOWN` signifie que le statut n’a pas pu être vérifié ; ce n’est ni un échec ni une autorisation de recommencer le paiement.

## Périmètre comptable

Ces endpoints collectent le montant métier enregistré et vérifient son paiement. Ils n’ajoutent pas de frais au montant présenté à l’acheteur et ne déclenchent aucun reversement. Après confirmation `SUCCESS`, le backend enregistre dans le ledger du paiement la marge brute Si-Tcha de 10 %, la base restante avant répartition et, si AfribaPay la retourne, sa commission TTC et la marge réelle (marge brute moins commission AfribaPay). Ces montants restent internes et ne sont pas déclarés comme des fonds déjà redistribués.

La répartition entre agriculteurs, les destinations, les validations et les transferts sortants ne sont pas déclenchés par ces APIs. Ils doivent être traités par les services centraux de redistribution et rapprochés séparément.

## Mise en service technique

1. Renseigner les variables sandbox de `backend/.env.example` dans l’environnement backend, puis définir `AFRIBAPAY_ENABLED=true` uniquement pour les tests sandbox.
2. Appliquer les migrations Prisma `20261028180000_afribapay_payments`, `20261102173000_idempotent_buyer_orders` et `20261102232000_optional_payment_idempotency` avec `migrate deploy`.
3. Générer le client Prisma et compiler depuis `backend/` :

```powershell
.\node_modules\.bin\prisma.cmd migrate deploy
.\node_modules\.bin\prisma.cmd generate
npm run build
```

## Procédure de test avec Swagger UI

### 1. Démarrer le backend et ouvrir Swagger

Depuis le dossier `backend/`, démarrez le serveur :

```powershell
npm run dev
```

Le port configuré dans l’environnement local est `4000`. Ouvrez [http://localhost:4000/api-docs](http://localhost:4000/api-docs). Si le serveur utilise un autre port, remplacez `4000`.

Dans Swagger UI, vérifiez que les groupes **Authentification**, **Orders** et **Payments** sont présents. Si un groupe manque, redémarrez le backend et rechargez Swagger.

### 2. Obtenir un JWT acheteur

1. Ouvrez `POST /auth/login`, puis cliquez sur **Try it out**.
2. Saisissez les identifiants d’un compte acheteur existant, vérifié et autorisé à se connecter :

```json
{
  "contact": "CONTACT_ACHETEUR",
  "pin": "PIN_ACHETEUR"
}
```

3. Cliquez sur **Execute**. Une réponse `200` contient `token` et `user`. Vérifiez que `user.role` vaut `ACHETEUR`.
4. Copiez uniquement la valeur de `token`. Cliquez sur le bouton global **Authorize** (cadenas), collez le JWT dans le champ `bearerAuth`, puis validez avec **Authorize** et **Close**. Swagger ajoute le préfixe `Bearer` automatiquement.

N’utilisez pas un JWT d’agriculteur ou d’administrateur : les endpoints de paiement les refusent.

### 3. Vérifier les moyens disponibles

1. Ouvrez `GET /payments/methods`.
2. Cliquez **Try it out**; mettez `CM` dans `countryCode`.
3. Cliquez **Execute**.

Une réponse `200` indique les opérateurs, la devise et `requiresOtp`. Relevez le `code` d’un opérateur retourné et suivez le parcours normal ou OTP correspondant. Une réponse `503` indique que l’intégration n’est pas activée ou que sa configuration sandbox est incomplète.

### 4. Créer une commande produit

1. Ouvrez `GET /orders/offers`, cliquez **Try it out**, puis **Execute**. Choisissez une offre et relevez son `id`, son prix et son unité. Les offres listées ont du stock et un prix configuré.
2. Ouvrez `POST /orders`, cliquez **Try it out**, indiquez l’identifiant `id` relevé comme `recolteOffreId` et une quantité dans l’unité du produit. Aucun header n’est obligatoire. Vous pouvez laisser vide `Idempotency-Key`; pour protéger les renvois accidentels, vous pouvez saisir une clé Si-Tcha unique :

```json
{
  "recolteOffreId": "ID_DE_L_OFFRE_DE_RECOLTE",
  "quantity": 2
}
```

3. Cliquez **Execute**. La réponse `201` contient la commande créée et son identifiant `order.id`. Le prix unitaire et le total sont calculés par le backend; le client ne fournit aucun prix.
4. Le stock est vérifié mais **pas réservé**. Il peut changer avant la collecte, et l’API de paiement le vérifiera de nouveau. Une commande n’est donc pas une confirmation que le GIC a réservé ou garanti les produits.

Si vous avez déjà une commande test et connaissez son ID, vous pouvez l’utiliser directement sans en créer une autre.

Avant de créer une opération, ouvrez `GET /payments` :

- `resourceType` : `ORDER` ou `PREFINANCEMENT`
- `resourceId` : identifiant du dossier

Si un paiement existant est `PENDING`, `AWAITING_OTP` ou `UNKNOWN`, ne créez pas de deuxième opération; utilisez plutôt la vérification de statut.

### 5. Créer un paiement standard sandbox

À effectuer uniquement avec un opérateur dont `requiresOtp` vaut `false` et un numéro de test sandbox :

1. Ouvrez `POST /payments`, puis **Try it out**.
2. Remplissez le corps avec `order.id` retourné par `POST /orders`, sans ajouter de montant :

```json
{
  "resourceType": "ORDER",
  "resourceId": "ID_RETOURNE_PAR_POST_ORDERS",
  "countryCode": "CM",
  "operator": "CODE_OPERATEUR_RETOURNE_PAR_METHODS",
  "phoneNumber": "NUMERO_DE_TEST_SANDBOX"
}
```

Pour un préfinancement, remplacez `resourceType` par `PREFINANCEMENT` et `resourceId` par son identifiant.

3. Cliquez **Execute**. `202` signifie que le paiement a été lancé et doit encore être vérifié; ce n’est pas une confirmation de débit réussi. Notez `payment.id` dans la réponse. Aucun header `Idempotency-Key` ne doit être ajouté.

Si vous exécutez de nouveau la requête pendant qu’un paiement est en attente ou confirmé, l’API retourne le paiement déjà associé à ce dossier sans lancer un autre payin. Après un échec confirmé, vous pouvez envoyer à nouveau la requête pour créer une nouvelle tentative.

### 6. Vérifier le résultat

Ouvrez `GET /payments/{paymentId}/status`, cliquez **Try it out**, collez le `payment.id`, puis faites **Execute**. Répétez au besoin :

- `PENDING` : le fournisseur n’a pas encore donné le résultat final.
- `SUCCESS` : paiement confirmé lors de la vérification serveur.
- `FAILED` : échec confirmé.
- `UNKNOWN` : impossible de vérifier maintenant; ce n’est pas un échec et il ne faut pas relancer.
- `AWAITING_OTP` : le parcours attend encore le code OTP.

Ne considérez jamais un `200` ou `202` HTTP comme la preuve d’un paiement réussi.

### 7. Parcours OTP (seulement si `requiresOtp=true`)

1. Dans `POST /payments/otp`, envoyez le même type de dossier, identifiant, pays, opérateur et numéro que pour un paiement standard. Aucun header `Idempotency-Key` n’est requis.
2. Une réponse `202` crée un paiement `AWAITING_OTP` et demande l’envoi du code; elle ne confirme pas de débit.
3. Dans `POST /payments/{paymentId}/confirm`, collez `payment.id`, puis fournissez le même numéro et le code reçu par le canal de test sandbox :

```json
{
  "phoneNumber": "LE_MEME_NUMERO_DE_TEST",
  "otpCode": "CODE_OTP_SANDBOX"
}
```

4. Vérifiez le statut avec `GET /payments/{paymentId}/status`.

N’utilisez jamais de PIN Mobile Money à la place du code OTP. Le code OTP ne doit pas être ajouté aux journaux, captures d’écran ou tickets.

### 8. Vérifier les refus d’accès

Dans **Authorize**, effacez le JWT, puis exécutez `GET /payments/methods` : l’API doit répondre `401`. Réessayez ensuite avec un JWT valide d’agriculteur : l’API doit répondre `403`. Réautorisez-vous ensuite avec le JWT de l’acheteur vérifié.

Un identifiant de dossier inexistant ou appartenant à un autre compte doit être refusé. Ne partagez jamais les valeurs de `.env`, le JWT, le PIN, l’OTP ou les numéros complets dans des captures Swagger.

### Dépannage : erreur de connexion à AfribaPay

- Une réponse `502` avec `HTTP 401` ou `HTTP 403` signifie qu’AfribaPay a refusé l’authentification : vérifiez `AFRIBAPAY_PUBLIC_API_USER` et `AFRIBAPAY_API_SECRET_KEY` avec les valeurs du **sandbox**, puis redémarrez le backend après toute modification de `.env`.
- Une réponse `503` signalant `AFRIBAPAY_PAYIN_URL` indique que l’URL doit être l’endpoint sandbox HTTPS exact indiqué dans le `.env.example`. Les URL de production sont refusées par conception.
- `ENOTFOUND` ou `EAI_AGAIN` indique un problème de résolution DNS ou de réseau vers `api-sandbox.afribapay.com`.
- `ECONNABORTED` ou `ETIMEDOUT` indique que l’appel a expiré; vérifiez le réseau et réessayez plus tard.
- Toute autre réponse HTTP indique une erreur renvoyée par AfribaPay. Le détail brut du fournisseur n’est volontairement pas renvoyé afin de ne pas exposer d’informations sensibles.
- Ne copiez jamais les valeurs du `.env` dans Swagger, le code mobile, les journaux ou une capture. Seul le backend doit utiliser ces identifiants.

#### Vérifier le couple API sans effectuer de paiement

La documentation AfribaPay indique que `POST https://api-sandbox.afribapay.com/v1/token` utilise l’authentification HTTP **Basic** : `AFRIBAPAY_PUBLIC_API_USER` en nom d’utilisateur et `AFRIBAPAY_API_SECRET_KEY` en mot de passe. Ce test n’appelle que le endpoint de jeton; il ne crée aucun paiement.

Dans une nouvelle fenêtre PowerShell locale, exécutez le script ci-dessous. La fenêtre d’identification demande les valeurs sans les écrire dans la commande. Le script affiche uniquement le résultat HTTP et la date d’expiration, jamais le jeton ou le secret :

```powershell
$credential = Get-Credential -Message "Saisissez l'Utilisateur public API et la Clé secrète API du SANDBOX AfribaPay"
$pair = "{0}:{1}" -f $credential.UserName, $credential.GetNetworkCredential().Password
$basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))
try {
    $result = Invoke-RestMethod `
        -Uri "https://api-sandbox.afribapay.com/v1/token" `
        -Method Post `
        -Headers @{ Authorization = "Basic $basic" } `
        -ContentType "application/json" `
        -Body "{}" `
        -TimeoutSec 20

    if ($result.data.access_token) {
        Write-Host "Authentification sandbox réussie."
        Write-Host ("Expiration : {0}" -f $result.data.expires_at)
    } else {
        Write-Host "Réponse reçue sans jeton; vérifiez le contrat et le compte auprès d'AfribaPay."
    }
} catch {
    $status = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $status = [int]$_.Exception.Response.StatusCode
    }
    if ($status) {
        Write-Host ("Échec HTTP {0}; aucun détail ou secret n'est affiché." -f $status)
    } else {
        Write-Host "Échec de connexion réseau ou TLS; aucun détail sensible n'est affiché."
    }
} finally {
    $pair = $null
    $basic = $null
    $credential = $null
    $result = $null
}
```

Interprétation :

- **Authentification réussie** : le couple API est accepté. Arrêtez le backend avec `Ctrl+C`, ouvrez-le depuis `backend/` dans une nouvelle fenêtre, puis relancez `npm run dev`. Cela recharge `.env`. Si Swagger renvoie toujours `401`, vérifiez qu’il pointe sur ce serveur/port et qu’aucune variable d’environnement Windows `AFRIBAPAY_PUBLIC_API_USER` ou `AFRIBAPAY_API_SECRET_KEY` ne remplace la valeur du `.env` (dotenv ne remplace pas par défaut les variables déjà définies dans le processus).
- **HTTP 401** : AfribaPay rejette le couple envoyé. Vérifiez que vous avez utilisé l’**Utilisateur public API** et la **Clé secrète API** de la section sandbox du courriel — pas les identifiants du tableau de bord, la clé marchand ou l’identifiant Agent. Si le couple est exactement celui fourni et que le rejet persiste, demandez à AfribaPay de confirmer l’activation ou de réémettre les identifiants API sandbox. Ne transmettez jamais le secret dans votre demande d’assistance.
- **Échec réseau/TLS** : vérifiez la connexion Internet, le DNS, le proxy ou le pare-feu, puis réessayez.

Référence fournisseur : [documentation AfribaPay](https://docs.afribapay.com/).
