# John Commerce — Architecture

Plateforme modulaire Click & Collect + livraison. Démarrage animalerie
(Animalia), extensible en multi-boutiques, multi-commerçants, puis réseau de
coursiers.

---

## 1. Découpage général en silos

```
PLATEFORME JOHN
│
├── SILO 0  — Socle technique
├── SILO 1  — Organisation et utilisateurs
├── SILO 2  — Catalogue produits
├── SILO 3  — Stocks et disponibilité
├── SILO 4  — Tarifs et promotions
├── SILO 5  — Panier et commande
├── SILO 6  — Click & Collect
├── SILO 7  — Livraison
├── SILO 8  — Préparation des commandes
├── SILO 9  — Paiement
├── SILO 10 — Notifications
├── SILO 11 — Clients et fidélité
├── SILO 12 — Pilotage et statistiques
├── SILO 13 — Multi-boutiques        ┐
├── SILO 14 — Multi-commerçants       │ prévus dans l'architecture,
└── SILO 15 — Réseau de coursiers     ┘ non activés immédiatement
```

Chaque silo est **autonome** : contrat métier, données, écrans propres, adossés
au socle commun.

---

## 2. Niveaux de produit

| Niveau | Périmètre | Parcours |
|---|---|---|
| **1 — Boutique Animalia** (premier MVP) | Vente + retrait magasin | Catalogue → Panier → Commande → Retrait magasin |
| **2 — Livraison Animalia** | + livraison | Catalogue → Panier → Créneau → Préparation → Chauffeur → Livraison |
| **3 — Plusieurs boutiques John** | + multi-magasins | 1 admin → N magasins, N stocks, N zones |
| **4 — Plateforme multi-commerces** | Animalia, pizzeria, fleuriste, épicerie… | Chaque commerce a son espace |
| **5 — Réseau logistique local** | Coursiers à la demande | Course créée → coursier trouvé → enlèvement → livraison → facturation |

> Ce n'est qu'au **niveau 5** que le produit ressemble réellement à Grab.

---

## 3. SILO 0 — Socle technique

Aucune logique métier. Responsabilités : application web, base de données,
authentification, permissions, journalisation, gestion d'erreurs, stockage des
images, migrations, environnement de dev, tests, déploiement.

### Stack retenue (démarrage rapide)

| Domaine | Choix | Alternatives envisagées |
|---|---|---|
| Front + Back | **Next.js** (App Router) | — |
| Langage | **TypeScript** (strict) | — |
| Base | **PostgreSQL** | — |
| BaaS | **Supabase** (base + auth + storage + RLS + temps réel) | Auth.js, Cloudflare R2 |
| ORM | Prisma (optionnel) | requêtes Supabase |
| Validation | **Zod** | — |
| Formulaires | React Hook Form | — |
| UI | **Tailwind CSS** + composants accessibles | — |
| Cartographie | OpenStreetMap + MapLibre | — |
| Tests unitaires | **Vitest** | — |
| Tests navigateur | **Playwright** | — |
| Déploiement | **Vercel** | — |

### Arborescence cible

```
src/
├── app/
│   ├── (public)/
│   ├── (customer)/
│   ├── (staff)/
│   ├── (admin)/
│   └── api/
│
├── modules/            # logique métier par domaine
│   ├── organizations/
│   ├── users/
│   ├── catalog/
│   ├── inventory/
│   ├── pricing/
│   ├── cart/
│   ├── orders/
│   ├── pickup/
│   ├── delivery/
│   ├── fulfillment/
│   ├── payments/
│   ├── notifications/
│   ├── customers/
│   └── analytics/
│
├── shared/             # socle transverse
│   ├── auth/
│   ├── database/
│   ├── errors/
│   ├── validation/
│   ├── permissions/
│   ├── logging/
│   └── ui/
│
└── tests/
```

> **Règle fondamentale** — Une fonctionnalité liée aux commandes vit dans
> `modules/orders`, **pas** dans une page React ni un composant générique.
> Aucune dépendance des modules métier vers l'UI.

