# API backend AfribaPay (Sandbox)

Cette intégration fournit les endpoints de paiement entrant nécessaires aux parcours d’achat et de préfinancement de Si-Tcha AI.

## Sécurité et activation

- Tous les endpoints métier sont sous `/api/payments` et exigent un JWT `Bearer` valide d’un compte acheteur (`role: 'buyer'`). Le compte acheteur doit être vérifié (`phoneVerified: true` ou `isVerified: true`).
- Les commandes (`TransactionAcheteur`) et préfinancements (`Prefinancement`) sont identifiés par leurs identifiants numériques (`BigInt`) et doivent appartenir à l’acheteur connecté.
- Le client mobile/web ne fournit jamais le montant, la devise, les frais, ni la destination du versement. Tous les montants sont calculés côté serveur et validés en XAF entiers positifs.
- Le numéro de téléphone n'est jamais stocké en clair ; seul son suffixe de 4 chiffres est conservé pour référence. Le code PIN Mobile Money n’est jamais demandé.
- Dans le parcours OTP, une empreinte cryptographique HMAC-SHA256 (`PAYMENT_OTP_FINGERPRINT_SECRET`, minimum 32 caractères) garantit que le numéro de confirmation est strictement identique à celui de la demande, sans jamais stocker le numéro complet en base. Le code OTP n'est ni stocké ni journalisé.
- Le backend pointe exclusivement vers l'environnement Sandbox : `https://api-sandbox.afribapay.com/v1`. L’intégration est désactivée par défaut (`AFRIBAPAY_ENABLED=false`).
- **Un paiement n'est validé qu'après statut final fournisseur `SUCCESS`** : aucun retour direct du client ne valide une transaction.

## Variables d'environnement

