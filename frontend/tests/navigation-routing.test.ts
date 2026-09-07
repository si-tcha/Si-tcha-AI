import { describe, it, expect } from 'vitest';
import { UserProfile } from '../src/services/api';
import {
  canAccessBuyer,
  canAccessSeller,
  resolveSellerActivationState,
  resolveSessionRoute,
} from '../src/auth/sessionRouting';

describe('Production Navigation & Authorization Routing Matrix', () => {
  const activeBuyer: UserProfile = {
    id: '1',
    role: 'buyer',
    name: 'Acheteur Pro',
    phone: '+237699111111',
    status: 'active',
    phoneVerified: true,
  };

  const unverifiedBuyer: UserProfile = {
    id: '2',
    role: 'buyer',
    name: 'Acheteur Non Vérifié',
    phone: '+237699222222',
    status: 'active',
    phoneVerified: false,
  };

  const inactiveBuyer: UserProfile = {
    id: '3',
    role: 'buyer',
    name: 'Acheteur Inactif',
    phone: '+237699333333',
    status: 'pending',
    phoneVerified: true,
  };

  const approvedSeller: UserProfile = {
    id: '4',
    role: 'seller',
    name: 'Vendeur Validé',
    phone: '+237677111111',
    status: 'active',
    statut: 'APPROUVE',
    phoneVerified: true,
    gicId: 'gic-1',
  };

  const pendingSeller: UserProfile = {
    id: '5',
    role: 'seller',
    name: 'Vendeur En Attente',
    phone: '+237677222222',
    status: 'pending',
    statut: 'EN_ATTENTE',
    phoneVerified: true,
    gicId: 'gic-1',
  };

  const rejectedSeller: UserProfile = {
    id: '6',
    role: 'seller',
    name: 'Vendeur Refusé',
    phone: '+237677333333',
    status: 'rejected',
    statut: 'REJETE',
    phoneVerified: true,
    gicId: 'gic-1',
  };

  const sellerActiveStatusOnly: UserProfile = {
    id: '7',
    role: 'seller',
    name: 'Vendeur Status Active Mais Non Approuvé GIC',
    phone: '+237677444444',
    status: 'active',
    statut: 'EN_ATTENTE',
    phoneVerified: true,
    gicId: 'gic-1',
  };

  const unverifiedSeller: UserProfile = {
    id: '8',
    role: 'seller',
    name: 'Vendeur Non Vérifié',
    phone: '+237677555555',
    status: 'active',
    statut: 'APPROUVE',
    phoneVerified: false,
    gicId: 'gic-1',
  };

  describe('User without session', () => {
    it('should redirect unauthenticated user to welcome screen', () => {
      expect(resolveSessionRoute(null)).toBe('/(auth)/welcome');
      expect(canAccessBuyer(null)).toBe(false);
      expect(canAccessSeller(null)).toBe(false);
      expect(resolveSellerActivationState(null)).toBe('UNVERIFIED');
    });
  });

  describe('Buyer authorization rules', () => {
    it('should grant access to active and phoneVerified buyer', () => {
      expect(canAccessBuyer(activeBuyer)).toBe(true);
      expect(canAccessSeller(activeBuyer)).toBe(false);
      expect(resolveSessionRoute(activeBuyer)).toBe('/(buyer)/home');
    });

    it('should deny access to unverified buyer and redirect to login', () => {
      expect(canAccessBuyer(unverifiedBuyer)).toBe(false);
      expect(resolveSessionRoute(unverifiedBuyer)).toBe('/(auth)/login');
    });

    it('should deny access to inactive buyer and redirect to login', () => {
      expect(canAccessBuyer(inactiveBuyer)).toBe(false);
      expect(resolveSessionRoute(inactiveBuyer)).toBe('/(auth)/login');
    });

    it('should deny buyer access to seller dashboard', () => {
      expect(canAccessSeller(activeBuyer)).toBe(false);
    });
  });

  describe('Seller cumulative authorization rules', () => {
    it('should grant dashboard access only to seller with phoneVerified, status=active AND statut=APPROUVE', () => {
      expect(canAccessSeller(approvedSeller)).toBe(true);
      expect(canAccessBuyer(approvedSeller)).toBe(false);
      expect(resolveSellerActivationState(approvedSeller)).toBe('APPROVED');
      expect(resolveSessionRoute(approvedSeller)).toBe('/(seller)/home');
    });

    it('should keep pending seller on activation-pending', () => {
      expect(canAccessSeller(pendingSeller)).toBe(false);
      expect(resolveSellerActivationState(pendingSeller)).toBe('PENDING');
      expect(resolveSessionRoute(pendingSeller)).toBe('/(auth)/activation-pending');
    });

    it('should send rejected seller to activation-pending and strictly deny dashboard', () => {
      expect(canAccessSeller(rejectedSeller)).toBe(false);
      expect(resolveSellerActivationState(rejectedSeller)).toBe('REJECTED');
      expect(resolveSessionRoute(rejectedSeller)).toBe('/(auth)/activation-pending');
    });

    it('CRITICAL: should NOT grant access to seller with status=active but statut!=APPROUVE (cumulative rule)', () => {
      expect(canAccessSeller(sellerActiveStatusOnly)).toBe(false);
      expect(resolveSellerActivationState(sellerActiveStatusOnly)).toBe('PENDING');
      expect(resolveSessionRoute(sellerActiveStatusOnly)).toBe('/(auth)/activation-pending');
    });

    it('should require phoneVerified for sellers', () => {
      expect(canAccessSeller(unverifiedSeller)).toBe(false);
      expect(resolveSellerActivationState(unverifiedSeller)).toBe('UNVERIFIED');
      expect(resolveSessionRoute(unverifiedSeller)).toBe('/(auth)/login');
    });
  });
});
