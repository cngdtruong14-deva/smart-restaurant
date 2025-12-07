import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category?: string;
  notes?: string;
}

interface CartState {
  items: CartItem[];
  tableId: number | null;
  customerId: number | null;
  notes: string;
  
  // Actions
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  updateNotes: (id: number, notes: string) => void;
  clearCart: () => void;
  setTable: (tableId: number) => void;
  setCustomer: (customerId: number) => void;
  setOrderNotes: (notes: string) => void;
  
  // Computed
  getTotal: () => number;
  getItemCount: () => number;
  getItemsByCategory: () => Record<string, CartItem[]>;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      tableId: null,
      customerId: null,
      notes: '',

      addItem: (item) =>
        set((state) => {
          const existingItem = state.items.find((i) => i.id === item.id);
          
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === item.id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          
          return {
            items: [...state.items, { ...item, quantity: 1 }],
          };
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        })),

      updateNotes: (id, notes) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, notes } : item
          ),
        })),

      clearCart: () =>
        set({ items: [], notes: '' }),

      setTable: (tableId) =>
        set({ tableId }),

      setCustomer: (customerId) =>
        set({ customerId }),

      setOrderNotes: (notes) =>
        set({ notes }),

      // Computed values
      getTotal: () => {
        const state = get();
        return state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },

      getItemCount: () => {
        const state = get();
        return state.items.reduce((count, item) => count + item.quantity, 0);
      },

      getItemsByCategory: () => {
        const state = get();
        return state.items.reduce((acc, item) => {
          const category = item.category || 'Uncategorized';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(item);
          return acc;
        }, {} as Record<string, CartItem[]>);
      },
    }),
    {
      name: 'restaurant-cart',
      partialize: (state) => ({
        items: state.items,
        tableId: state.tableId,
        customerId: state.customerId,
      }),
    }
  )
);