---

## 4. SILO 1 — Organisations, boutiques et utilisateurs

Définit **qui** utilise la plateforme et **pour quelle structure**.

**Entités** : `Organization`, `Store`, `User`, `Membership`, `Role`, `Permission`.

```
Organization : Animalia
Stores       : Animalia Nouméa · Animalia Dumbéa · Animalia Mont-Dore
```

**Rôles** : `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `STORE_MANAGER`,
`CATALOG_MANAGER`, `PREPARER`, `DRIVER`, `CUSTOMER_SUPPORT`, `CUSTOMER`.

**Règles** : un user appartient à une organisation ; peut être rattaché à ≥1
boutiques ; un responsable ne voit que son organisation ; un préparateur ne
modifie pas les prix ; un chauffeur ne voit que ses livraisons ; un client ne
voit que ses commandes.

**Écrans** : `/admin/organization`, `/admin/stores`, `/admin/users`, `/admin/roles`.

Détail complet dans [`SPRINT-0.md`](./SPRINT-0.md).

---

## 5. SILO 2 — Catalogue produits

Représente **ce qui est vendu**.

**Entités** : `Product`, `ProductVariant`, `Category`, `Brand`, `ProductImage`,
`ProductAttribute`, `ProductTag`.

**Produit vs variante** — ex. « Croquettes Royal Canin Adult » (produit) → 2 kg /
8 kg / 15 kg (variantes). Chaque variante a son prix, code-barres, stock, poids,
dimensions.

```
Product         : id, name, slug, description, categoryId, brandId, status, images
ProductVariant  : id, productId, sku, barcode, label, weight, price, active
```

**Import Excel** — John a un catalogue Excel. Prévu dès le départ :
`Import CSV/XLSX → prévisualisation → contrôle erreurs → create/update → rapport`.
Excel reste un **canal d'import**, jamais la base métier.

**Écrans** : `/admin/catalog/products[/new]`, `/admin/catalog/categories`,
`/admin/catalog/brands`, `/admin/catalog/import`.

---

## 6. SILO 3 — Stocks et disponibilité

Le catalogue dit ce qui **existe** ; le stock dit ce qui est **disponible**.

**Entités** : `InventoryItem`, `StockLocation`, `StockMovement`, `StockReservation`.

**Mouvements** : `PURCHASE`, `SALE`, `RETURN`, `ADJUSTMENT`, `TRANSFER`,
`RESERVATION`, `RESERVATION_RELEASE`, `DAMAGE`.

> Ne jamais stocker un simple `stock = 12`. Distinguer :
> `stock disponible = stock physique − stock réservé`.

**Cycle** : panier → rien bloqué · commande créée → stock réservé · annulée →
réservation libérée · remise/livrée → stock déduit définitivement.

**Écrans** : `/admin/inventory[/movements|/adjustments|/transfers]`.

---

## 7. SILO 4 — Tarifs et promotions

« Bloquer les prix » = le prix affiché à la commande **reste** celui de la
commande même si le tarif change ensuite. D'où un **snapshot** :

```
OrderItem : productNameSnapshot, skuSnapshot, unitPriceSnapshot,
            discountSnapshot, taxSnapshot
```

**Entités** : `PriceList`, `ProductPrice`, `Promotion`, `PromotionRule`, `Coupon`.

**Promotions** : prix fixe, pourcentage, montant, lot, 2+1 offert, sur
catégorie, sur marque, période spéciale, code promo.

**Hors MVP** : moteur promo complexe, combinaison libre, règles imbriquées,
tarification dynamique.

---

## 8. SILO 5 — Panier et commande

Cœur transactionnel. **Entités** : `Cart`, `CartItem`, `Order`, `OrderItem`,
`OrderStatusHistory`, `OrderNote`.

**4 dimensions d'état à ne jamais mélanger** :

| Commande | Paiement |
|---|---|
| `DRAFT`, `PENDING_CONFIRMATION`, `CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP`, `OUT_FOR_DELIVERY`, `COMPLETED`, `CANCELLED`, `REFUNDED` | `UNPAID`, `PENDING`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED` |

