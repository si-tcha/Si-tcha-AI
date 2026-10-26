# Instructions mobile pour les parcours financiers Si-tcha

## 1. Travail attendu

Implémenter les parcours financiers en respectant les maquettes Figma existantes : composants, couleurs, typographie, navigation et dispositions. Alimenter les montants, dates et noms avec les données reçues, sans valeurs d’exemple codées en dur.

Utiliser les services Si-tcha mis à disposition pour alimenter les vues et exécuter les actions. Les conditions métier, montants, permissions et actions autorisées sont ceux retournés par ces services.

Les compléments de parcours décrits ci-dessous doivent réutiliser les composants Figma. Lorsqu’une vue manque dans les maquettes, signaler le besoin et appliquer leur langage visuel sans refondre les écrans existants.

## 2. Parcours à couvrir

| Profil | Parcours mobile |
|---|---|
| Acheteur | Acheter les produits d’un GIC et suivre ses commandes et paiements |
| Acheteur | Préfinancer une récolte et suivre son droit d’exclusivité sur le produit concerné |
| Agriculteur ou membre | Consulter ses finances personnelles, ses quotes-parts, ses versements et ses dépenses |
| Responsable GIC habilité | Consulter le journal du GIC et suivre la répartition des bénéfices |
| Agent Si-tcha habilité | Suivre les encaissements, redistributions, frais Si-tcha et opérations à traiter |

Le responsable du GIC et l’agent Si-tcha ne doivent pas être assimilés par défaut. Afficher chaque écran et action selon les droits du compte connecté. Un agriculteur peut consulter sa quote-part sans avoir le droit de déclencher le partage de tout le GIC.

## 3. Acheteur et achat des produits GIC

### 3.1 Catalogue existant

- Alimenter la recherche, les catégories, les cartes et le panier avec les données reçues.
- Sur chaque carte, afficher produit, GIC vendeur, prix et unité. Ne pas confondre un prix au kilogramme avec le total d’une commande.
- Le bouton plus ajoute le produit disponible au panier ; la carte ouvre sa fiche.
- Respecter les indisponibilités et quantités autorisées. Afficher un message si les données ont changé depuis la dernière consultation.
- Le panier donne accès au récapitulatif, puis au paiement.

### 3.2 Fiche produit et panier

Dans la fiche, montrer le GIC vendeur, la description, l’unité, le prix, la quantité choisie et les informations de disponibilité reçues. Dans le panier, permettre la modification des quantités et la suppression d’un article.

Avant paiement, présenter les articles, quantités, sous-total, livraison, autres frais éventuels et total. Afficher les montants reçus sans recalculer les commissions ou les droits des vendeurs. Si le total est actualisé, faire confirmer le nouveau récapitulatif.

Parcours : **Catalogue → Fiche produit ou ajout au panier → Panier → Récapitulatif → Paiement → Résultat → Détail de commande**.

### 3.3 Suivi après achat

Dans le détail de commande, distinguer le statut du paiement et celui de la commande. Un paiement confirmé ne signifie pas que la commande est livrée.

Afficher le GIC, les articles, le montant payé, les références utiles, les dates et le suivi commercial disponible. Donner accès au reçu et au signalement d’un problème lorsque ces actions sont disponibles.

## 4. Acheteur et préfinancement avec exclusivité

Ce parcours concerne une récolte future. Il doit rester identifiable séparément d’un achat de produits disponibles. Les conditions de préfinancement et d’exclusivité affichées sont celles du dossier fourni ; ne pas en inventer dans le mobile.

### 4.1 Accès et présentation de la récolte

Depuis l’emplacement prévu dans Figma, ouvrir une offre de récolte préfinançable. Afficher le produit, le GIC, la campagne, la quantité estimée, la période de récolte prévue, le montant demandé et le financement déjà obtenu lorsque ces données existent.

Identifier clairement les quantités et dates comme estimatives lorsqu’elles le sont. Le bouton **Préfinancer cette récolte** apparaît seulement pour une offre éligible.

### 4.2 Récapitulatif avant engagement

Avant de payer, afficher :

- La récolte et le GIC concernés.
- Le montant à payer maintenant et les frais éventuels.
- Le périmètre exact de l’exclusivité : produit, lot ou quantité concernée, durée et conditions applicables.
- Le prix ou son mode de fixation, le reliquat éventuel et les conditions de livraison, si le dossier les prévoit.
- Les conditions applicables en cas d’annulation, de retard ou de récolte insuffisante.

Permettre de consulter les conditions et de les accepter explicitement avant de continuer. Si une information nécessaire à l’engagement manque, afficher une indisponibilité et un accès à l’assistance plutôt que compléter par une hypothèse.

Le bouton de confirmation précise **Payer le préfinancement de [montant] FCFA**. Il ouvre le même composant de paiement que l’achat, avec un contexte visuel « Préfinancement de récolte ».

### 4.3 Suivi du préfinancement

