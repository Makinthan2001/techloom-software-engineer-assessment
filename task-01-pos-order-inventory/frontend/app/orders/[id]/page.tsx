'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { orderService } from '../../../services/order.service';
import CountdownTimer from '../../../components/CountdownTimer';
import Toast, { ToastMessage } from '../../../components/Toast';

interface OrderDetail {
  id: string;
  status: string;
  totalAmount: string | number;
  createdAt: string;
  idempotencyKey?: string;
  userId: string;
  user?: { name: string; email: string };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: string | number;
    product: { id: string; name: string };
  }>;
  reservations?: Array<{
    id: string;
    status: string;
    expiresAt: string;
  }>;
  payments?: Array<{
    id: string;
    status: string;
    outcome: string;
    createdAt: string;
  }>;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  const fetchOrderDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await orderService.getOrderById(id);
      if (res.ok && res.data?.data) {
        setOrder(res.data.data);
      } else {
        setToast({
          type: res.status === 403 ? 'warning' : 'error',
          message:
            res.status === 403
              ? '403 Forbidden: You are not authorized to view this order.'
              : res.data?.message || 'Failed to load order details',
        });
      }
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error fetching order detail' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchOrderDetail();
    }
  }, [id, fetchOrderDetail]);

  const confirmCancelOrder = async () => {
    setShowCancelModal(false);
    setCancelling(true);
    setToast(null);

    try {
      const res = await orderService.cancelOrder(id);
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? '403 Forbidden: You are not authorized to cancel this order.'
            : res.data?.message || 'Failed to cancel order'
        );
      }

      setToast({
        type: 'success',
        message: res.data?.message || 'Order cancelled successfully! Stock restored.',
      });
      await fetchOrderDetail();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Cancellation request failed' });
    } finally {
      setCancelling(false);
    }
  };

  const isCancelValid = order?.status === 'RESERVED' || order?.status === 'PAID';
  const activeReservation = order?.reservations?.find((r) => r.status === 'ACTIVE');
  const expiresAt = activeReservation?.expiresAt || order?.reservations?.[0]?.expiresAt;

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/orders"
            className="text-sm font-semibold text-slate-400 hover:text-white flex items-center space-x-1 transition"
          >
            <span>&larr; Back to Order History</span>
          </Link>
          <div className="flex items-center space-x-3">
            {order && order.status === 'RESERVED' && (
              <Link
                href={`/payment/${order.id}`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition"
              >
                Proceed to Payment &rarr;
              </Link>
            )}
            {isCancelValid && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={cancelling}
                className="px-4 py-2 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}
          </div>
        </div>

        {/* Notification Toast */}
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        {/* Loading State */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading order summary...
          </div>
        ) : !order ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            Order not found or inaccessible.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Order Status Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-mono font-bold text-white">
                    Order #{order.id.slice(0, 8)}
                  </h1>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      order.status === 'PAID'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : order.status === 'RESERVED'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : order.status === 'CANCELLED'
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-red-950 text-red-400 border-red-800'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Created at {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>

              {isCancelValid && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={cancelling}
                  className="px-4 py-2 bg-red-950/80 hover:bg-red-900 disabled:opacity-40 text-red-300 border border-red-800 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Order'}
                </button>
              )}
            </div>
            {/* Reservation Expiry Lock Card */}
            {order.status === 'RESERVED' && expiresAt && (
              <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm">
                <div>
                  <div className="font-bold text-amber-300">Stock Reservation Active</div>
                  <div className="text-xs text-slate-400 mt-1">
                    <CountdownTimer
                      expiresAt={expiresAt}
                      onExpire={() => {
                        fetchOrderDetail(); // Trigger lazy backend expiration check
                      }}
                    />
                  </div>
                </div>

                <Link
                  href={`/payment/${order.id}`}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-600/20 text-center shrink-0"
                >
                  Pay Now →
                </Link>
              </div>
            )}

            {/* Line Items Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                Order Line Items ({order.items.length})
              </h2>

              <div className="divide-y divide-slate-800">
                {order.items.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-white">{item.product.name}</div>
                      <div className="text-xs text-slate-400">
                        Rs. {Number(item.unitPrice).toFixed(2)} × {item.quantity}
                      </div>
                    </div>
                    <div className="font-bold text-white">
                      Rs. {(Number(item.unitPrice) * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 font-semibold text-sm">Total Amount</span>
                <span className="text-3xl font-black text-blue-400">
                  Rs. {Number(order.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Audit History */}
            {order.payments && order.payments.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3">
                  Payment Transaction Audit Log
                </h2>
                <div className="space-y-2">
                  {order.payments.map((p) => (
                    <div
                      key={p.id}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-mono text-slate-400 block">{p.id}</span>
                        <span className="text-slate-500">
                          {new Date(p.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <span
                        className={`font-bold px-2 py-0.5 rounded ${
                          p.status === 'SUCCESS'
                            ? 'bg-emerald-950 text-emerald-300'
                            : 'bg-red-950 text-red-400'
                        }`}
                      >
                        {p.status} ({p.outcome})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cancel Order Confirmation Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Cancel Order</h3>
              <p className="text-sm text-slate-300">
                Are you sure you want to cancel this order? Any reserved stock will be restored to inventory.
              </p>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Keep Order
                </button>
                <button
                  onClick={confirmCancelOrder}
                  disabled={cancelling}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
