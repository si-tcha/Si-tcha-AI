import { z } from 'zod';
import { isValidIsoDate } from '../utils/growthUtils.js';

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
    crop: z
      .string({ message: 'La culture est requise' })
      .trim()
      .min(1, 'La culture est requise')
      .max(100, 'Le nom de la culture ne doit pas dépasser 100 caractères'),
    category: z
      .string({ message: 'La catégorie est requise' })
      .trim()
      .min(1, 'La catégorie est requise')
      .max(100, 'La catégorie ne doit pas dépasser 100 caractères'),
    question: z
      .string({ message: 'La question est requise' })
      .trim()
      .min(5, 'La question doit contenir au moins 5 caractères')
      .max(1000, 'La question ne doit pas dépasser 1000 caractères'),
  }),
});


// ─── Acheteur ────────────────────────────────────────────────────────────────
export const createOrderSchema = z.object({
  body: z.object({
    type: z.enum(['commande_ferme', 'achat_direct', 'reservation'], {
      message: 'Le type de commande est requis',
    }),
    items: z.array(z.object({
      productId: z.string().min(1, "L'identifiant du produit est requis"),
      quantity: z.number().positive('La quantité doit être positive'),
    })).min(1, 'Au moins un article est requis'),
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
const PARCEL_STAGES = ['Semis', 'Levée', 'Floraison', 'Maturation', 'Prêt à récolter', 'Récolté'] as const;

export const createParcelSchema = z.object({
  body: z
    .object({
      parcelName: z
        .string({ message: 'Le nom de la parcelle est requis' })
        .trim()
        .min(1, 'Le nom de la parcelle est requis')
        .max(200, 'Le nom de la parcelle ne doit pas dépasser 200 caractères'),
      crop: z
        .string({ message: 'La culture est requise' })
        .trim()
        .min(1, 'La culture est requise')
        .max(100, 'Le nom de la culture ne doit pas dépasser 100 caractères'),
      sowingDate: z
        .string({ message: 'La date de semis est requise' })
        .trim()
        .refine(isValidIsoDate, {
          message: 'Date de semis invalide (format YYYY-MM-DD attendu)',
        }),
      stage: z.enum(PARCEL_STAGES, {
        message: 'Étape de croissance invalide',
      }).default('Semis'),
      estimatedHarvestDate: z
        .string({ message: 'La date de récolte estimée est requise' })
        .trim()
        .refine(isValidIsoDate, {
          message: 'Date de récolte estimée invalide (format YYYY-MM-DD attendu)',
        }),
      estimatedVolumeKg: z
        .number({ message: 'Le volume estimé est requis' })
        .positive('Le volume estimé doit être strictement supérieur à 0 kg'),
      actualHarvestVolumeKg: z
        .number({ message: 'Le volume réel récolté doit être un nombre valide' })
        .min(0, 'Le volume réel récolté doit être supérieur ou égal à 0 kg')
        .nullable()
        .optional(),
      actualHarvestDate: z
        .string()
        .trim()
        .refine(isValidIsoDate, {
          message: 'Date de récolte réelle invalide (format YYYY-MM-DD attendu)',
        })
        .nullable()
        .optional(),
    })
    .refine(
      (data) => data.estimatedHarvestDate >= data.sowingDate,
      {
        message: 'La date de récolte estimée ne peut pas être antérieure à la date de semis',
        path: ['estimatedHarvestDate'],
      }
    )
    .refine(
      (data) => !data.actualHarvestDate || data.actualHarvestDate >= data.sowingDate,
      {
        message: 'La date de récolte réelle ne peut pas être antérieure à la date de semis',
        path: ['actualHarvestDate'],
      }
    ),
});

export const updateParcelSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Identifiant de parcelle requis'),
  }),
  body: z
    .object({
      parcelName: z
        .string()
        .trim()
        .min(1, 'Le nom de la parcelle ne peut pas être vide')
        .max(200, 'Le nom de la parcelle ne doit pas dépasser 200 caractères')
        .optional(),
      crop: z
        .string()
        .trim()
        .min(1, 'La culture ne peut pas être vide')
        .max(100, 'La culture ne doit pas dépasser 100 caractères')
        .optional(),
      sowingDate: z
        .string()
        .trim()
        .refine(isValidIsoDate, {
          message: 'Date de semis invalide (format YYYY-MM-DD attendu)',
        })
        .optional(),
      stage: z.enum(PARCEL_STAGES, {
        message: 'Étape de croissance invalide',
      }).optional(),
      estimatedHarvestDate: z
        .string()
        .trim()
        .refine(isValidIsoDate, {
          message: 'Date de récolte estimée invalide (format YYYY-MM-DD attendu)',
        })
        .optional(),
      estimatedVolumeKg: z
        .number({ message: 'Le volume estimé doit être un nombre valide' })
        .positive('Le volume estimé doit être strictement supérieur à 0 kg')
        .optional(),
      actualHarvestVolumeKg: z
        .number({ message: 'Le volume réel récolté doit être un nombre valide' })
        .min(0, 'Le volume réel récolté doit être supérieur ou égal à 0 kg')
        .nullable()
        .optional(),
      actualHarvestDate: z
        .string()
        .trim()
        .refine(isValidIsoDate, {
          message: 'Date de récolte réelle invalide (format YYYY-MM-DD attendu)',
        })
        .nullable()
        .optional(),
    })
    .refine(
      (data) => {
        if (data.sowingDate && data.estimatedHarvestDate) {
          return data.estimatedHarvestDate >= data.sowingDate;
        }
        return true;
      },
      {
        message: 'La date de récolte estimée ne peut pas être antérieure à la date de semis',
        path: ['estimatedHarvestDate'],
      }
    )
    .refine(
      (data) => {
        if (data.sowingDate && data.actualHarvestDate) {
          return data.actualHarvestDate >= data.sowingDate;
        }
        return true;
      },
      {
        message: 'La date de récolte réelle ne peut pas être antérieure à la date de semis',
        path: ['actualHarvestDate'],
      }
    ),
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
