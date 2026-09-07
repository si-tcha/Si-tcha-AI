import { describe, it, expect } from 'vitest';
import { UserProfile } from '../src/services/api';

function resolveInitialRoute(user: UserProfile | null, authenticated: boolean): string {
  if (!authenticated || !user) {
    return '/onboarding';
  }
  if (user.role === 'buyer') {
    return '/(buyer)/home';
  }
  if (user.role === 'seller') {
    if (user.status === 'active' || user.statut === 'APPROUVE') {
      return '/(seller)/home';
    }
    return '/(auth)/activation-pending';
  }
  return '/onboarding';
}

function guardRoute(
  user: UserProfile | null,
  authenticated: boolean,
  targetLayout: 'buyer' | 'seller'
): { allowed: boolean; redirect: string | null } {
  if (!authenticated || !user) {
    return { allowed: false, redirect: '/(auth)/login' };
  }

  if (targetLayout === 'buyer') {
    if (user.role !== 'buyer') {
      const redirect =
        user.role === 'seller'
          ? user.status === 'active' || user.statut === 'APPROUVE'
            ? '/(seller)/home'
            : '/(auth)/activation-pending'
          : '/(auth)/login';
      return { allowed: false, redirect };
    }
    return { allowed: true, redirect: null };
  }

  if (targetLayout === 'seller') {
    if (user.role !== 'seller') {
      return {
        allowed: false,
        redirect: user.role === 'buyer' ? '/(buyer)/home' : '/(auth)/login',
      };
    }
    if (user.status !== 'active' && user.statut !== 'APPROUVE') {
      return { allowed: false, redirect: '/(auth)/activation-pending' };
    }
    return { allowed: true, redirect: null };
  }

  return { allowed: false, redirect: '/(auth)/login' };
}

describe('Navigation & Authorization Routing Matrix', () => {
  const activeBuyer: UserProfile = {
    id: '1',
    role: 'buyer',
    name: 'Acheteur Pro',
    phone: '+237699112233',
    status: 'active',
    phoneVerified: true,
  };

  const pendingSeller: UserProfile = {
    id: '2',
    role: 'seller',
    name: 'Vendeur En Attente',
    phone: '+237677112233',
    status: 'pending',
    statut: 'EN_ATTENTE',
    phoneVerified: true,
  };

  const activeSeller: UserProfile = {
    id: '3',
    role: 'seller',
    name: 'Vendeur Validé',
    phone: '+237677998877',
    status: 'active',
    statut: 'APPROUVE',
    phoneVerified: true,
  };

  const rejectedSeller: UserProfile = {
    id: '4',
    role: 'seller',
    name: 'Vendeur Rejeté',
    phone: '+237677000000',
    status: 'rejected',
    statut: 'REJETE',
    phoneVerified: true,
  };

  describe('RootIndex / Initial Route Resolution', () => {
    it('should route unauthenticated session to /onboarding', () => {
      expect(resolveInitialRoute(null, false)).toBe('/onboarding');
    });

    it('should route active buyer to /(buyer)/home', () => {
      expect(resolveInitialRoute(activeBuyer, true)).toBe('/(buyer)/home');
    });

    it('should route pending seller to /(auth)/activation-pending', () => {
      expect(resolveInitialRoute(pendingSeller, true)).toBe('/(auth)/activation-pending');
    });

    it('should route active seller to /(seller)/home', () => {
      expect(resolveInitialRoute(activeSeller, true)).toBe('/(seller)/home');
    });

    it('should route rejected seller to /(auth)/activation-pending (never to /home)', () => {
      expect(resolveInitialRoute(rejectedSeller, true)).toBe('/(auth)/activation-pending');
    });
  });

  describe('Route Guards (Layout Protections against direct deep links)', () => {
    it('should block unauthenticated access to /(buyer)/* and redirect to login', () => {
      const res = guardRoute(null, false, 'buyer');
      expect(res.allowed).toBe(false);
      expect(res.redirect).toBe('/(auth)/login');
    });

    it('should block unauthenticated access to /(seller)/* and redirect to login', () => {
      const res = guardRoute(null, false, 'seller');
      expect(res.allowed).toBe(false);
      expect(res.redirect).toBe('/(auth)/login');
    });

    it('should allow active buyer into buyer layout', () => {
      const res = guardRoute(activeBuyer, true, 'buyer');
      expect(res.allowed).toBe(true);
      expect(res.redirect).toBeNull();
    });

    it('should block buyer from accessing seller layout and redirect to /(buyer)/home', () => {
      const res = guardRoute(activeBuyer, true, 'seller');
      expect(res.allowed).toBe(false);
      expect(res.redirect).toBe('/(buyer)/home');
    });

    it('should block pending seller from accessing seller dashboard and redirect to activation-pending', () => {
      const res = guardRoute(pendingSeller, true, 'seller');
      expect(res.allowed).toBe(false);
      expect(res.redirect).toBe('/(auth)/activation-pending');
    });

    it('should block rejected seller from accessing seller dashboard and redirect to activation-pending', () => {
      const res = guardRoute(rejectedSeller, true, 'seller');
      expect(res.allowed).toBe(false);
      expect(res.redirect).toBe('/(auth)/activation-pending');
    });

    it('should allow active seller into seller layout', () => {
      const res = guardRoute(activeSeller, true, 'seller');
      expect(res.allowed).toBe(true);
      expect(res.redirect).toBeNull();
    });
  });
});
