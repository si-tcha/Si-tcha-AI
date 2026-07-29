import rateLimit from 'express-rate-limit';

// Base rate limit for standard API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 5000 requests per window during dev
  message: {
    message: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer plus tard.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limit for authentication endpoints (prevent brute-force)
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each IP to 1000 login/register requests per hour during dev
  message: {
    message: 'Trop de tentatives de connexion, veuillez réessayer dans une heure.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