Parcours : **Offre de récolte → Conditions et exclusivité → Récapitulatif → Paiement → Dossier de préfinancement**.

Dans le dossier, distinguer trois informations :

| Information | Affichage attendu |
|---|---|
| Paiement | En attente, confirmé ou échoué selon le résultat reçu |
| Préfinancement | État du dossier et prochaines étapes reçues |
| Exclusivité | Périmètre et état du droit accordé, avec ses dates et conditions |

Ne pas afficher automatiquement « Exclusivité active » après un simple retour du paiement. Afficher cet état uniquement lorsqu’il est confirmé dans le dossier. Une exclusivité ne doit pas être présentée comme portant sur tous les produits du GIC si elle ne concerne qu’un lot.

Prévoir une liste des préfinancements et l’accès à chaque dossier, avec les sommes versées, le reliquat éventuel, les documents disponibles et le suivi de la récolte. Afficher les actions de complément de paiement, d’assistance ou de remboursement seulement lorsqu’elles sont autorisées.

Si l’offre devient indisponible pendant le parcours, actualiser le dossier. Si un paiement est déjà en cours, conserver son suivi avant toute nouvelle action.

## 5. Composant de paiement commun

Réutiliser le même composant de paiement pour l’achat de produits et le préfinancement, en conservant le contexte de l’opération.

### 5.1 Saisie et validation

Afficher les moyens disponibles pour l’opération, le numéro à débiter, le montant et les instructions reçues. Autoriser un numéro de paiement différent du numéro de connexion.

Selon le parcours demandé, présenter une validation sur le téléphone, un champ OTP ou l’ouverture du lien de paiement fourni. Ne jamais demander le PIN Mobile Money. Ne pas conserver l’OTP dans le stockage local ou les journaux.

Désactiver le bouton pendant l’envoi. En cas d’interruption, retrouver l’opération en cours avant de permettre un nouveau paiement.

### 5.2 Résultat

| Statut reçu | Comportement mobile |
|---|---|
| `PENDING` | Afficher « Paiement en cours de confirmation », proposer de vérifier et permettre de revenir au dossier |
| `SUCCESS` | Afficher « Paiement confirmé », le montant, la référence et le lien vers la commande ou le préfinancement |
| `FAILED` | Afficher le motif disponible et proposer une nouvelle tentative seulement si elle est autorisée |
| Statut non récupérable | Afficher « Statut à vérifier » ; ne pas présenter l’opération comme échouée |

Un succès HTTP ou un retour depuis la page de paiement ne suffit pas à confirmer une transaction. Une attente prolongée ne doit pas devenir un échec ou un remboursement automatique.

Actualiser le détail après le retour d’un parcours externe, au retour au premier plan et lors de la réouverture de l’application. Conserver la référence de suivi. Pendant une attente, afficher : « Si vous avez déjà été débité, vérifiez le statut avant de recommencer. »

## 6. Agriculteur et écran Mes Finances

### 6.1 En-tête financier

Afficher le GIC et le membre concernés, puis les valeurs reçues pour :

- **Solde de compte disponible** : reprendre la valeur et la définition fournies ; ne pas le présenter comme un solde Mobile Money sans indication explicite.
- **Quote-part cumulée** : afficher la période correspondante et distinguer cette attribution des versements effectivement reçus.
- **À jour** : afficher ce badge seulement après une synchronisation réussie ; sinon montrer la dernière actualisation ou l’état hors ligne.

Ne pas additionner quote-part attribuée et versement reçu comme deux revenus distincts.

### 6.2 Dernières transactions

Reprendre les cartes de la maquette : libellé, date, entrée ou sortie, montant et sens visuel. Associer la couleur à un signe et à un libellé pour garder la lecture accessible.

Chaque carte ouvre un détail avec catégorie, référence, statut, montant, frais éventuels et opération liée. Permettre d’identifier une vente, un acompte de récolte, une dépense, une quote-part et un versement sans les confondre.

### 6.3 Quotes-parts et versements

La section **Mes Quotes-parts validées** présente les attributions approuvées pour le membre et permet d’ouvrir leur détail : période, GIC, base de répartition, part attribuée et versements associés.

Une quote-part validée ne signifie pas nécessairement que l’argent a déjà été transféré. Afficher séparément **À verser**, **Versement en cours**, **Versé** ou le motif de blocage reçu.

Le détail d’un versement montre le montant, la destination masquée, la date et le statut. L’agriculteur ne peut pas déclarer lui-même une opération réussie. Afficher l’accès au compte de réception et à sa modification si le parcours et les droits le permettent.

### 6.4 Dépenses personnelles

Donner accès au suivi des dépenses depuis l’emplacement prévu pour les finances. Afficher date, catégorie, montant et justificatif disponible. Pour une saisie autorisée, prévoir montant, date, catégorie, description et justificatif facultatif.

