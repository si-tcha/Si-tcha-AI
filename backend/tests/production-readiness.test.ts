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

    it('Refuse de démarrer en production si BODY_LIMIT est supérieur à 10MB ou invalide', () => {
      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          BODY_LIMIT: '15mb',
        });
      }).toThrowError(/BODY_LIMIT trop élevé/);

      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          BODY_LIMIT: 'invalid-size',
        });
      }).toThrowError(/Format de BODY_LIMIT invalide/);
    });

    it('Refuse de démarrer en production si OTP_PROVIDER est development ou test', () => {
      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          OTP_PROVIDER: 'development',
        });
      }).toThrowError(/est strictement interdit en production/);

      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          OTP_PROVIDER: 'test',
        });
      }).toThrowError(/est strictement interdit en production/);
    });

    it('Refuse de démarrer en production si CORS_ORIGIN contient des URLs HTTP non chiffrées ou null', () => {
      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          CORS_ORIGIN: 'http://sitcha.app',
        });
      }).toThrowError(/Origine CORS invalide/);

      expect(() => {
        validateConfig({
          ...baseValidProdEnv,
          CORS_ORIGIN: 'null',
        });
      }).toThrowError(/Origine CORS invalide/);
    });

    it('Déduplique et normalise les origines CORS valides en production', () => {
      const config = validateConfig({
        ...baseValidProdEnv,
        CORS_ORIGIN: 'https://sitcha.app/, https://admin.sitcha.app, https://sitcha.app',
      });
      expect(config.allowedCorsOrigins).toEqual(['https://sitcha.app', 'https://admin.sitcha.app']);
    });

    it('Valide avec succès une configuration de production complète', () => {
      const config = validateConfig(baseValidProdEnv);
      expect(config.NODE_ENV).toBe('production');
      expect(config.PORT).toBe(4000);
      expect(config.allowedCorsOrigins).toEqual(['https://sitcha.app', 'https://admin.sitcha.app']);
      expect(config.TRUST_PROXY).toBe(1);
      expect(config.ENABLE_API_DOCS).toBe(false);
    });

    it('Fournit des valeurs par défaut sécurisées en développement et test', () => {
      const devConfig = validateConfig({ NODE_ENV: 'development' });
      expect(devConfig.PORT).toBe(4000);
      expect(devConfig.JWT_SECRET).toBe('dev-jwt-secret-placeholder-minimum-32-chars-key');
      expect(devConfig.allowedCorsOrigins).toEqual([]);
      expect(devConfig.TRUST_PROXY).toBe(false);
      expect(devConfig.ENABLE_API_DOCS).toBe(true);
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

  describe('3. Journalisation structurée et masquage des données sensibles (Pino Memory Stream)', () => {
    it('Pino redact paths couvrent tous les champs critiques', () => {
      expect(SENSITIVE_PATHS).toContain('pin');
      expect(SENSITIVE_PATHS).toContain('password');
      expect(SENSITIVE_PATHS).toContain('token');
      expect(SENSITIVE_PATHS).toContain('otp');
      expect(SENSITIVE_PATHS).toContain('secret');
      expect(SENSITIVE_PATHS).toContain('req.headers.authorization');
      expect(SENSITIVE_PATHS).toContain('req.headers.cookie');
      expect(SENSITIVE_PATHS).toContain('databaseUrl');
    });

    it('sanitizeDataRecursively assainit récursivement à toute profondeur sans muter l’objet original', async () => {
      const { sanitizeDataRecursively } = await import('../src/middlewares/logger.js');

      const original = {
        level1: {
          level2: {
            level3: {
              password: 'super-secret-password-123',
              apiKey: 'api-key-xyz-789',
              nestedArray: [
                { pin: '4321', label: 'safe-label' },
                { connectionString: 'postgresql://admin:secretPass@localhost:5432/db' },
              ],
            },
          },
        },
        safeProperty: 'hello world',
      };

      const clonedBefore = JSON.parse(JSON.stringify(original));
      const sanitized = sanitizeDataRecursively(original);

      // 1. Non-mutation stricte de l'original
      expect(original).toEqual(clonedBefore);
      expect(original.level1.level2.level3.password).toBe('super-secret-password-123');
      expect(original.level1.level2.level3.apiKey).toBe('api-key-xyz-789');
      expect(original.level1.level2.level3.nestedArray[0].pin).toBe('4321');

      // 2. Assainissement récursif complet
      expect(sanitized.level1.level2.level3.password).toBe('[REDACTED]');
      expect(sanitized.level1.level2.level3.apiKey).toBe('[REDACTED]');
      expect(sanitized.level1.level2.level3.nestedArray[0].pin).toBe('[REDACTED]');
      expect(sanitized.level1.level2.level3.nestedArray[0].label).toBe('safe-label');
      expect(sanitized.level1.level2.level3.nestedArray[1].connectionString).toContain('[REDACTED_SECRET]');
      expect(sanitized.safeProperty).toBe('hello world');
    });

    it('Preuve réelle de masquage récursif via flux mémoire Pino avec sentinelles et non-mutation', async () => {
      const { Writable } = await import('stream');
      const pinoModule = await import('pino');
      const pino = pinoModule.default || pinoModule;
      const { sanitizeErrorForLog, sanitizeLogString, sanitizeDataRecursively } = await import(
        '../src/middlewares/logger.js'
      );

      let emittedLogs = '';
      const memStream = new Writable({
        write(chunk, _encoding, callback) {
          emittedLogs += chunk.toString();
          callback();
        },
      });

      const testLogger = (pino as any)(
        {
          level: 'info',
          redact: {
            paths: SENSITIVE_PATHS,
            censor: '[REDACTED]',
          },
          formatters: {
            log(obj: Record<string, any>) {
              return sanitizeDataRecursively(obj);
            },
          },
          serializers: {
            err: sanitizeErrorForLog,
            error: sanitizeErrorForLog,
          },
          hooks: {
            logMethod(inputArgs: any[], method: any) {
              const sanitizedArgs = inputArgs.map((arg) => {
                if (typeof arg === 'string') {
                  return sanitizeLogString(arg);
                }
                if (arg instanceof Error) {
                  return arg;
                }
                if (arg && typeof arg === 'object') {
                  return sanitizeDataRecursively(arg);
                }
                return arg;
              });

              if (inputArgs.length === 1 && inputArgs[0] instanceof Error) {
                return method.call(this, { err: inputArgs[0] }, sanitizeLogString(inputArgs[0].message));
              }

              return method.apply(this, sanitizedArgs);
            },
          },
        },
        memStream
      );

      // Sentinelles hautement reconnaissables à différentes profondeurs
      const DB_PASSWORD_SENTINEL = 'SuperSecretDbPassword42!';
      const STACK_SECRET_SENTINEL = 'internal_secret_token_in_stack_trace_999';
      const BEARER_SENTINEL = 'bearer_sentinel_xyz123abc';
      const COOKIE_SENTINEL = 'cookie_sentinel_secret_val_456';
      const PIN_SENTINEL = '9876';
      const OTP_SENTINEL = '543210';
      const DEEP_API_KEY_SENTINEL = 'deep_secret_api_key_888';
      const NESTED_PASSWORD_SENTINEL = 'nested_secret_pwd_777';

      // 1. Log d'un objet métier multi-niveaux avec secrets imbriqués
      const businessObject = {
        txId: 'tx-001',
        meta: {
          level1: {
            level2: {
              level3: {
                password: NESTED_PASSWORD_SENTINEL,
                apiKey: DEEP_API_KEY_SENTINEL,
                databaseUrl: `postgresql://user:${DB_PASSWORD_SENTINEL}@db:5432/db`,
              },
            },
          },
        },
        items: [
          { name: 'Item 1', credentials: { pin: PIN_SENTINEL, otp: OTP_SENTINEL } },
        ],
        req: {
          headers: {
            authorization: `Bearer ${BEARER_SENTINEL}`,
            cookie: `session_id=${COOKIE_SENTINEL}`,
          },
        },
      };

      testLogger.info(businessObject, 'Opération métier avec données imbriquées');

      // 2. Log d'une erreur contenant un secret de connexion et une stack trace sensible
      const originalErrorMsg = `Connection failed to postgresql://sitcha_user:${DB_PASSWORD_SENTINEL}@db:5432/sitcha_db`;
      const originalErrorStack = `Error: Connection failed\n    at SecretAuth (/app/auth.js:10:5)\n    at token=${STACK_SECRET_SENTINEL}`;
      const sensitiveError = new Error(originalErrorMsg);
      sensitiveError.stack = originalErrorStack;

      testLogger.error({ err: sensitiveError });

      // Vérification 1 : NON-MUTATION stricte des objets originaux
      expect(sensitiveError.message).toBe(originalErrorMsg);
      expect(sensitiveError.stack).toBe(originalErrorStack);
      expect(businessObject.meta.level1.level2.level3.password).toBe(NESTED_PASSWORD_SENTINEL);
      expect(businessObject.meta.level1.level2.level3.apiKey).toBe(DEEP_API_KEY_SENTINEL);
      expect(businessObject.items[0].credentials.pin).toBe(PIN_SENTINEL);

      // Vérification 2 : AUCUNE des sentinelles ne doit apparaître dans la sortie textuelle brute
      expect(emittedLogs).not.toContain(DB_PASSWORD_SENTINEL);
      expect(emittedLogs).not.toContain(STACK_SECRET_SENTINEL);
      expect(emittedLogs).not.toContain(BEARER_SENTINEL);
      expect(emittedLogs).not.toContain(COOKIE_SENTINEL);
      expect(emittedLogs).not.toContain(PIN_SENTINEL);
      expect(emittedLogs).not.toContain(OTP_SENTINEL);
      expect(emittedLogs).not.toContain(DEEP_API_KEY_SENTINEL);
      expect(emittedLogs).not.toContain(NESTED_PASSWORD_SENTINEL);

      // Vérification 3 : Présence des marqueurs de censure
      expect(emittedLogs).toContain('[REDACTED]');
      expect(emittedLogs).toContain('[REDACTED_SECRET]');
    });

    it('Préserve les références partagées non-cycliques (DAG) sans les marquer [CIRCULAR] et détecte les vrais cycles', async () => {
      const { sanitizeDataRecursively } = await import('../src/middlewares/logger.js');

      // 1. Référence partagée non cyclique (même objet référencé à 2 endroits distincts dans un DAG)
      const sharedAccount = {
        accountId: 'acc-42',
        password: 'shared-password-secret-xyz',
        balance: 1000,
      };
      const transactionPayload = {
        source: sharedAccount,
        destination: sharedAccount,
        metadata: { audit: sharedAccount },
      };

      const clonedBefore = JSON.parse(JSON.stringify(transactionPayload));
      const sanitizedDag = sanitizeDataRecursively(transactionPayload);

      // Non-mutation de l'original
      expect(transactionPayload).toEqual(clonedBefore);
      expect(sharedAccount.password).toBe('shared-password-secret-xyz');

      // Les références répétées non-cycliques sont assainies et NON marquées [CIRCULAR]
      expect(sanitizedDag.source.accountId).toBe('acc-42');
      expect(sanitizedDag.source.password).toBe('[REDACTED]');
      expect(sanitizedDag.source).not.toBe('[CIRCULAR]');

      expect(sanitizedDag.destination.accountId).toBe('acc-42');
      expect(sanitizedDag.destination.password).toBe('[REDACTED]');
      expect(sanitizedDag.destination).not.toBe('[CIRCULAR]');

      expect(sanitizedDag.metadata.audit.accountId).toBe('acc-42');
      expect(sanitizedDag.metadata.audit.password).toBe('[REDACTED]');
      expect(sanitizedDag.metadata.audit).not.toBe('[CIRCULAR]');

      // 2. Vrai cycle direct (auto-référence)
      const directCycle: any = { id: 'direct-01', secret: 'abc' };
      directCycle.self = directCycle;
      const sanitizedDirect = sanitizeDataRecursively(directCycle);
      expect(sanitizedDirect.id).toBe('direct-01');
      expect(sanitizedDirect.secret).toBe('[REDACTED]');
      expect(sanitizedDirect.self).toBe('[CIRCULAR]');

      // 3. Vrai cycle indirect (A -> B -> A)
      const cycleA: any = { name: 'A' };
      const cycleB: any = { name: 'B', toA: cycleA };
      cycleA.toB = cycleB;
      const sanitizedIndirect = sanitizeDataRecursively(cycleA);
      expect(sanitizedIndirect.name).toBe('A');
      expect(sanitizedIndirect.toB.name).toBe('B');
      expect(sanitizedIndirect.toB.toA).toBe('[CIRCULAR]');
    });

    it('errorHandler ne logge que des métadonnées bornées : absence de body/sentinelles/socket/server et présence des métadonnées permises', async () => {
      const { Writable } = await import('stream');
      const pinoModule = await import('pino');
      const pino = pinoModule.default || pinoModule;
      const { sanitizeErrorForLog, sanitizeLogString, sanitizeDataRecursively } = await import(
        '../src/middlewares/logger.js'
      );

      let errorHandlerLogs = '';
      const memStream = new Writable({
        write(chunk, _encoding, callback) {
          errorHandlerLogs += chunk.toString();
          callback();
        },
      });

      const auditLogger = (pino as any)(
        {
          level: 'info',
          redact: {
            paths: SENSITIVE_PATHS,
            censor: '[REDACTED]',
          },
          formatters: {
            log(obj: Record<string, any>) {
              return sanitizeDataRecursively(obj);
            },
          },
          serializers: {
            err: sanitizeErrorForLog,
          },
          hooks: {
            logMethod(inputArgs: any[], method: any) {
              const sanitizedArgs = inputArgs.map((arg) => {
                if (typeof arg === 'string') return sanitizeLogString(arg);
                if (arg instanceof Error) return arg;
                if (arg && typeof arg === 'object') return sanitizeDataRecursively(arg);
                return arg;
              });
              return method.apply(this, sanitizedArgs);
            },
          },
        },
        memStream
      );

      // Espionner le logger dans errorHandler
      const loggerModule = await import('../src/middlewares/logger.js');
      const originalErrorMethod = loggerModule.logger.error;
      const originalWarnMethod = loggerModule.logger.warn;
      (loggerModule.logger as any).error = (...args: any[]) => (auditLogger as any).error(...args);
      (loggerModule.logger as any).warn = (...args: any[]) => (auditLogger as any).warn(...args);

      try {
        const BODY_SECRET = 'BODY_PASSWORD_DO_NOT_LOG_987654';
        const COOKIE_SECRET = 'COOKIE_SECRET_NEVER_LEAK_321';
        const SOCKET_INTERNAL_SENTINEL = 'socket_internal_buffer_leak_test';

        // Simuler un objet Request Express complet avec body, headers, socket et structures internes
        const mockReq: any = {
          id: 'req-prod-audit-42',
          method: 'POST',
          originalUrl: '/api/sensitive/action',
          url: '/api/sensitive/action',
          ip: '203.0.113.195',
          user: { id: 'usr-987' },
          body: {
            password: BODY_SECRET,
            pin: '1234',
            personalNote: 'Confidential message',
          },
          headers: {
            authorization: 'Bearer token_super_secret_auth',
            cookie: `session_id=${COOKIE_SECRET}`,
          },
          socket: {
            remoteAddress: '203.0.113.195',
            internalBuffer: SOCKET_INTERNAL_SENTINEL,
            server: { maxConnections: 1000, internalProp: 'server_leak' },
          },
          server: { activeConnections: 5 },
        };

        const mockRes: any = {
          statusCode: 500,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(payload: any) {
            this.payload = payload;
            return this;
          },
        };

        const testError = new Error('Database query timed out');
        testError.stack = 'Error: Database query timed out\n  at runQuery (/app/query.ts:15:9)';

        // Cloner avant pour tester la non-mutation
        const reqClonedBefore = JSON.parse(JSON.stringify({
          id: mockReq.id,
          method: mockReq.method,
          originalUrl: mockReq.originalUrl,
          body: mockReq.body,
        }));

        errorHandler(testError, mockReq as any, mockRes as any, (() => {}) as any);

        // 1. Non-mutation stricte
        expect(mockReq.body.password).toBe(BODY_SECRET);
        expect(mockReq.id).toBe(reqClonedBefore.id);

        // 2. Absence totale des données de body, cookies et sentinelles
        expect(errorHandlerLogs).not.toContain(BODY_SECRET);
        expect(errorHandlerLogs).not.toContain(COOKIE_SECRET);
        expect(errorHandlerLogs).not.toContain('token_super_secret_auth');
        expect(errorHandlerLogs).not.toContain('Confidential message');

        // 3. Absence totale des objets internes socket et server
        expect(errorHandlerLogs).not.toContain(SOCKET_INTERNAL_SENTINEL);
        expect(errorHandlerLogs).not.toContain('server_leak');
        expect(errorHandlerLogs).not.toContain('maxConnections');
        expect(errorHandlerLogs).not.toContain('activeConnections');

        // 4. Présence stricte des métadonnées opérationnelles permises
        expect(errorHandlerLogs).toContain('req-prod-audit-42'); // requestId
        expect(errorHandlerLogs).toContain('POST');              // method
        expect(errorHandlerLogs).toContain('/api/sensitive/action'); // url
        expect(errorHandlerLogs).toContain('203.0.113.195');    // ip
        expect(errorHandlerLogs).toContain('usr-987');          // userId
        expect(errorHandlerLogs).toContain('500');              // statusCode
      } finally {
        (loggerModule.logger as any).error = originalErrorMethod;
        (loggerModule.logger as any).warn = originalWarnMethod;
      }
    });

    it('Protection stricte des téléphones et préservation des codes techniques (Prisma P2002, Zod invalid_type)', async () => {
      const { Writable } = await import('stream');
      const pinoModule = await import('pino');
      const pino = pinoModule.default || pinoModule;
      const {
        SENSITIVE_PATHS,
        sanitizeErrorForLog,
        sanitizeLogString,
        sanitizeDataRecursively,
        maskPhone,
      } = await import('../src/middlewares/logger.js');

      let streamOutput = '';
      const memStream = new Writable({
        write(chunk, _encoding, callback) {
          streamOutput += chunk.toString();
          callback();
        },
      });

      const auditLogger = (pino as any)(
        {
          level: 'info',
          redact: {
            paths: SENSITIVE_PATHS,
            censor: '[REDACTED]',
          },
          formatters: {
            log(obj: Record<string, any>) {
              return sanitizeDataRecursively(obj);
            },
          },
          serializers: {
            err: sanitizeErrorForLog,
          },
          hooks: {
            logMethod(inputArgs: any[], method: any) {
              const sanitizedArgs = inputArgs.map((arg) => {
                if (typeof arg === 'string') return sanitizeLogString(arg);
                if (arg instanceof Error) return arg;
                if (arg && typeof arg === 'object') return sanitizeDataRecursively(arg);
                return arg;
              });
              return method.apply(this, sanitizedArgs);
            },
          },
        },
        memStream
      );

      // Sentinelles
      const RAW_PHONE_SENTINEL_1 = '+237699112233';
      const RAW_PHONE_SENTINEL_2 = '+237655443322';
      const RAW_PHONE_SENTINEL_3 = '+237600000001';
      const MASKED_PHONE_1 = maskPhone(RAW_PHONE_SENTINEL_1); // '+2376******33'
      const MASKED_PHONE_2 = maskPhone(RAW_PHONE_SENTINEL_2); // '+2376******22'
      const MASKED_PHONE_3 = maskPhone(RAW_PHONE_SENTINEL_3); // '+2376******01'

      const OTP_SENTINEL_1 = '789012';
      const OTP_SENTINEL_2 = '345678';
      const OTP_SENTINEL_3 = '901234';

      // 1. Log d'un payload contenant numéros de téléphone et codes secrets (OTP, verificationCode, smsCode, body.code)
      const inputPayload = {
        user: {
          id: 'usr-phone-test-1',
          phone: RAW_PHONE_SENTINEL_1,
          phoneNumber: RAW_PHONE_SENTINEL_2,
          contact: RAW_PHONE_SENTINEL_3,
        },
        authSecrets: {
          otpCode: OTP_SENTINEL_1,
          verificationCode: OTP_SENTINEL_2,
          smsCode: OTP_SENTINEL_3,
        },
        body: {
          code: '112233',
          phone: RAW_PHONE_SENTINEL_1,
        },
      };

      const clonedPayloadBefore = JSON.parse(JSON.stringify(inputPayload));

      auditLogger.info(inputPayload, 'Test de journalisation téléphone et secrets');

      // 2. Log d'un code Prisma technique (P2002)
      const prismaError: any = new Error('Unique constraint failed on the fields: (`contact`)');
      prismaError.name = 'PrismaClientKnownRequestError';
      prismaError.code = 'P2002';
      prismaError.meta = { target: ['contact'] };
      const clonedPrismaError = { name: prismaError.name, code: prismaError.code };

      auditLogger.error({ err: prismaError }, 'Erreur de contrainte Prisma');

      // 3. Log d'une erreur de validation Zod contenant un code technique (invalid_type, too_small)
      const zodErrorPayload = {
        name: 'ZodError',
        issues: [
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['body', 'phone'],
            message: 'Numéro attendu',
          },
          {
            code: 'too_small',
            minimum: 9,
            path: ['body', 'pin'],
            message: 'Trop court',
          },
        ],
      };
      const clonedZodBefore = JSON.parse(JSON.stringify(zodErrorPayload));

      auditLogger.warn({ validation: zodErrorPayload }, 'Erreur de validation Zod');

      // Assertions :
      // 1. NON-MUTATION des objets originaux
      expect(inputPayload).toEqual(clonedPayloadBefore);
      expect(inputPayload.user.phone).toBe(RAW_PHONE_SENTINEL_1);
      expect(prismaError.code).toBe(clonedPrismaError.code);
      expect(zodErrorPayload).toEqual(clonedZodBefore);

      // 2. AUCUN numéro brut ne doit apparaître dans le flux JSON Pino
      expect(streamOutput).not.toContain(RAW_PHONE_SENTINEL_1);
      expect(streamOutput).not.toContain(RAW_PHONE_SENTINEL_2);
      expect(streamOutput).not.toContain(RAW_PHONE_SENTINEL_3);

      // 3. Les numéros masqués DOIVENT être présents
      expect(streamOutput).toContain(MASKED_PHONE_1);
      expect(streamOutput).toContain(MASKED_PHONE_2);
      expect(streamOutput).toContain(MASKED_PHONE_3);

      // 4. Les codes OTP et de vérification sont STRICTEMENT absents (remplacés par [REDACTED])
      expect(streamOutput).not.toContain(OTP_SENTINEL_1);
      expect(streamOutput).not.toContain(OTP_SENTINEL_2);
      expect(streamOutput).not.toContain(OTP_SENTINEL_3);
      expect(streamOutput).not.toContain('112233'); // body.code

      // 5. Le code Prisma P2002 est STRICTEMENT PRÉSERVÉ dans les logs
      expect(streamOutput).toContain('P2002');

      // 6. Les codes techniques Zod (invalid_type, too_small) sont STRICTEMENT PRÉSERVÉS
      expect(streamOutput).toContain('invalid_type');
      expect(streamOutput).toContain('too_small');
    });
  });

  describe('4. Healthcheck de processus et Readiness probe', () => {
    const app = createApp();

    it('GET /api/health et /api/health/live retournent 200 UP sans fuite d’environnement', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.timestamp).toBeDefined();
      expect(typeof res.body.uptime).toBe('number');
      // Aucun NODE_ENV ou variable d'environnement publique
      expect(res.body.environment).toBeUndefined();
      expect(res.body.NODE_ENV).toBeUndefined();

      const liveRes = await request(app).get('/api/health/live');
      expect(liveRes.status).toBe(200);
      expect(liveRes.body.status).toBe('UP');
      expect(liveRes.body.environment).toBeUndefined();
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

    it('GET /api/health reste accessible (200) même quand le rate limiter global de l’API est saturé', async () => {
      // Configuration personnalisée avec une limite très basse pour provoquer un 429 sur les routes API normales
      const limitedApp = createApp({
        ...validateConfig(baseValidProdEnv),
        RATE_LIMIT_MAX: 2,
      });

      // Faire des requêtes sur une route sous apiLimiter (/api/sellers ou /api/auth/register)
      // Note : comme ce sont des routes montées après apiLimiter, elles consomment le quota
      await request(limitedApp).post('/api/auth/login').send({ phone: '+237600000001' });
      await request(limitedApp).post('/api/auth/login').send({ phone: '+237600000001' });
      const blockedRes = await request(limitedApp).post('/api/auth/login').send({ phone: '+237600000001' });

      // La route métier doit être bloquée avec 429
      expect(blockedRes.status).toBe(429);

      // La sonde de liveness (/api/health) DOIT toujours répondre 200 car montée avant apiLimiter
      const healthRes = await request(limitedApp).get('/api/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.status).toBe('UP');
    });
  });

  describe('5. Swagger / Documentation OpenAPI conditionnelle', () => {
    it('En production par défaut (ENABLE_API_DOCS: false), /api-docs retourne 404', async () => {
      const prodNoDocsApp = createApp({
        ...validateConfig(baseValidProdEnv),
        ENABLE_API_DOCS: false,
      });

      const res = await request(prodNoDocsApp).get('/api-docs');
      expect(res.status).toBe(404);
    });

    it('Quand ENABLE_API_DOCS est activé, /api-docs est accessible', async () => {
      const devDocsApp = createApp({
        ...validateConfig({ NODE_ENV: 'development' }),
        ENABLE_API_DOCS: true,
      });

      const res = await request(devDocsApp).get('/api-docs/');
      // Swagger UI répond par 200 (HTML) ou 301/302 vers trailing slash
      expect([200, 301, 302]).toContain(res.status);
    });
  });

  describe('6. Gestion centralisée des erreurs et absence de stack trace en production', () => {
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

  describe('7. Arrêt propre (Graceful Shutdown)', () => {
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
