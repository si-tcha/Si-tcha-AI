export interface HarvestRecord {
  id: string;
  product: string;
  volume: number; // en kg
  date: string;
  synced?: boolean;
}

export interface ExpenseRecord {
  id: string;
  label: string;
  amount: number; // en FCFA
  category: string;
  synced?: boolean;
}

export interface CartItemRecord {
  id: string;
  productId: string;
  name: string;
  price: string;
  unit: string;
  quantity: number;
  synced?: boolean;
}

export interface UserProfileRecord {
  id: string;
  name: string;
  phone: string;
  role: 'buyer' | 'seller';
  companyOrGic: string;
}

// Données initiales par défaut (mock/fallback)
const DEFAULT_HARVESTS: HarvestRecord[] = [
  { id: '1', product: 'Pommes de terre', volume: 1200, date: '12 Juillet 2026', synced: true },
  { id: '2', product: 'Tomates', volume: 800, date: '18 Juillet 2026', synced: true }
];

const DEFAULT_EXPENSES: ExpenseRecord[] = [
  { id: '1', label: 'Fertilisants NPK', amount: 150000, category: 'Intrants', synced: true },
  { id: '2', label: 'Transport récolte', amount: 45000, category: 'Transport', synced: true },
  { id: '3', label: 'Main d\'œuvre semis', amount: 80000, category: 'Main d\'œuvre', synced: true }
];

const DEFAULT_CART: CartItemRecord[] = [];

const STORAGE_KEYS = {
  HARVESTS: 'sitcha_harvests_db',
  EXPENSES: 'sitcha_expenses_db',
  CART: 'sitcha_cart_db',
  PROFILE: 'sitcha_profile_db',
};

/**
 * Implémentation Web (Offline-First via localStorage).
 * Ne jamais importer expo-sqlite ici : Metro bundler web ne résout pas le .wasm.
 */
class DatabaseService {
  async initDatabase(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEYS.HARVESTS)) {
      localStorage.setItem(STORAGE_KEYS.HARVESTS, JSON.stringify(DEFAULT_HARVESTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(DEFAULT_EXPENSES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CART)) {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(DEFAULT_CART));
    }
  }

  async getHarvests(): Promise<HarvestRecord[]> {
    const data = localStorage.getItem(STORAGE_KEYS.HARVESTS);
    return data ? JSON.parse(data) : DEFAULT_HARVESTS;
  }

  async addHarvest(product: string, volume: number): Promise<HarvestRecord> {
    const newHarvest: HarvestRecord = {
      id: Date.now().toString(),
      product,
      volume,
      date: 'Aujourd\'hui',
      synced: false,
    };
    const harvests = await this.getHarvests();
    localStorage.setItem(STORAGE_KEYS.HARVESTS, JSON.stringify([newHarvest, ...harvests]));
    return newHarvest;
  }

  async getExpenses(): Promise<ExpenseRecord[]> {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return data ? JSON.parse(data) : DEFAULT_EXPENSES;
  }

  async addExpense(label: string, amount: number, category: string): Promise<ExpenseRecord> {
    const newExpense: ExpenseRecord = {
      id: Date.now().toString(),
      label,
      amount,
      category,
      synced: false,
    };
    const expenses = await this.getExpenses();
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([newExpense, ...expenses]));
    return newExpense;
  }

  async getCart(): Promise<CartItemRecord[]> {
    const data = localStorage.getItem(STORAGE_KEYS.CART);
    return data ? JSON.parse(data) : DEFAULT_CART;
  }

  async getCartCount(): Promise<number> {
    const cart = await this.getCart();
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }

  async addToCart(product: {
    productId: string;
    name: string;
    price: string;
    unit: string;
  }): Promise<CartItemRecord> {
    const cart = await this.getCart();
    const existing = cart.find((item) => item.productId === product.productId);

    if (existing) {
      const updatedItem: CartItemRecord = {
        ...existing,
        quantity: existing.quantity + 1,
        synced: false,
      };
      const updated = cart.map((item) =>
        item.productId === product.productId ? updatedItem : item
      );
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(updated));
      return updatedItem;
    }

    const newItem: CartItemRecord = {
      id: Date.now().toString(),
      productId: product.productId,
      name: product.name,
      price: product.price,
      unit: product.unit,
      quantity: 1,
      synced: false,
    };
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([newItem, ...cart]));
    return newItem;
  }

  async getFinancialSummary(): Promise<{ totalVolume: number; totalExpenses: number; costPricePerKg: number }> {
    const harvests = await this.getHarvests();
    const expenses = await this.getExpenses();
    const totalVolume = harvests.reduce((acc, curr) => acc + curr.volume, 0);
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const costPricePerKg = totalVolume > 0 ? Math.round(totalExpenses / totalVolume) : 0;
    return { totalVolume, totalExpenses, costPricePerKg };
  }
}

export const dbService = new DatabaseService();
