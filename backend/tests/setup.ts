import { vi } from 'vitest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-32-chars-long-12345';
process.env.NODE_ENV = 'test';
process.env.OTP_PROVIDER = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5438/sitcha_test?schema=public';
