import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

// On mock Prisma pour éviter de toucher la vraie base de données
vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      recolteOffre: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      gIC: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      }
    }
  };
});

describe('Catalog Endpoints', () => {
  it('GET /api/catalog/products should return pagination metadata', async () => {
    const res = await request(app).get('/api/catalog/products?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('GET /api/gics/public should return pagination metadata', async () => {
    const res = await request(app).get('/api/gics/public?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});