| Variable backend | Description |
|---|---|
| `AFRIBAPAY_ENABLED` | `"true"` pour activer les appels sandbox, `"false"` par défaut |
| `AFRIBAPAY_PUBLIC_API_USER` | Identifiant public API fourni par AfribaPay |
| `AFRIBAPAY_API_SECRET_KEY` | Clé secrète API AfribaPay (utilisée pour l'authentification HTTP Basic sur `/token`) |
| `AFRIBAPAY_MERCHANT_KEY` | Clé marchand AfribaPay |
| `AFRIBAPAY_AGENT_ID` | Identifiant agent (optionnel) |
| `AFRIBAPAY_PAYIN_URL` | Doit pointer vers `https://api-sandbox.afribapay.com/v1/pay/payin` |
| `AFRIBAPAY_PAYOUT_URL` | `https://api-payout-sandbox.afribapay.com/v1/pay/payout` (réservé aux versements futurs) |
| `AFRIBAPAY_RETURN_URL` | URL HTTPS de redirection après succès (optionnel) |
| `AFRIBAPAY_CANCEL_URL` | URL HTTPS de redirection après annulation (optionnel) |
| `AFRIBAPAY_NOTIFY_URL` | URL HTTPS de notification webhook vers `/api/payments/webhook` |
| `AFRIBAPAY_WEBHOOK_SECRET` | Secret partagé optionnel pour valider la signature des webhooks |
| `PAYMENT_OTP_FINGERPRINT_SECRET` | Secret interne serveur (>= 32 caractères) pour l'empreinte OTP |

---

## Endpoints de l'API

Base URL : `/api`

### 1. `GET /payments/methods?countryCode=CM`
Retourne les opérateurs de paiement disponibles pour le Cameroun.
- **Accès** : Acheteur authentifié
- **Réponse 200** :
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
          "name": "Orange Money",
          "requiresOtp": true,
          "instructions": "*150*...#"
        },
        {
          "code": "mtn",
          "name": "MTN Mobile Money",
          "requiresOtp": false,
          "instructions": ""
        }
      ]
    }
  ]
}
```

### 2. `GET /payments?resourceType=ORDER&resourceId=12`
Recherche le dernier paiement associé à une commande ou un préfinancement pour l'acheteur connecté.
- **Paramètres query** :
  - `resourceType` : `ORDER` ou `PREFINANCEMENT`
  - `resourceId` : identifiant numérique (`BigInt` en chaîne, ex: `"12"`)
- **Réponse 200** : `{ "payment": { ... } }` ou `{ "payment": null }`.

### 3. `POST /payments`
Initie un paiement standard (pour les opérateurs ne requérant pas de code OTP préalable).
- **Accès** : Acheteur authentifié vérifié
- **Corps JSON** :
```json
{
  "resourceType": "ORDER",
  "resourceId": "12",
  "countryCode": "CM",
  "operator": "mtn",
  "phoneNumber": "670000000"
}
```
- **Réponse 202 (créé)** ou **200 (réutilisé si déjà actif)** :
```json
{
  "payment": {
    "id": "1",
    "type": "ORDER",
    "status": "PENDING",
    "amount": "15000",
    "currency": "XAF",
    "reference": "sitcha-8f4b-...",
    "providerTransactionId": "afp-tx-...",
    "paymentLink": null,
    "operator": "mtn",
    "countryCode": "CM",
    "phoneNumberMasked": "****0000",
    "createdAt": "2026-11-04T05:00:00.000Z",
    "updatedAt": "2026-11-04T05:00:00.000Z"
  }
}
```

### 4. `POST /payments/otp`
Demande un code d'autorisation OTP auprès de l'opérateur (ex: Orange Money Cameroun).
- Même corps que `POST /payments`.
- Le paiement est créé dans l'état `AWAITING_OTP` ; aucun débit immédiat n'est effectué.

### 5. `POST /payments/:paymentId/confirm`
Confirme le débit avec le code OTP reçu par l'utilisateur.
- **Corps JSON** :
```json
{
  "phoneNumber": "690000000",
  "otpCode": "1234"
}
```
- Le numéro doit correspondre strictement à l'empreinte de la demande initiale.

### 6. `GET /payments/:paymentId/status`
Interroge l'état du paiement et met à jour le statut en base si nécessaire en interrogeant AfribaPay.
- Si le paiement passe à `SUCCESS`, la commande liée passe à `payee`.
- Si le paiement passe à `FAILED`, la commande liée passe à `paiement_echoue`.

### 7. `POST /payments/webhook`
Endpoint de callback serveur à serveur (`notify_url`).
- **Format du callback AfribaPay** : AfribaPay transmet ses notifications HTTP POST à l'URL `notify_url` soit sous forme de corps JSON direct (`{ "order_id": "...", "status": "..." }`), soit sous forme de chaîne JSON encodée en base64 dans le champ `afp_data` (`{ "afp_data": "ey..." }`). Le backend prend en charge nativement ces deux formats.
- **Audit de la signature** : La spécification officielle AfribaPay ne définit pas d'en-tête de signature HMAC universellement imposé à tous les marchands (contrairement à Stripe ou PayPal). Si la variable d'environnement `AFRIBAPAY_WEBHOOK_SECRET` est renseignée, le backend valide la correspondance en temps constant (`timingSafeEqual`) de l'en-tête `X-Afribapay-Signature`, `X-Webhook-Secret` ou du paramètre d'URL `?secret=`.
- **Règle d'or de sécurité (Défense en profondeur)** : Quel que soit le payload ou les en-têtes reçus, le backend **ne fait jamais confiance aveuglément au statut transmis dans le webhook**. Dès réception d'un événement, le backend effectue un appel autoritaire direct auprès de l'API AfribaPay (`GET /v1/status`) avec l'`orderId` et le `providerTransactionId` enregistrés pour valider le statut réel de la transaction.
- **Idempotence stricte** : Si le paiement est déjà dans son état final (`SUCCESS` ou `FAILED`), le webhook retourne immédiatement `200 OK` avec `{ received: true, alreadyProcessed: true }` sans effet de bord ni double écriture.

---

## Parcours Mobile Frontend (Acheteur)

L'application mobile Si-Tcha AI intègre deux modalités de règlement distinctes :

1. **Règlement en espèces à la livraison (Parcours historique 100% préservé)** :
   - Aucun appel à la passerelle AfribaPay.
   - Commande enregistrée en base locale et backend avec le statut `en_attente`.
   - Affichage du bordereau QR logistique permettant la vérification physique lors de la livraison.

2. **Règlement en ligne Mobile Money (AfribaPay Sandbox)** :
   - Choix de l'opérateur (Orange Money, MTN MoMo) via `GET /api/payments/methods?countryCode=CM`.
   - Si l'opérateur requiert un code OTP préalable (ex : Orange Money Cameroun) :
     - Appel à `POST /api/payments/otp` créant la transaction au statut `AWAITING_OTP`.
     - Ouverture de la modale de saisie du code OTP temporaire.
     - Confirmation du débit via `POST /api/payments/:paymentId/confirm`.
   - Si l'opérateur ne requiert pas d'OTP (ex : MTN MoMo) :
     - Appel direct à `POST /api/payments` créant la transaction au statut `PENDING`.
     - L'acheteur valide le push USSD / SMS sur son téléphone.
   - **Suivi et Résilience** :
     - Modale d'état en direct (`PENDING`, `SUCCESS`, `FAILED`, `UNKNOWN`) avec sondage automatique et bouton d'actualisation manuelle (`GET /api/payments/:paymentId/status`).
     - **Reprise de paiement garantie** : Depuis l'écran des commandes (`orders.tsx`), toute commande non réglée propose le bouton « Payer en ligne / Suivre ». L'appel à `GET /api/payments?resourceType=ORDER&resourceId=...` permet de reprendre instantanément un paiement interrompu (en attente d'OTP ou en cours de validation) sans double facturation ni perte d'état.
