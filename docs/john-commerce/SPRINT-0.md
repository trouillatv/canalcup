# Sprint initial — SILO 0 (Socle) + SILO 1 (Organisation & Utilisateurs)

Périmètre **fermé** du premier sprint. Objectif : le socle applicatif + le
modèle multi-organisation. Rien d'autre.

---

## Objectif

Créer le socle technique et le silo Organisation/Utilisateurs d'une plateforme
modulaire de Click & Collect + livraison pour animalerie (« John Commerce »).

---

## Périmètre

### ✅ Inclus

- Next.js + TypeScript strict
- PostgreSQL / Supabase (base, auth, storage, RLS)
- Authentification (connexion / déconnexion)
- Organisations, boutiques, utilisateurs
- Rôles et permissions
- Structure modulaire par domaine
- Migrations versionnées
- Tests de permissions
- Données de démonstration Animalia

### ❌ Exclus (ne pas développer)

Catalogue produit · stock · panier · commande · Click & Collect · livraison ·
paiement · statistiques · marketplace · coursiers à la demande.

---

## Contraintes techniques

- Next.js **App Router**
- **TypeScript strict**
- PostgreSQL
- Supabase (base + auth + storage)
- **Zod** pour la validation
- **Tailwind CSS**
- **Vitest** (unitaires), **Playwright** (fonctionnels critiques)
- Architecture **modulaire par domaine**
- **Aucune** logique métier importante dans les composants React
- **Aucune** dépendance des modules métier vers l'UI
- Migrations versionnées
- **Politiques RLS Supabase**
- Gestion explicite des erreurs
- Journalisation des actions administratives sensibles

---

## Architecture attendue

```
src/
  app/
    (public)/
    (auth)/
    (admin)/
    api/
  modules/
    organizations/
    stores/
    users/
    memberships/
    permissions/
  shared/
    auth/
    database/
    errors/
    validation/
    permissions/
    logging/
    ui/
  tests/
```

---

## Modèle de données

```
Organization
- id
- name
- slug
- status
- createdAt
- updatedAt

Store
- id
- organizationId   → Organization
- name
- slug
- address
- active
- createdAt
- updatedAt

UserProfile
- id
- authUserId        → Supabase auth.users
- firstName
- lastName
- phone
- createdAt
- updatedAt

Membership
- id
- organizationId    → Organization
- userProfileId     → UserProfile
- role
- active
- createdAt
- updatedAt

StoreMembership
- id
- storeId           → Store
- membershipId      → Membership
```

### Relations

- Une `Organization` a N `Store`.
- Un `UserProfile` ↔ Supabase `auth.users` (1‑1 via `authUserId`).
- Un `Membership` relie **un** `UserProfile` à **une** `Organization` avec **un** `role`.
- Un `StoreMembership` rattache un `Membership` à un `Store` (un membre peut couvrir plusieurs boutiques).

---

## Rôles initiaux

`SUPER_ADMIN` · `ORGANIZATION_ADMIN` · `STORE_MANAGER` · `CATALOG_MANAGER` ·
`PREPARER` · `DRIVER` · `CUSTOMER_SUPPORT`

> Les rôles sont **centralisés** (une seule source de vérité) et **jamais**
> comparés à des chaînes dispersées dans le code.

---

## Règles de sécurité

- `SUPER_ADMIN` voit **toutes** les organisations.
- `ORGANIZATION_ADMIN` ne voit **que** son organisation.
- `STORE_MANAGER` ne gère **que** ses boutiques.
- Aucun utilisateur ne peut accéder aux données d'une **autre** organisation.
- Toutes les protections existent **côté serveur ET en base (RLS)**, pas
  seulement dans l'interface.
- Les changements de rôle font l'objet d'un **audit minimal**.

---

## Écrans à construire

| Route | Rôle |
|---|---|
| `/login` | public |
| `/admin` | tableau de bord admin |
| `/admin/organization` | lecture de l'organisation courante |
| `/admin/stores` | création / modification de boutiques |
| `/admin/users` | liste, création/invitation, affectation de rôle, rattachement boutique |
| `/unauthorized` | accès refusé |

---

## Fonctionnalités

- Connexion / déconnexion
- Lecture de l'organisation courante
- Création et modification d'une boutique
- Liste des utilisateurs
- Création d'un utilisateur **ou** préparation d'une invitation
- Affectation d'un rôle
- Rattachement d'un utilisateur à une boutique
- Protection des routes
- Audit minimal des changements de rôles

---

## Données de démonstration

- Organisation : **Animalia**
- Boutique : **Animalia Nouméa**
- Un **administrateur** (ORGANIZATION_ADMIN)
- Un **responsable de boutique** (STORE_MANAGER)
- Un **préparateur** (PREPARER)
- Un **chauffeur** (DRIVER)

---

## Méthode d'exécution

1. Inspecter le dépôt existant avant toute modification.
2. Si le dépôt est vide, initialiser proprement le projet.
3. Produire un plan d'implémentation court.
4. Écrire les **migrations et le domaine avant les écrans**.
5. Implémenter les politiques de sécurité (RLS + serveur).
6. Ajouter les tests.
7. Exécuter lint, typecheck, tests unitaires, tests fonctionnels.
8. Corriger réellement les erreurs.
9. Rapport final : fichiers créés/modifiés · modèle de données · règles de
   sécurité · tests exécutés · limites restantes · prochaines étapes.

---

## Critères de sortie ✅

- [ ] Un administrateur peut se connecter.
- [ ] Animalia existe comme organisation.
- [ ] Une boutique existe (Animalia Nouméa).
- [ ] Un administrateur peut inviter / créer un utilisateur.
- [ ] Chaque utilisateur possède un rôle.
- [ ] Les routes privées sont protégées.
- [ ] Un utilisateur d'une organisation ne peut **pas** accéder aux données d'une autre.
- [ ] Les tests passent.
- [ ] Le projet se déploie.

---

## Après validation

Passer à la **Vague 1 / SILO 2 — Catalogue** (produits, variantes, catégories,
marques, images, import Excel). Pas avant que tous les critères de sortie
ci‑dessus soient verts.
