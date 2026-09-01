import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useCart } from '@/services/cart-store';

interface NavItem {
  key: string;
  route: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  badge?: number;
}

interface BottomNavBarProps {
  role: 'seller' | 'buyer';
  cartCount?: number;
  alertCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ role, cartCount: explicitCartCount, alertCount = 0 }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount: liveCartCount } = useCart();
  
  const activeCartCount = explicitCartCount !== undefined ? explicitCartCount : liveCartCount;

  const sellerItems: NavItem[] = [
    { key: 'home', route: '/(seller)/home', label: 'Bilan', icon: 'pie-chart' },
    { key: 'terrain', route: '/(seller)/terrain', label: 'Terrain SIG', icon: 'map' },
    { key: 'agronomist', route: '/(seller)/agronomist', label: 'Agronome', icon: 'cpu' },
    { key: 'b2b-trade', route: '/(seller)/b2b-trade', label: 'B2B Trade', icon: 'truck' },
    { key: 'profile', route: '/(seller)/profile', label: 'Profil GIC', icon: 'user' },
  ];

  const buyerItems: NavItem[] = [
    { key: 'home', route: '/(buyer)/home', label: 'Marché', icon: 'shopping-bag' },
    { key: 'gics', route: '/(buyer)/gics', label: 'GICs Certifiés', icon: 'shield' },
    { key: 'orders', route: '/(buyer)/orders', label: 'Commandes', icon: 'file-text' },
    { key: 'prefinancing', route: '/(buyer)/prefinancing', label: 'Investir', icon: 'trending-up' },
    { key: 'checkout', route: '/(buyer)/checkout', label: 'Panier', icon: 'shopping-cart', badge: activeCartCount },
  ];

  const items = role === 'seller' ? sellerItems : buyerItems;

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const isActive = pathname.includes(item.key);
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => {
              if (!isActive) {
                router.replace(item.route as any);
              }
            }}
            style={styles.navItem}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrapper}>
              <Feather
                name={item.icon}
                size={20}
                color={isActive ? '#d97834' : '#889e87'}
              />
              {item.badge !== undefined && item.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {item.label}
            </Text>
            {isActive && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 70 : 62,
    backgroundColor: '#101e0f',
    borderTopWidth: 1,
    borderTopColor: '#1d331b',
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 14 : 6,
    paddingTop: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
  },
  iconWrapper: {
    position: 'relative',
    padding: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#d97834',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#889e87',
  },
  activeLabel: {
    color: '#f3ecd8',
    fontWeight: '800',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d97834',
    marginTop: 1,
  },
});
