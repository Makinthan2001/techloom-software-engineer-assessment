'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../lib/auth';
import { apiFetch } from '../../lib/api';
import Toast, { ToastMessage } from '../../components/Toast';

interface OrderItem {
  id: string;
  idempotencyKey?: string;
  status: string;
  totalAmount: string | number;
  createdAt: string;
  userId: string;
  user?: { name: string; email: string };
  items?: Array<{ id: string; quantity: number }>;
}

export default function OrdersPage() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/orders');
      if (res.ok && res.data?.data) {
        setOrders(res.data.data);
      } else {
        setToast({
          type: res.status === 403 ? 'warning' : 'error',
          message:
            res.status === 403
              ? '403 Forbidden: You do not have permission to list these orders.'
              : res.data?.message || 'Failed to fetch orders',
        });
      }
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error loading order history' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order? Stock will be restored.')) return;

    setCancellingId(orderId);
    setToast(null);

    try {
      const res = await apiFetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? '403 Forbidden: You are not authorized to cancel this order.'
            : res.data?.message || 'Failed to cancel order'
        );
      }

      setToast({
        type: 'success',
        message: res.data?.message || `Order #${orderId.slice(0, 8)} cancelled successfully! Stock restored.`,
      });
      await fetchOrders();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to cancel order' });
    } finally {
      setCancellingId(null);
    }
  };

  const filteredOrders = orders.filter((o) =>
    statusFilter === 'ALL' ? true : o.status === statusFilter
  );

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-white">Order History</h1>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  user?.role === 'ADMIN'
                    ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                    : 'bg-blue-900/60 text-blue-300 border border-blue-700'
                }`}
              >
                {user?.role === 'ADMIN' ? 'All System Orders' : 'Your Placed Orders'}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {user?.role === 'ADMIN'
                ? 'Viewing order history across all cashiers and users.'
                : 'Viewing orders placed by your account.'}
            </p>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2 shrink-0">
            <label className="text-xs font-semibold text-slate-400">Status Filter:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="RESERVED">RESERVED</option>
              <option value="PAID">PAID</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="FAILED">FAILED</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>
        </div>

        {/* Notification Toast */}
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        {/* Orders Table */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            No orders found matching status filter '{statusFilter}'.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Placed At</th>
                    {user?.role === 'ADMIN' && <th className="p-4">User</th>}
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Total Amount</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-sm">
                  {filteredOrders.map((ord) => {
                    const isCancelling = cancellingId === ord.id;
                    return (
                      <tr key={ord.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-mono text-blue-400 font-bold text-xs">
                          #{ord.id.slice(0, 8)}
                        </td>
                        <td className="p-4 text-slate-300 text-xs">
                          {new Date(ord.createdAt).toLocaleString()}
                        </td>
                        {user?.role === 'ADMIN' && (
                          <td className="p-4 text-slate-300 text-xs font-medium">
                            {ord.user?.name || ord.userId.slice(0, 8)}
                          </td>
                        )}
                        <td className="p-4">
                          <span
                            className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                              ord.status === 'PAID'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : ord.status === 'RESERVED'
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : ord.status === 'CANCELLED'
                                ? 'bg-slate-800 text-slate-400 border-slate-700'
                                : 'bg-red-950 text-red-400 border-red-800'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-white">
                          ${Number(ord.totalAmount).toFixed(2)}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <Link
                            href={`/orders/${ord.id}`}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition inline-block"
                          >
                            Details
                          </Link>

                          {(ord.status === 'RESERVED' || ord.status === 'PAID') && (
                            <button
                              onClick={() => handleCancelOrder(ord.id)}
                              disabled={isCancelling}
                              className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 disabled:opacity-40 text-red-300 border border-red-800/60 text-xs font-semibold rounded-lg transition cursor-pointer"
                            >
                              {isCancelling ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
