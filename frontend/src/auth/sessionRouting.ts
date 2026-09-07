import { UserProfile } from '../services/api';

export type SellerActivationState = 'APPROVED' | 'PENDING' | 'REJECTED' | 'UNVERIFIED';

/**
 * Buyer autorisé dans son espace seulement si :
 * - role === "buyer"
 * - phoneVerified === true
 * - status === "active"
 */
export function canAccessBuyer(user: UserProfile | null): boolean {
  if (!user) return false;
  return user.role === 'buyer' && user.phoneVerified === true && user.status === 'active';
}

/**
 * Seller autorisé dans son dashboard seulement si :
 * - role === "seller"
 * - phoneVerified === true
 * - status === "active"
 * - statut === "APPROUVE" (conditions cumulatives strictes)
 */
export function canAccessSeller(user: UserProfile | null): boolean {
  if (!user) return false;
  return (
    user.role === 'seller' &&
    user.phoneVerified === true &&
    user.status === 'active' &&
    user.statut === 'APPROUVE'
  );
}

/**
 * Résout l'état d'activation d'un vendeur.
 */
export function resolveSellerActivationState(user: UserProfile | null): SellerActivationState {
  if (!user || user.role !== 'seller' || !user.phoneVerified) {
    return 'UNVERIFIED';
  }
  if (user.status === 'rejected' || user.statut === 'REJETE') {
    return 'REJECTED';
  }
  if (user.status === 'active' && user.statut === 'APPROUVE') {
    return 'APPROVED';
  }
  return 'PENDING';
}

/**
 * Résout la route de redirection basée sur la session utilisateur.
 */
export function resolveSessionRoute(user: UserProfile | null): string {
  if (!user) {
    return '/(auth)/welcome';
  }

  if (user.role === 'buyer') {
    return canAccessBuyer(user) ? '/(buyer)/home' : '/(auth)/login';
  }

  if (user.role === 'seller') {
    const state = resolveSellerActivationState(user);
    if (state === 'APPROVED') {
      return '/(seller)/home';
    }
    if (state === 'PENDING' || state === 'REJECTED') {
      return '/(auth)/activation-pending';
    }
    return '/(auth)/login';
  }

  return '/(auth)/welcome';
}
