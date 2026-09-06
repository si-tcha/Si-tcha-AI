import { Router } from 'express';
import { login, me, registerBuyer, registerSeller, verifyOtp, requireAuth, requireActive, adminLogin, logout } from '../../controllers/auth.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getProducts, getGicsPublic, getTerrain } from '../../controllers/catalog.controller.js';
import { getGicProfile, updateGicProfile, getGicHarvests, createGicHarvest, getGicExpenses, createGicExpense, getGicOrders, createGicNeed } from '../../controllers/gic.controller.js';
import { getBuyerOrders, createBuyerOrders, getBuyerAlertPreferences, updateBuyerAlertPreferences } from '../../controllers/buyer.controller.js';
import { askAgronomist } from '../../controllers/agronomist.controller.js';
import { getB2BOffers, createB2BOffer } from '../../controllers/b2b.controller.js';
import { getParcels, createParcel } from '../../controllers/growth.controller.js';
import { getPrefinancingDeals, createPrefinancingDeal } from '../../controllers/prefinancing.controller.js';
import { getTrustRatings, createTrustRating } from '../../controllers/trust.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authLimiter } from '../../middlewares/rateLimiter.js';
import { loginSchema, registerBuyerSchema, registerSellerSchema, verifyOtpSchema } from '../../schemas/auth.schema.js';
import {
  createHarvestSchema,
  createExpenseSchema,
  createGicNeedSchema,
  updateGicProfileSchema,
  askAgronomistSchema,
  createOrderSchema,
  updateAlertPreferencesSchema,
  createB2BOfferSchema,
  createParcelSchema,
  createPrefinancingDealSchema,
  createTrustRatingSchema,
} from '../../schemas/routes.schema.js';

const router = Router();

// ==========================================
// AUTHENTIFICATION
// ==========================================
router.post('/auth/register/buyer', authLimiter, validate(registerBuyerSchema), registerBuyer);
router.post('/auth/register/seller', authLimiter, validate(registerSellerSchema), registerSeller);
router.post('/auth/verify-otp', authLimiter, validate(verifyOtpSchema), verifyOtp);
router.post('/auth/login', authLimiter, validate(loginSchema), login);
router.post('/auth/admin/login', authLimiter, asyncHandler(adminLogin));
router.post('/auth/logout', logout);
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
router.get('/gic/profile', requireAuth, requireActive, getGicProfile);
router.put('/gic/profile', requireAuth, requireActive, validate(updateGicProfileSchema), updateGicProfile);
router.get('/gic/harvests', requireAuth, requireActive, getGicHarvests);
router.post('/gic/harvests', requireAuth, requireActive, validate(createHarvestSchema), createGicHarvest);
router.get('/gic/expenses', requireAuth, requireActive, getGicExpenses);
router.post('/gic/expenses', requireAuth, requireActive, validate(createExpenseSchema), createGicExpense);
router.post('/gic/needs', requireAuth, requireActive, validate(createGicNeedSchema), createGicNeed);
router.get('/gic/orders', requireAuth, requireActive, getGicOrders);
router.post('/gic/agronomist', requireAuth, requireActive, validate(askAgronomistSchema), askAgronomist);

// ==========================================
// ACHETEURS
// ==========================================
router.get('/buyer/orders', requireAuth, requireActive, getBuyerOrders);
router.post('/buyer/orders', requireAuth, requireActive, validate(createOrderSchema), createBuyerOrders);
router.get('/buyer/alert-preferences', requireAuth, requireActive, getBuyerAlertPreferences);
router.put('/buyer/alert-preferences', requireAuth, requireActive, validate(updateAlertPreferencesSchema), updateBuyerAlertPreferences);

// ==========================================
// B2B MARKETPLACE
// ==========================================
router.get('/b2b/offers', getB2BOffers);
router.post('/b2b/offers', requireAuth, requireActive, validate(createB2BOfferSchema), createB2BOffer);

// ==========================================
// JOURNAL DE CROISSANCE (PARCELLES)
// ==========================================
router.get('/gic/parcels', requireAuth, requireActive, getParcels);
router.post('/gic/parcels', requireAuth, requireActive, validate(createParcelSchema), createParcel);

// ==========================================
// PRÉFINANCEMENT
// ==========================================
router.get('/prefinancing/deals', requireAuth, requireActive, getPrefinancingDeals);
router.post('/prefinancing/deals', requireAuth, requireActive, validate(createPrefinancingDealSchema), createPrefinancingDeal);

// ==========================================
// ÉVALUATIONS DE CONFIANCE
// ==========================================
router.get('/trust/ratings', getTrustRatings);
router.post('/trust/ratings', requireAuth, requireActive, validate(createTrustRatingSchema), createTrustRating);

export default router;
