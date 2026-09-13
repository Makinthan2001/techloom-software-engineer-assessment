'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cartService } from '../services/cart.service';
import { useAuth } from './auth';

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: string | number;
    stock: number;
  };
}

export interface Cart {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'CONVERTED';
  items: CartItem[];
}

interface CartContextType {
  cart: Cart | null;
  loading: boolean;
  itemCount: number;
  totalAmount: number;
  addItem: (productId: string, quantity: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  resetCart: () => void;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'pos_active_cart_id';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const fetchCartById = useCallback(async (cartId: string) => {
    try {
      setLoading(true);
      const res = await cartService.getCart(cartId);
      if (res.ok && res.data?.data) {
        if (res.data.data.status === 'CONVERTED') {
          localStorage.removeItem(CART_STORAGE_KEY);
          setCart(null);
        } else {
          setCart(res.data.data);
        }
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
        setCart(null);
      }
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      const savedCartId = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCartId) {
        fetchCartById(savedCartId);
      }
    } else {
      setCart(null);
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [isAuthenticated, authLoading, fetchCartById]);

  const ensureActiveCart = async (): Promise<string> => {
    const existingCartId = cart?.id || localStorage.getItem(CART_STORAGE_KEY);
    if (!existingCartId || cart?.status === 'CONVERTED') {
      const createRes = await cartService.createCart();
      if (!createRes.ok || !createRes.data?.data?.id) {
        throw new Error(createRes.data?.message || 'Failed to create active cart');
      }
      const newCartId = createRes.data.data.id as string;
      localStorage.setItem(CART_STORAGE_KEY, newCartId);
      return newCartId;
    }
    return existingCartId;
  };

  const addItem = async (productId: string, quantity: number) => {
    const activeCartId = await ensureActiveCart();
    const res = await cartService.addItem(activeCartId, { productId, quantity });

    if (!res.ok) {
      throw new Error(res.data?.message || 'Failed to add item to cart');
    }

    await fetchCartById(activeCartId);
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (!cart) return;
    const res = await cartService.updateItem(cart.id, itemId, { quantity });

    if (!res.ok) {
      throw new Error(res.data?.message || 'Failed to update item quantity');
    }

    await fetchCartById(cart.id);
  };

  const removeItem = async (itemId: string) => {
    if (!cart) return;
    const res = await cartService.removeItem(cart.id, itemId);

    if (!res.ok) {
      throw new Error(res.data?.message || 'Failed to remove item from cart');
    }

    await fetchCartById(cart.id);
  };

  const resetCart = () => {
    localStorage.removeItem(CART_STORAGE_KEY);
    setCart(null);
  };

  const refreshCart = async () => {
    const savedCartId = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCartId) {
      await fetchCartById(savedCartId);
    }
  };

  const itemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalAmount =
    cart?.items?.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    ) || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        itemCount,
        totalAmount,
        addItem,
        updateQuantity,
        removeItem,
        resetCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
