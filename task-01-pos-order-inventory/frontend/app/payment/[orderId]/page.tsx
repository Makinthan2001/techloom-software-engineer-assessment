'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { apiFetch } from '../../../lib/api';
import CountdownTimer from '../../../components/CountdownTimer';
import Toast, { ToastMessage } from '../../../components/Toast';

interface OrderDetail {
  id: string;
  status: string;
  totalAmount: string | number;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: string | number;
    product: { name: string };
  }>;
  reservations?: Array<{
    id: string;
    expiresAt: string;
    status: string;
  }>;
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/orders/${orderId}`);
      if (res.ok && res.data?.data) {
        setOrder(res.data.data);
      } else {
        setToast({
          type: res.status === 403 ? 'warning' : 'error',
          message:
            res.status === 403
              ? '403 Forbidden: You are not authorized to view or pay for this order.'
              : res.data?.message || 'Failed to load order details',
        });
      }
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error fetching order details' });
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId, fetchOrder]);

  const handleSimulatePayment = async (outcome: 'SUCCESS' | 'FAILURE' | 'TIMEOUT') => {
    setSubmitting(true);
    setToast(null);

    // Generate fresh idempotencyKey per payment attempt
    const idempotencyKey = `pay-ui-${crypto.randomUUID()}`;

    try {
      const res = await apiFetch(`/api/orders/${orderId}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          outcome,
          idempotencyKey,
        }),
      });

      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? '403 Forbidden: You are not authorized to pay for this order.'
            : res.status === 409
            ? res.data?.message || '409 Conflict: Payment rejected by order state machine.'
            : res.data?.message || 'Payment simulation failed'
        );
      }

      const paymentData = res.data.data;
      setPaymentResult(paymentData);

      setToast({
        type: outcome === 'SUCCESS' ? 'success' : 'warning',
        message: `Payment simulation '${outcome}' processed! Order status is now ${paymentData.order.status}.`,
      });

      await fetchOrder(); // Refresh order details
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Payment processing error' });
    } finally {
      setSubmitting(false);
    }
  };

  const activeReservation = order?.reservations?.find((r) => r.status === 'ACTIVE');
  const expiresAt = activeReservation?.expiresAt || order?.reservations?.[0]?.expiresAt;

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Mock Payment Gateway</h1>
              <p className="text-slate-400 text-sm mt-1">
                Order ID: <span className="font-mono text-blue-400 font-bold">{orderId}</span>
              </p>
            </div>
            {order && (
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                    order.status === 'PAID'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : order.status === 'RESERVED'
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-red-950 text-red-400 border-red-800'
                  }`}
                >
                  STATUS: {order.status}
                </span>

                {order.status === 'RESERVED' && expiresAt && (
                  <CountdownTimer
                    expiresAt={expiresAt}
                    onExpire={() => {
                      fetchOrder(); // Lazy expiration check on backend
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notification Toast */}
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading order details...
          </div>
        ) : !order ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            Order not found or permission denied.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Order Summary Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3">
                Order Line Items
              </h2>

              <div className="divide-y divide-slate-800">
                {order.items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-sm">
                    <span className="text-slate-200 font-medium">{item.product.name}</span>
                    <span className="text-slate-400">
                      {item.quantity} × ${Number(item.unitPrice).toFixed(2)} = ${' '}
                      {(item.quantity * Number(item.unitPrice)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-sm font-semibold">Total Amount Due</span>
                <span className="text-3xl font-black text-white">
                  ${Number(order.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Outcome Simulator */}
            {order.status === 'RESERVED' ? (
              <div className="bg-slate-900 border border-blue-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-lg font-bold text-white">Simulate Payment Outcome</h2>
                <p className="text-slate-400 text-xs">
                  Select an outcome below to test the payment transition state machine. Buttons disabled while request is in flight.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={() => handleSimulatePayment('SUCCESS')}
                    disabled={submitting}
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <span>Processing...</span>
                    ) : (
                      <span>✔ SUCCESS</span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSimulatePayment('FAILURE')}
                    disabled={submitting}
                    className="py-3 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-red-600/20 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <span>Processing...</span>
                    ) : (
                      <span>✖ FAILURE</span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSimulatePayment('TIMEOUT')}
                    disabled={submitting}
                    className="py-3 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-amber-600/20 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <span>Processing...</span>
                    ) : (
                      <span>⏳ TIMEOUT</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm">
                  <div className="font-bold text-white mb-1">
                    Order Status is now: <span className="text-blue-400">{order.status}</span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    This order has exited the RESERVED state. Additional payment attempts are rejected per state machine rules.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={() => router.push(`/orders/${order.id}`)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    View Order Details
                  </button>
                  <Link
                    href="/orders"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
                  >
                    All Orders
                  </Link>
                </div>
              </div>
            )}

            {/* Payment Response Payload Display */}
            {paymentResult && (
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl text-xs space-y-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider block">
                  Latest Payment Result Payload
                </span>
                <pre className="text-emerald-400 overflow-x-auto p-2 bg-slate-900 rounded-lg">
                  {JSON.stringify(paymentResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