Distinguer une dépense enregistrée dans le suivi d’un paiement réellement exécuté. Enregistrer une dépense ne doit pas afficher « Paiement effectué » ni déclencher visuellement une sortie Mobile Money.

### 6.5 Télécharger l’historique

Le bouton **Télécharger l’historique PDF** ouvre le choix de période si nécessaire, puis télécharge le document fourni. Prévoir chargement, ouverture ou partage via le téléphone, erreur et possibilité de réessayer. L’historique concerne uniquement le périmètre accessible à l’utilisateur.

## 7. Finances du GIC

Présenter les finances du GIC séparément du suivi financier global de Si-tcha.

### 7.1 Journal comptable

Conserver les indicateurs **Solde**, **Entrées**, **Sorties**, les filtres **Tout**, **Entrées**, **Sorties** et les lignes d’opérations prévus dans Figma.

Afficher la période, les totaux reçus et une liste paginée. Chaque ligne présente libellé, date, catégorie et montant ; elle ouvre le détail et son justificatif éventuel. Le filtre ne doit pas faire passer le total des seules lignes chargées pour le total du GIC.

Le bouton plus apparaît selon les permissions. Il ouvre uniquement les actions de saisie autorisées avec leurs champs correspondants. Ne pas déduire de sa présence qu’un membre peut déclencher un transfert d’argent.

### 7.2 Répartition des bénéfices

Reprendre le total des bénéfices, la période, l’état de validation et les membres avec pourcentage et montant attribué.

- Alimenter la liste et le nombre de membres avec les données reçues.
- Afficher séparément le montant attribué et le statut de versement de chaque bénéficiaire.
- Respecter les règles d’édition retournées ; ne pas recalculer ou modifier localement les droits de chacun.
- Si le partage est déjà soumis ou terminé, remplacer l’action de lancement par un accès au suivi.

Le bouton **Démarrer le partage des gains** ouvre une confirmation montrant la période, les bénéficiaires, le total, les frais éventuels et les destinations masquées disponibles. Après confirmation, désactiver la relance pendant la soumission, puis afficher le résultat par membre.

Si une validation supplémentaire est nécessaire, afficher « En attente de validation ». Ne pas annoncer des fonds envoyés à tous parce que la demande de partage a été acceptée. Un partage partiellement réussi conserve les réussites et signale les lignes en attente ou en échec ; aucune relance globale automatique.

## 8. Agent Si-tcha et suivi financier

Reprendre les écrans Figma de l’agent et les alimenter selon ses habilitations. Distinguer ses indicateurs et permissions de ceux du responsable GIC.

Le tableau de bord présente les encaissements confirmés, redistributions en cours et effectuées, frais Si-tcha et opérations à traiter, avec période et date de mise à jour. Distinguer achat de produits et préfinancement de récolte dans les listes et les détails.

Chaque encaissement ouvre la commande ou le dossier de préfinancement concerné. Chaque redistribution ouvre ses bénéficiaires, montants et statuts individuels. Les configurations métier accessibles à l’agent reprennent uniquement les champs autorisés par les services disponibles ; demander confirmation avant d’enregistrer une modification.

Pour toute action de redistribution autorisée, afficher un récapitulatif avant confirmation puis son suivi. Conserver les mêmes protections contre le double appui et la relance d’une opération incertaine. Afficher les demandes de remboursement ou les problèmes financiers et leurs actions seulement lorsqu’ils sont accessibles au profil.

## 9. États transverses

Pour chaque écran, prévoir chargement, absence de données, erreur avec reprise, accès refusé et affichage hors ligne. Une absence de transactions ne doit pas être présentée comme une erreur.

Hors ligne, permettre la consultation des données mémorisées avec leur date. Désactiver les actions de paiement, préfinancement et partage des gains ; ne pas les déclencher automatiquement lors du retour du réseau.

Les montants portent leur devise et leur période. Les numéros sensibles sont masqués dans les historiques. Les messages de statut restent compréhensibles sans vocabulaire technique. Une notification ouvre le détail actualisé de l’opération.

## 10. Vérifications avant livraison mobile

- Le catalogue Figma permet l’achat d’un produit GIC jusqu’au suivi de commande.
- Le préfinancement possède son récapitulatif, ses conditions d’exclusivité et son dossier de suivi distincts.
- Un paiement en attente n’affiche ni commande payée ni exclusivité active par anticipation.
- Le double appui, la fermeture de l’application et le retour du parcours externe n’entraînent pas de nouvelle opération involontaire.
- Mes Finances distingue quotes-parts attribuées, versements reçus et dépenses.
- Le journal du GIC applique ses filtres et ouvre les détails.
- La répartition montre les résultats par membre, y compris les réussites partielles.
- Un membre, un responsable GIC et un agent Si-tcha n’ont accès qu’aux actions de leur profil.
- Le téléchargement PDF, les listes vides et les erreurs réseau sont utilisables.
- Les écrans respectent les maquettes existantes et ne contiennent aucun montant, membre ou statut d’exemple codé en dur.

