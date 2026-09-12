'use client';

import React from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useCart } from '../../lib/cartContext';

export default function CartPage() {
  const { cart, itemCount, totalAmount, updateQuantity, removeItem, resetCart, loading } = useCart();

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div>
            <h1 className="text-2xl font-bold text-white">Your Cart</h1>
            <p className="text-slate-400 text-sm mt-1">
              Review active line items before checking out.
            </p>
          </div>
          {cart && cart.items && cart.items.length > 0 && (
            <button
              onClick={() => resetCart()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-800 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Clear Cart
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading cart details...
          </div>
        ) : !cart || !cart.items || cart.items.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-4">
            <p className="text-base">Your shopping cart is currently empty.</p>
            <Link
              href="/pos"
              className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-blue-600/20"
            >
              Go to POS Terminal & Add Items
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items List (Left 2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                <div className="divide-y divide-slate-800">
                  {cart.items.map((item) => {
                    const lineTotal = Number(item.product.price) * item.quantity;
                    return (
                      <div
                        key={item.id}
                        className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <h3 className="font-bold text-white text-lg">{item.product.name}</h3>
                          <p className="text-sm text-blue-400 font-semibold">
                            ${Number(item.product.price).toFixed(2)} each
                          </p>
                        </div>

                        <div className="flex items-center space-x-6 w-full sm:w-auto justify-between sm:justify-end">
                          {/* Quantity selector */}
                          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                              className="px-3 py-1.5 text-slate-300 hover:bg-slate-700 font-bold transition"
                            >
                              -
                            </button>
                            <span className="px-3 py-1.5 font-bold text-white text-sm">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="px-3 py-1.5 text-slate-300 hover:bg-slate-700 font-bold transition"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-extrabold text-white">
                              ${lineTotal.toFixed(2)}
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-xs text-red-400 hover:text-red-300 font-medium transition cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cart Summary Card (Right 1 col) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit space-y-6 shadow-xl">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                Order Summary
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Total Items</span>
                  <span className="font-semibold text-white">{itemCount}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-semibold text-white">${totalAmount.toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-base font-bold text-white">Estimated Total</span>
                  <span className="text-2xl font-black text-blue-400">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-center text-sm rounded-xl transition shadow-lg shadow-emerald-600/20 block"
              >
                Proceed to Checkout →
              </Link>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