(+ état de préparation et état de livraison, gérés dans leurs silos.)

**Parcours client** : catalogue → panier → boutique → retrait/livraison →
créneau → coordonnées → paiement → confirmation → notification.

**Écrans** : `/shop`, `/shop/category/[slug]`, `/product/[slug]`, `/cart`,
`/checkout`, `/orders/[orderId]`.

---

## 9. SILO 6 — Click & Collect

Premier mode de retrait à développer. **Entités** : `PickupSlot`,
`PickupCapacity`, `PickupReservation`.

Chaque boutique définit ses horaires ; chaque créneau a une **capacité** ; un
créneau plein n'est plus sélectionnable ; commande préparée avant retrait ;
notification « prête » ; code de retrait possible.

**États** : `SCHEDULED`, `PREPARING`, `READY`, `COLLECTED`, `MISSED`, `CANCELLED`.

**Écrans** : `/staff/pickup/today`, `/staff/pickup/calendar`, `/staff/pickup/[orderId]`.

---

## 10. SILO 7 — Livraison

Plus complexe que le C&C, donc **après**. **Entités** : `DeliveryZone`,
`DeliverySlot`, `Delivery`, `DeliveryAssignment`, `DeliveryEvent`, `Address`.

Zone : nom, communes/polygone, tarif, minimum, délai, créneaux. Ex. Nouméa
centre 500 XPF (gratuit ≥ 8 000) · Dumbéa 900 XPF (gratuit ≥ 12 000) · Mont-Dore
1 200 XPF.

**États** : `PENDING_ASSIGNMENT`, `ASSIGNED`, `PICKUP_PENDING`, `PICKED_UP`,
`IN_TRANSIT`, `DELIVERED`, `FAILED`, `CANCELLED`.

**Preuve MVP** : code 4–6 chiffres + nom du réceptionnaire (signature, photo,
GPS plus tard).

---

## 11. SILO 8 — Préparation des commandes

Poste de travail du personnel. Écran principal `/staff/preparation` en colonnes :
À confirmer · À préparer · En préparation · Prêtes · Remises · Problèmes.

Fonctions : prise en charge, voir/confirmer articles, signaler manquant,
proposer remplacement, note, imprimer bon, marquer prête.

**MVP** — article indisponible → commande bloquée → contact manuel client. (Le
remplacement/remboursement partiel vient plus tard.)

---

## 12. SILO 9 — Paiement

**Abstrait** pour changer de prestataire. Modes : `PAY_AT_PICKUP`,
`PAY_ON_DELIVERY`, `BANK_TRANSFER`, `CARD_ONLINE`. Lancement : paiement en
magasin + à la livraison, puis paiement en ligne local.

**Entités** : `Payment`, `PaymentAttempt`, `Refund`, `PaymentProviderReference`.

```ts
interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>
  confirmPayment(reference: string): Promise<PaymentResult>
  refundPayment(reference: string, amount: number): Promise<RefundResult>
}
```

> La logique métier ne dépend **jamais** directement d'un fournisseur.

---

## 13. SILO 10 — Notifications

Canaux : `EMAIL`, `SMS`, `PUSH`, `WHATSAPP`, `IN_APP` (démarrage : EMAIL, SMS si
dispo). Événements : `ORDER_CONFIRMED/READY/CANCELLED`,
`DELIVERY_ASSIGNED/STARTED/COMPLETED`, `PAYMENT_CONFIRMED`.

**Entités** : `Notification`, `NotificationTemplate`, `NotificationPreference`,
`NotificationAttempt`. Journalisation des envois **et** des échecs.

---

## 14. SILO 11 — Clients et fidélité

