import { z } from 'zod';

const positiveDecimalId = z.string()
  .regex(/^[1-9]\d*$/, 'Identifiant de bassin invalide');

const cameroonMobileSchema = z.string()
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ''))
  .transform((value) => {
    if (/^6[2-9]\d{7}$/.test(value)) return `+237${value}`;
    if (/^2376[2-9]\d{7}$/.test(value)) return `+${value}`;
    return value;
  })
  .refine((value) => /^\+2376[2-9]\d{7}$/.test(value), {
    message: 'Numéro de téléphone camerounais invalide (+237 6XX XXX XXX)',
  });

/**
 * Données qu'un agent de l'entreprise peut saisir pour initialiser un GIC.
 * Le schéma retire les champs inconnus et normalise le téléphone du leader
 * avant que le service n'écrive en base.
 */
export const createGicSchema = z.object({
  body: z.object({
    gicData: z.object({
      nom: z.string().trim().min(2, 'Le nom du GIC doit contenir au moins 2 caractères').max(100),
      identifiantREF: z.string().trim().min(2, 'La référence du GIC doit contenir au moins 2 caractères').max(50),
      bassinProductionId: positiveDecimalId,
      activitesPrincipales: z.string().trim().min(2, 'Les activités principales sont requises').max(5_000),
      statutLegalisation: z.string().trim().min(2, 'Le statut de légalisation est requis').max(50),
      logoURL: z.string().trim().url('L’URL du logo est invalide').max(250).optional().default(''),
    }).strict(),
    leaderData: z.object({
      nom: z.string().trim().min(2, 'Le nom du leader doit contenir au moins 2 caractères').max(100),
      contact: cameroonMobileSchema,
      pin: z.string().regex(/^\d{4,6}$/, 'Le PIN doit contenir entre 4 et 6 chiffres'),
    }).strict(),
  }).strict(),
});
