import rateLimit from 'express-rate-limit';
import { getConfig } from '../config/env.js';

export function createApiLimiter(options?: { windowMs?: number; max?: number }) {
  const config = getConfig();
  const windowMs = options?.windowMs ?? config.RATE_LIMIT_WINDOW_MS;
  const max =
    options?.max ??
    (config.NODE_ENV === 'test' ? 5000 : config.RATE_LIMIT_MAX);

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer plus tard.',
    },
  });
}

export function createAuthLimiter(options?: { windowMs?: number; max?: number }) {
  const config = getConfig();
  const windowMs = options?.windowMs ?? (15 * 60 * 1000);
  const max =
    options?.max ??
    (config.NODE_ENV === 'test' ? 1000 : config.AUTH_RATE_LIMIT_MAX);

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: 'Trop de tentatives de connexion, veuillez réessayer plus tard.',
    },
  });
}

// Limiteur de requêtes de base pour les endpoints API
export const apiLimiter = createApiLimiter();

// Limiteur plus strict pour l'authentification (prévention de brute-force)
export const authLimiter = createAuthLimiter();

// Limiteur strict pour l'OTP
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 15 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Trop de demandes de code OTP. Veuillez patienter avant de réessayer.',
  },
});
