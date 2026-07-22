# Rapport d’écart — Specs SI-TCHA AI vs MVP livré

Date : 22 juillet 2026  
Périmètre livré : **Lots A + B** (offline mock)  
Stack : Expo React Native SDK 56 · **expo-sqlite** (natif) · localStorage (`database.web.ts`) pour le web

---

## 1. Ce qui est fait (MVP A+B)

### Espace GIC / Vendeur
| Spec | Implémentation |
|------|----------------|
| Identité GIC, membres, règlement, besoins | `(seller)/profile.tsx` + `dbService` |
| Récoltes & charges + coût de revient /kg | `(seller)/home.tsx` (déjà) + **/ha** si surface |
| Météo, marché, programmes, alertes phyto offline | `(seller)/terrain.tsx` (seeds) |
| Sync peer mock (timestamps + priorité Leader) | `(seller)/sync.tsx` + `runMockSync()` |

### Espace Acheteur
| Spec | Implémentation |
|------|----------------|
| Catalogue + filtres catégorie / bassin / maturité | `(buyer)/home.tsx` |
| Liste GIC confidentielle (nom, logo, REF) | `(buyer)/gics.tsx` |
| Commande ferme / achat direct / réservation | `(buyer)/checkout.tsx` + `orders` |
| Préférences d’alertes produits/bassins | `(buyer)/alerts.tsx` |
| Panier local | `dbService` cart |

### Stockage
- Natif : table `kv_store` via **expo-sqlite**
- Web : clés localStorage (même API)
- Seeds partagés : `database.shared.ts`

### Vérifications
- Smoke sync Leader : `frontend/scripts/smoke-offline-mvp.mjs`
- Export web Expo (parcours de bundle)

---

## 2. Non fait (Lots C+D + présentation)

### Specs fonctionnelles — Lot C
- Questions agronome (texte + photo) en file offline
- Commerce inter-agriculteurs B2B (troc / location matériel)

### Specs fonctionnelles — Lot D
- Journal de bord de croissance (semis, levée, traitements)
- Alerte baisse de récolte > 15 %
- Préfinancement / crédit matériel acheteur → GIC
- Trust Score / notation réciproque post-transaction

### Présentation SI-TCHA AI SARL (hors MVP)
- Passerelle SMS (Afro SMS / rural connectivity)
- Imagerie satellite / NDVI / ML sol
- Sync P2P réelle (Wi‑Fi Direct / partage fichier type Xender)
- Flux marché temps réel + commissions B2B live
- Auth réelle + API Prisma/PostgreSQL
- Paiements Mobile Money (Campay / Monetbil)
- Cartographie Mapbox
- Migration éventuelle WatermelonDB (README) — **non utilisée** ; le code s’appuie sur **expo-sqlite**

---

## 3. Dépendances techniques pour la suite

1. Brancher `dbService` → API Express/Prisma (modèles déjà dans `backend/prisma/schema.prisma`)
2. Remplacer `runMockSync` par sync fichier/P2P + résolution conflits serveur
3. Auth (JWT/session) et rôles Leader/membre côté backend
4. Médias agronome : `expo-image-picker` + file d’attente sync
5. Intégrations externes : OpenWeatherMap, Campay, Mapbox, SMS

---

## 4. Alignement produit (présentation)

Le MVP couvre les piliers **offline-first**, **rigueur financière**, **market intelligence lecture**, **structuration GIC**, et **vendre avant de produire** (réservation).  
Les piliers **SMS**, **NDVI/satellite**, **monétisation live** et **sync terrain réelle** restent au backlog (ce rapport).
