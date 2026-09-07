import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import * as http from 'http';
import express from 'express';
import { createApp } from '../src/app.js';
import { validateConfig, parseCorsOrigins, parseTrustProxy } from '../src/config/env.js';
import { logger, SENSITIVE_PATHS } from '../src/middlewares/logger.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { securityHeaders } from '../src/middlewares/security.js';
import prisma from '../src/lib/prisma.js';
import { gracefulShutdown } from '../src/lifecycle.js';

describe('Bloc 5 — Tests de Préparation Production Backend', () => {
  const baseValidProdEnv = {
    NODE_ENV: 'production',
    PORT: '4000',
    DATABASE_URL: 'postgresql://prod_user:secret_prod_pw@db.sitcha.org:5432/sitcha_prod?schema=public',
    JWT_SECRET: 'super-secure-production-jwt-secret-key-that-is-long-enough-32',
    CORS_ORIGIN: 'https://sitcha.app,https://admin.sitcha.app',
    BODY_LIMIT: '1mb',
    TRUST_PROXY: '1',
    LOG_LEVEL: 'info',
    OTP_PROVIDER: 'disabled',
  };

  describe('1. Validation typée et sécurisée de la configuration (Zod)', () => {
    it('Refuse de démarrer en production si JWT_SECRET est absent ou vide', () => {
      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          JWT_SECRET: '',
        });
      }).toThrowError(/JWT_SECRET est obligatoire/);
    });

    it('Refuse de démarrer en production si JWT_SECRET est inférieur à 32 caractères', () => {
      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          JWT_SECRET: 'trop-court-1234567890',
        });
      }).toThrowError(/JWT_SECRET est trop faible pour la production/);
    });

    it('Refuse de démarrer en production si JWT_SECRET utilise un secret trivial ou par défaut', () => {
      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          JWT_SECRET: 'your-secure-random-secret-here',
        });
      }).toThrowError(/JWT_SECRET utilise une valeur par défaut ou faible/);

      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          JWT_SECRET: 'dev-jwt-secret-placeholder-minimum-32-chars-key',
        });
      }).toThrowError(/JWT_SECRET utilise une valeur par défaut ou faible/);
    });

    it('Refuse de démarrer en production si CORS_ORIGIN est absent ou vide', () => {
      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          CORS_ORIGIN: '',
        });
      }).toThrowError(/CORS_ORIGIN est obligatoire en production/);
    });

    it("Refuse de démarrer en production si CORS_ORIGIN contient '*'", () => {
      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          CORS_ORIGIN: 'https://sitcha.app,*',
        });
      }).toThrowError(/CORS_ORIGIN ne peut pas contenir '\*'/);
    });

    it('Valide avec succès une configuration de production complète', () => {
      const config = validateConfig(baseValidProdEnv);
      expect(config.NODE_ENV).toBe('production');
      expect(config.PORT).toBe(4000);
      expect(config.allowedCorsOrigins).toEqual(['https://sitcha.app', 'https://admin.sitcha.app']);
      expect(config.TRUST_PROXY).toBe(1);
    });

    it('Fournit des valeurs par défaut sécurisées en développement et test', () => {
      const devConfig = validateConfig({ NODE_ENV: 'development' });
      expect(devConfig.PORT).toBe(4000);
      expect(devConfig.JWT_SECRET).toBe('dev-jwt-secret-placeholder-minimum-32-chars-key');
      expect(devConfig.allowedCorsOrigins).toEqual([]);
      expect(devConfig.TRUST_PROXY).toBe(false);
    });

    it('Parse correctement les différentes valeurs de trust proxy', () => {
      expect(parseTrustProxy('true')).toBe(true);
      expect(parseTrustProxy('1')).toBe(1);
      expect(parseTrustProxy('false')).toBe(false);
      expect(parseTrustProxy('loopback')).toBe('loopback');
      expect(parseTrustProxy('2')).toBe(2);
      expect(parseTrustProxy(undefined)).toBe(false);
    });
  });

  describe('2. Sécurité CORS et Headers HTTP', () => {
    const prodConfig = validateConfig(baseValidProdEnv);
    const prodApp = createApp(prodConfig);

    it('Production: Autorise les requêtes provenant d’une origine autorisée dans la liste blanche', async () => {
      const res = await request(prodApp)
        .get('/api/health')
        .set('Origin', 'https://sitcha.app');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://sitcha.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('Production: Rejette les requêtes provenant d’une origine non autorisée (403)', async () => {
      const res = await request(prodApp)
        .get('/api/health')
        .set('Origin', 'https://malicious-attacker.com');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/CORS/i);
    });

    it('Production: Autorise les requêtes sans header Origin (applications mobiles natives, curl)', async () => {
      const res = await request(prodApp).get('/api/health');
      expect(res.status).toBe(200);
    });

    it('Développement: Autorise les origines locales ou variées', async () => {
      const devApp = createApp(validateConfig({ NODE_ENV: 'development' }));
      const res = await request(devApp)
        .get('/api/health')
        .set('Origin', 'http://localhost:8081');

      expect(res.status).toBe(200);
    });

    it('Headers de sécurité OWASP obligatoires présents sur les réponses HTTP', async () => {
      const res = await request(prodApp).get('/api/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-xss-protection']).toBe('0');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');

      // Aucune divulgation de la signature Express
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('3. Journalisation structurée et masquage des données sensibles', () => {
    it('Pino redact masque automatiquement PIN, password, token, otp, secret et Authorization', () => {
      expect(SENSITIVE_PATHS).toContain('pin');
      expect(SENSITIVE_PATHS).toContain('password');
      expect(SENSITIVE_PATHS).toContain('token');
      expect(SENSITIVE_PATHS).toContain('otp');
      expect(SENSITIVE_PATHS).toContain('secret');
      expect(SENSITIVE_PATHS).toContain('req.headers.authorization');
      expect(SENSITIVE_PATHS).toContain('req.headers.cookie');
      expect(SENSITIVE_PATHS).toContain('req.body.pin');
      expect(SENSITIVE_PATHS).toContain('req.body.password');
      expect(SENSITIVE_PATHS).toContain('req.body.token');
      expect(SENSITIVE_PATHS).toContain('req.body.otp');
      expect(SENSITIVE_PATHS).toContain('*.pin');
      expect(SENSITIVE_PATHS).toContain('*.password');
      expect(SENSITIVE_PATHS).toContain('*.token');
    });
  });

  describe('4. Healthcheck de processus et Readiness probe', () => {
    const app = createApp();

    it('GET /api/health et /api/health/live retournent 200 UP avec uptime', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.timestamp).toBeDefined();
      expect(typeof res.body.uptime).toBe('number');

      const liveRes = await request(app).get('/api/health/live');
      expect(liveRes.status).toBe(200);
      expect(liveRes.body.status).toBe('UP');
    });

    it('GET /api/health/ready retourne 200 quand la base de données est accessible', async () => {
      vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '1': 1 }] as any);

      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.database).toBe('UP');
      expect(res.body.timestamp).toBeDefined();
    });

    it('GET /api/health/ready retourne 503 DOWN sans fuite de secrets quand la base est inaccessible', async () => {
      vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(
        new Error('Connection terminated unexpectedly to postgresql://user:secret@db:5432')
      );

      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DOWN');
      expect(res.body.database).toBe('DOWN');
      expect(res.body.error).toBe('Base de données inaccessible');
      // Vérification absolue : aucune fuite d'identifiants de connexion dans la réponse JSON
      expect(JSON.stringify(res.body)).not.toContain('secret');
      expect(JSON.stringify(res.body)).not.toContain('db:5432');
    });
  });

  describe('5. Gestion centralisée des erreurs et absence de stack trace en production', () => {
    it('En production, les erreurs 500 renvoient un message générique sans exposer de stack trace', async () => {
      const app = express();
      app.get('/test-internal-error', (req, res, next) => {
        const error = new Error('Database password was incorrect in internal memory');
        (error as any).stack = 'Error at SecretModule (/usr/src/app/secret.ts:42:1)';
        next(error);
      });
      // Appliquer errorHandler en simulant NODE_ENV=production
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      app.use(errorHandler);

      try {
        const res = await request(app).get('/test-internal-error');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Une erreur interne est survenue.');
        expect(res.body.stack).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('SecretModule');
        expect(JSON.stringify(res.body)).not.toContain('Database password');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('Rejette les formats JSON malformés avec un message propre (400)', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ malformed json');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Format de requête JSON invalide');
    });
  });

  describe('6. Arrêt propre (Graceful Shutdown)', () => {
    it('Ferme le serveur HTTP et déconnecte le client Prisma proprement', async () => {
      const dummyServer = http.createServer();
      await new Promise<void>((resolve) => dummyServer.listen(0, resolve));

      const disconnectSpy = vi.spyOn(prisma, '$disconnect').mockResolvedValueOnce();

      await gracefulShutdown({ server: dummyServer, timeoutMs: 2000 });

      expect(dummyServer.listening).toBe(false);
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