**Entités** : `CustomerProfile`, `CustomerAddress`, `CustomerPreference`,
`LoyaltyAccount`, `LoyaltyTransaction`.

**MVP** : coordonnées, adresses, historique, consentement marketing, notes SAV.
**Plus tard** : points, avantages, bons, segmentation, relance, reco produits.

---

## 15. SILO 12 — Pilotage et statistiques

> Le dashboard vient **après** les flux métier, sinon graphiques sans données
> fiables.

**Opérationnel** : commandes du jour / à préparer / en retard, retraits à venir,
livraisons à affecter, CA, panier moyen, taux d'annulation, ruptures.
**Commercial** : CA par période/boutique/catégorie, top ventes, clients
récurrents, nouveaux clients, conversion, part retrait/livraison.

---

## 16. SILO 13 — Multi-boutiques

À préparer **dès la base de données**. Toute donnée métier porte
`organization_id`, et quand elle dépend d'un magasin `store_id`.

```
Product      : organization_id
InventoryItem: store_id
Order        : store_id
PickupSlot   : store_id
DeliveryZone : store_id
```

Évite de réécrire l'app quand John ouvre une zone/boutique.

---

## 17. SILO 14 — Multi-commerçants

Transforme l'app interne en **SaaS**. Ajouts : `Merchant`, `Subscription`,
`Plan`, `MerchantSettings`, `MerchantBilling`, `PlatformCommission`.

**Isolation** : chaque commerçant ne voit que ses produits, clients, commandes,
livreurs, statistiques.

**Modèles économiques** (jamais codés en dur) :
- Abonnement — Starter 15 000 · Business 35 000 · Pro 70 000 XPF/mois
- Commission — 3 % à 10 % / commande

---

## 18. SILO 15 — Réseau de coursiers

Dernier niveau. **Entités** : `Courier`, `CourierAvailability`, `Vehicle`,
`DeliveryOffer`, `DeliveryBid`, `CourierAssignment`, `CourierPayout`.

**Parcours** : commerce demande → prix calculé → proposé aux coursiers →
acceptation → enlèvement → livraison → preuve → paiement coursier.

**Complexités** : disponibilité temps réel, localisation, distance, affectation,
concurrence, annulation, litiges, assurance, contrats, rémunération,
responsabilité juridique. **Ne doit pas polluer le premier MVP.**

---

## 19. Ordre de développement

| Vague | Silos | Résultat |
|---|---|---|
| **1 — Fondations** | 0 Socle · 1 Orga/Users · 2 Catalogue | Admin accessible, produits/catégories/variantes/images, import initial |
| **2 — Vente** | 3 Stocks · 4 Prix · 5 Panier/Commandes | Catalogue public, panier, commande enregistrée, stock réservé, prix figé |
| **3 — Click & Collect** *(vrai MVP commercial)* | 6 Retrait · 8 Préparation · 10 Notifications | Commandes réelles, créneaux, écran préparateur, notif « prête » |
| **4 — Livraison Animalia** | 7 Livraison · 9 Paiement | Zones, frais, créneaux, chauffeurs, suivi, preuve |
| **5 — Croissance** | 11 CRM/Fidélité · 12 Analytics · 13 Multi-boutiques | — |
| **6 — Plateforme** | 14 Multi-commerçants · 15 Coursiers | — |

---

## 20. Discipline d'exécution (par silo)

À chaque silo, **le même cycle** :

1. Lire l'existant
2. Définir le contrat métier
3. Écrire le modèle de données
4. Écrire les règles d'autorisation
5. Écrire les services métier
6. Écrire les tests métier
7. Construire les routes serveur
8. Construire les écrans
9. Écrire les tests de parcours
10. Vérifier lint, typecheck, build
11. Documenter
12. Commit unique et lisible

> On ne demande jamais « fais toute la plateforme ». **Un silo, un périmètre
> fermé, des exclusions, des critères de sortie.** Point de départ : **SILO 0 +
> SILO 1**.
