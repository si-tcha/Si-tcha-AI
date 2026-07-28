import { Router } from 'express';
import { login, me, registerBuyer, registerSeller, verifyOtp, requireAuth } from '../../controllers/auth.controller';
import { getProducts, getGicsPublic, getTerrain } from '../../controllers/catalog.controller';
import { getGicProfile, updateGicProfile, getGicHarvests, createGicHarvest, getGicExpenses, createGicExpense } from '../../controllers/gic.controller';
import { getBuyerOrders, createBuyerOrders, getBuyerAlertPreferences, updateBuyerAlertPreferences } from '../../controllers/buyer.controller';
import { validate } from '../../middlewares/validate';
import { authLimiter } from '../../middlewares/rateLimiter';
import { loginSchema, registerBuyerSchema, registerSellerSchema, verifyOtpSchema } from '../../schemas/auth.schema';

const router = Router();

// ==========================================
// AUTHENTIFICATION
// ==========================================
router.post('/auth/register/buyer', authLimiter, validate(registerBuyerSchema), registerBuyer);
router.post('/auth/register/seller', authLimiter, validate(registerSellerSchema), registerSeller);
router.post('/auth/verify-otp', authLimiter, validate(verifyOtpSchema), verifyOtp);
router.post('/auth/login', authLimiter, validate(loginSchema), login);
router.get('/auth/me', requireAuth, me);

// ==========================================
// CATALOGUE PUBLIC
// ==========================================
router.get('/catalog/products', getProducts);
router.get('/gics/public', getGicsPublic);
router.get('/terrain', getTerrain);

// ==========================================
// VENDEURS (GIC)
// ==========================================
router.get('/gic/profile', requireAuth, getGicProfile);
router.put('/gic/profile', requireAuth, updateGicProfile);
router.get('/gic/harvests', requireAuth, getGicHarvests);
router.post('/gic/harvests', requireAuth, createGicHarvest);
router.get('/gic/expenses', requireAuth, getGicExpenses);
router.post('/gic/expenses', requireAuth, createGicExpense);

// ==========================================
// ACHETEURS
// ==========================================
router.get('/buyer/orders', requireAuth, getBuyerOrders);
router.post('/buyer/orders', requireAuth, createBuyerOrders);
router.get('/buyer/alert-preferences', requireAuth, getBuyerAlertPreferences);
router.put('/buyer/alert-preferences', requireAuth, updateBuyerAlertPreferences);

export default router;
