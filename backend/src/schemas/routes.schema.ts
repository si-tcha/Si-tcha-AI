import { z } from 'zod';

// ─── Catalogue ───────────────────────────────────────────────────────────────
export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

// ─── GIC / Vendeur ───────────────────────────────────────────────────────────
export const createHarvestSchema = z.object({
  body: z.object({
    product: z.string().min(1, 'Le nom du produit est requis'),
    volume: z.number({ message: 'Le volume est requis' }).positive('Le volume doit être positif'),
  }),
});

export const createExpenseSchema = z.object({
  body: z.object({
    label: z.string().min(1, 'Le libellé est requis'),
    amount: z.number({ message: 'Le montant est requis' }).positive('Le montant doit être positif'),
    category: z.string().min(1, 'La catégorie est requise'),
  }),
});

export const createGicNeedSchema = z.object({
  body: z.object({
    id: z.string().min(1, 'ID requis'),
    category: z.string().min(1, 'Catégorie requise'),
    description: z.string().min(1, 'Description requise'),
    updatedAt: z.string().optional(),
    authorRole: z.string().optional(),
  }),
});

export const updateGicProfileSchema = z.object({
  body: z.object({
    surfaceHa: z.number().positive().optional(),
    bassin: z.string().optional(),
    statutLegalisation: z.string().optional(),
    activitesPrincipales: z.string().optional(),
    reglementInterieur: z.string().optional(),
  }),
});

// ─── Agronome IA ─────────────────────────────────────────────────────────────
export const askAgronomistSchema = z.object({
  body: z.object({
    crop: z.string().min(1, 'La culture est requise'),
    category: z.string().min(1, 'La catégorie est requise'),
    question: z.string().min(5, 'La question doit contenir au moins 5 caractères'),
  }),
});

// ─── Acheteur ────────────────────────────────────────────────────────────────
export const createOrderSchema = z.object({
  body: z.object({
    type: z.enum(['commande_ferme', 'achat_direct', 'reservation'], {
      message: 'Le type de commande est requis',
    }),
    items: z.array(z.object({
      productId: z
        .string()
        .min(1, "L'identifiant du produit est requis")
        .regex(/^\d+$/, "L'identifiant de l'offre doit être un entier numérique")
        .refine((val) => {
          try {
            const b = BigInt(val);
            return b > 0n && b <= 9223372036854775807n;
          } catch {
            return false;
          }
        }, "L'identifiant d'offre est hors plage BigInt"),
      quantity: z
        .number({ message: 'La quantité doit être un nombre' })
        .positive('La quantité doit être positive')
        .max(1000000, 'La quantité maximale par article est dépassée (1 000 000 max)'),
    })).min(1, 'Au moins un article est requis').max(50, 'Le nombre d\'articles par commande est limité à 50'),
    clientRequestId: z
      .string({ message: "L'identifiant de requête client (clientRequestId) est requis" })
      .uuid("L'identifiant de requête client (clientRequestId) doit être un UUID valide")
      .max(100, "L'identifiant de requête client ne doit pas dépasser 100 caractères"),
  }),
});

export const updateAlertPreferencesSchema = z.object({
  body: z.object({
    productNames: z.array(z.string()).optional().default([]),
    bassins: z.array(z.string()).optional().default([]),
  }),
});

// ─── B2B Marketplace ─────────────────────────────────────────────────────────
export const createB2BOfferSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Le titre est requis'),
    type: z.string().min(1, 'Le type est requis'),
    category: z.string().optional().default(''),
    priceOrExchange: z.string().min(1, 'Le tarif ou échange est requis'),
    gicName: z.string().optional().default(''),
    location: z.string().optional().default(''),
    contact: z.string().optional().default(''),
  }),
});

// ─── Parcelles / Journal de croissance ───────────────────────────────────────
export const createParcelSchema = z.object({
  body: z.object({
    parcelName: z.string().min(1, 'Le nom de la parcelle est requis'),
    crop: z.string().min(1, 'La culture est requise'),
    sowingDate: z.string().optional().default(''),
    stage: z.string().optional().default('Semis'),
    estimatedHarvestDate: z.string().optional().default(''),
    estimatedVolumeKg: z.number().optional().default(0),
    actualHarvestVolumeKg: z.number().nullable().optional(),
  }),
});

// ─── Préfinancement ──────────────────────────────────────────────────────────
export const createPrefinancingDealSchema = z.object({
  body: z.object({
    gicName: z.string().optional().default(''),
    buyerName: z.string().optional().default(''),
    amountFcfa: z.number({ message: 'Le montant est requis' }).positive('Le montant doit être positif'),
    inputDescription: z.string().min(1, 'La description des intrants est requise'),
    reservedProduct: z.string().optional().default(''),
    reservedVolumeKg: z.number().optional().default(0),
  }),
});

// ─── Évaluations de confiance ────────────────────────────────────────────────
export const createTrustRatingSchema = z.object({
  body: z.object({
    targetId: z.string().min(1, "L'identifiant de la cible est requis"),
    targetType: z.string().min(1, 'Le type de cible est requis'),
    rating: z.number().int().min(1, 'La note minimum est 1').max(5, 'La note maximum est 5'),
    comment: z.string().min(1, 'Le commentaire est requis'),
    authorName: z.string().optional(),
  }),
});
