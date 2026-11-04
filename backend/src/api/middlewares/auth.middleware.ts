export { protect, requireAuth, requireActive, requireRole, isAdmin, isGicLeader, getJwtSecret } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/auth.js';

export const isBuyer = requireRole('buyer');
