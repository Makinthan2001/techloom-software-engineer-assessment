'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useCart } from '../../lib/cartContext';
import { apiFetch } from '../../lib/api';
import CountdownTimer from '../../components/CountdownTimer';
import Toast, { ToastMessage } from '../../components/Toast';

interface ReservedOrder {
  id: string;
  status: string;
  totalAmount: string | number;
  reservations?: Array<{
    id: string;
    expiresAt: string;
    status: string;
  }>;
}

export default function CheckoutPage() {
  const { cart, itemCount, totalAmount, resetCart } = useCart();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [createdOrder, setCreatedOrder] = useState<ReservedOrder | null>(null);

  const handleProcessCheckout = async () => {
    if (!cart || cart.items.length === 0) {
      setToast({ type: 'warning', message: 'Cart is empty. Please add items before checking out.' });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    // Generate client-side idempotencyKey
    const idempotencyKey = `chk-ui-${crypto.randomUUID()}`;

    try {
      const res = await apiFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          cartId: cart.id,
          idempotencyKey,
        }),
      });

      if (!res.ok) {
        throw new Error(
          res.status === 409
            ? '409 Conflict: Insufficient stock available for one or more items in your cart.'
            : res.data?.message || 'Checkout failed. Stock may be insufficient.'
        );
      }

      const orderData = res.data.data;
      setCreatedOrder(orderData);
      setToast({ type: 'success', message: 'Order created and inventory stock locked for 5 minutes!' });
      resetCart(); // Clear active cart state
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Checkout attempt failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const firstExpiry = createdOrder?.reservations?.[0]?.expiresAt;

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <h1 className="text-2xl font-bold text-white">Checkout & Stock Lock</h1>
          <p className="text-slate-400 text-sm mt-1">
            Reserves inventory stock for 5 minutes under PostgreSQL Serializable isolation.
          </p>
        </div>

        {/* Notification Toast */}
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        {/* Order Reservation Confirmation Card */}
        {createdOrder ? (
          <div className="bg-slate-900 border border-emerald-800/80 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Stock Reserved Successfully
                </span>
                <h2 className="text-2xl font-extrabold text-white mt-1">
                  Order #{createdOrder.id.slice(0, 8)}
                </h2>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <span className="bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1 rounded-full text-xs font-bold">
                  STATUS: {createdOrder.status}
                </span>

                {/* Live Ticking Countdown Timer */}
                {firstExpiry && (
                  <CountdownTimer
                    expiresAt={firstExpiry}
                    onExpire={() => {
                      setToast({
                        type: 'warning',
                        message: 'Reservation lock duration has expired. Click Proceed to Payment to check final state.',
                      });
                    }}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 border border-slate-800 p-5 rounded-xl text-sm">
              <div>
                <span className="text-slate-400 text-xs font-semibold block">Total Amount</span>
                <span className="text-3xl font-black text-white">
                  ${Number(createdOrder.totalAmount).toFixed(2)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-xs font-semibold block">5-Minute Expiry Lock</span>
                <span className="text-amber-400 font-mono text-xs font-bold block mt-1">
                  Expires at: {firstExpiry ? new Date(firstExpiry).toLocaleTimeString() : 'In 5 minutes'}
                </span>
                <span className="text-slate-500 text-xs block truncate mt-0.5">
                  Raw ISO: {firstExpiry || 'N/A'}
                </span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end space-x-4">
              <Link
                href="/orders"
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl transition"
              >
                View All Orders
              </Link>
              <button
                onClick={() => router.push(`/payment/${createdOrder.id}`)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                Proceed to Payment →
              </button>
            </div>
          </div>
        ) : (
          /* Pre-Checkout Cart Review */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
              Review Cart Line Items ({itemCount})
            </h2>

            {!cart || !cart.items || cart.items.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                Your cart is empty.{' '}
                <Link href="/pos" className="text-blue-400 underline font-semibold">
                  Go to POS
                </Link>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-800">
                  {cart.items.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-semibold text-white">{item.product.name}</div>
                        <div className="text-xs text-slate-400">
                          ${Number(item.product.price).toFixed(2)} × {item.quantity}
                        </div>
                      </div>
                      <div className="font-bold text-slate-200">
                        ${(Number(item.product.price) * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block uppercase">
                      Total Order Amount
                    </span>
                    <span className="text-3xl font-black text-blue-400">
                      ${totalAmount.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleProcessCheckout}
                    disabled={isSubmitting || itemCount === 0}
                    className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-base rounded-xl transition shadow-xl shadow-emerald-600/30 cursor-pointer flex items-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Reserving Stock...</span>
                      </>
                    ) : (
                      <span>Confirm & Lock Reservation →</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
