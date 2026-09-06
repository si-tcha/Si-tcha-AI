import { z } from 'zod';

// Numéro de téléphone camerounais: 9 chiffres (6xxxxxxxx ou 2xxxxxxxx)
const phoneSchema = z.string()
  .min(9, 'Le numéro de téléphone est trop court')
  .max(16, 'Le numéro de téléphone est trop long')
  .regex(/^\+?237[26]\d{8}$|^[26]\d{8}$/, 'Numéro de téléphone camerounais invalide (+237 6XX XXX XXX)');

// Code PIN : 4 à 6 chiffres
const pinSchema = z.string().regex(/^\d{4,6}$/, 'Le code PIN doit contenir entre 4 et 6 chiffres');

export const registerBuyerSchema = z.object({
  body: z.object({
    companyName: z.string().min(2, 'Le nom de l\'entreprise doit contenir au moins 2 caractères'),
    phone: phoneSchema,
    pin: pinSchema,
    address: z.string().optional(),
  }),
});

export const registerSellerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Le nom complet doit contenir au moins 2 caractères'),
    phone: phoneSchema,
    pin: pinSchema,
    gicName: z.string().min(2, 'Le nom du GIC doit contenir au moins 2 caractères'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    pin: pinSchema,
    role: z.enum(['buyer', 'seller']).optional(),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    code: z.string().regex(/^\d{6}$/, 'Le code OTP doit contenir 6 chiffres'),
    role: z.enum(['buyer', 'seller'], {
      message: "Rôle requis ('buyer' ou 'seller').",
    }),
  }),
});
