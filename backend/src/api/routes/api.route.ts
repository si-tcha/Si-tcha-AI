import { Router } from 'express';
import { login, me, registerBuyer, registerSeller, verifyOtp, requireAuth } from '../../controllers/auth.controller';
import { getProducts, getGicsPublic, getTerrain } from '../../controllers/catalog.controller';
import { getGicProfile, updateGicProfile, getGicHarvests, createGicHarvest, getGicExpenses, createGicExpense } from '../../controllers/gic.controller';
import { getBuyerOrders, createBuyerOrders, getBuyerAlertPreferences, updateBuyerAlertPreferences } from '../../controllers/buyer.controller';
import { askAgronomist } from '../../controllers/agronomist.controller';
import { getB2BOffers, createB2BOffer } from '../../controllers/b2b.controller';
import { getParcels, createParcel } from '../../controllers/growth.controller';
import { getPrefinancingDeals, createPrefinancingDeal } from '../../controllers/prefinancing.controller';
import { getTrustRatings, createTrustRating } from '../../controllers/trust.controller';
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
router.post('/gic/agronomist', requireAuth, askAgronomist);

// ==========================================
// ACHETEURS
// ==========================================
router.get('/buyer/orders', requireAuth, getBuyerOrders);
router.post('/buyer/orders', requireAuth, createBuyerOrders);
router.get('/buyer/alert-preferences', requireAuth, getBuyerAlertPreferences);
router.put('/buyer/alert-preferences', requireAuth, updateBuyerAlertPreferences);

// ==========================================
// B2B MARKETPLACE
// ==========================================
router.get('/b2b/offers', getB2BOffers);
router.post('/b2b/offers', requireAuth, createB2BOffer);

// ==========================================
// JOURNAL DE CROISSANCE (PARCELLES)
// ==========================================
router.get('/gic/parcels', requireAuth, getParcels);
router.post('/gic/parcels', requireAuth, createParcel);

// ==========================================
// PRÉFINANCEMENT
// ==========================================
router.get('/prefinancing/deals', requireAuth, getPrefinancingDeals);
router.post('/prefinancing/deals', requireAuth, createPrefinancingDeal);

// ==========================================
// ÉVALUATIONS DE CONFIANCE
// ==========================================
router.get('/trust/ratings', getTrustRatings);
router.post('/trust/ratings', requireAuth, createTrustRating);

export default router;
