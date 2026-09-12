'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../lib/auth';
import { useCart } from '../../lib/cartContext';
import { apiFetch } from '../../lib/api';
import Toast, { ToastMessage } from '../../components/Toast';

interface Product {
  id: string;
  name: string;
  price: string | number;
  stock: number;
}

export default function POSPage() {
  const { user } = useAuth();
  const { cart, itemCount, totalAmount, addItem, updateQuantity, removeItem, loading: cartLoading } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [actionItemId, setActionItemId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/products');
      if (res.ok && res.data?.data) {
        setProducts(res.data.data);
      } else {
        setToast({ type: 'error', message: res.data?.message || 'Failed to fetch products' });
      }
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error loading product catalog' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAddToCart = async (product: Product) => {
    setActionItemId(product.id);
    setToast(null);

    try {
      await addItem(product.id, 1);
      setToast({ type: 'success', message: `Added 1x '${product.name}' to cart` });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to add item to cart' });
    } finally {
      setActionItemId(null);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    setActionItemId(itemId);
    try {
      await updateQuantity(itemId, newQty);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to update quantity' });
    } finally {
      setActionItemId(null);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setActionItemId(itemId);
    try {
      await removeItem(itemId);
      setToast({ type: 'info', message: 'Item removed from cart' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to remove item' });
    } finally {
      setActionItemId(null);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div>
            <h1 className="text-2xl font-bold text-white">POS Checkout Terminal</h1>
            <p className="text-slate-400 text-sm mt-1">
              Terminal User: <span className="font-semibold text-blue-400">{user?.name}</span> ({user?.role})
            </p>
          </div>
          {itemCount > 0 && (
            <Link
              href="/checkout"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center space-x-2 shrink-0"
            >
              <span>Checkout ({itemCount} items)</span>
              <span>→</span>
            </Link>
          )}
        </div>

        {/* Notification Toast */}
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Catalog Grid (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
              />
            </div>

            {loading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading product catalog...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                No products found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map((product) => {
                  const isItemBusy = actionItemId === product.id;
                  return (
                    <div
                      key={product.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-white text-base">{product.name}</h3>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              product.stock > 0
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-red-950 text-red-400 border border-red-800'
                            }`}
                          >
                            Stock: {product.stock}
                          </span>
                        </div>
                        <div className="text-xl font-bold text-blue-400 mb-3">
                          ${Number(product.price).toFixed(2)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock <= 0 || isItemBusy}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center space-x-1"
                      >
                        {isItemBusy ? <span>Adding...</span> : <span>+ Add to Terminal Cart</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Cart Drawer (Right 1 col) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-fit sticky top-20 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Current Cart</h2>
              <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-semibold">
                {itemCount} Items
              </span>
            </div>

            {cartLoading ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Updating cart...
              </div>
            ) : !cart || !cart.items || cart.items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Cart is empty. Click items on the left to add them.
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {cart.items.map((item) => {
                  const isBusy = actionItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between text-sm"
                    >
                      <div className="truncate mr-2">
                        <div className="font-semibold text-white truncate">{item.product.name}</div>
                        <div className="text-xs text-slate-400">
                          ${Number(item.product.price).toFixed(2)} × {item.quantity}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            disabled={isBusy}
                            className="px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40 text-xs font-bold"
                          >
                            -
                          </button>
                          <span className="px-2 text-xs font-semibold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={isBusy}
                            className="px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40 text-xs font-bold"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isBusy}
                          className="text-red-400 hover:text-red-300 disabled:opacity-40 text-xs font-semibold px-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Total & Action */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Running Total</span>
                <span className="text-2xl font-black text-white">${totalAmount.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/cart"
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-center font-semibold text-xs rounded-xl transition"
                >
                  View Cart
                </Link>
                <Link
                  href="/checkout"
                  className={`py-2.5 text-center font-bold text-xs rounded-xl transition ${
                    itemCount > 0
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                  onClick={(e) => {
                    if (itemCount <= 0) e.preventDefault();
                  }}
                >
                  Checkout Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
