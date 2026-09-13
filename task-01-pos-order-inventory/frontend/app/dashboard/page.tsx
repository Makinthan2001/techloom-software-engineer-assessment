'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../lib/auth';
import { useCart } from '../../lib/cartContext';
import { productService } from '../../services/product.service';
import { orderService } from '../../services/order.service';

interface Product {
  id: string;
  name: string;
  price: string | number;
  stock: number;
}

interface Order {
  id: string;
  status: string;
  totalAmount: string | number;
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { cart, itemCount, totalAmount } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, orderRes] = await Promise.all([
        productService.getProducts(),
        orderService.getOrders(),
      ]);

      if (prodRes.ok && prodRes.data?.data) {
        setProducts(prodRes.data.data);
      }
      if (orderRes.ok && orderRes.data?.data) {
        setOrders(orderRes.data.data);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Admin summary metrics
  const totalProducts = products.length;
  const lowStockProducts = products.filter((p) => p.stock <= 5);
  const totalOrders = orders.length;

  const reservedCount = orders.filter((o) => o.status === 'RESERVED' || o.status === 'PENDING').length;
  const paidCount = orders.filter((o) => o.status === 'PAID').length;
  const terminalFailCount = orders.filter(
    (o) => o.status === 'CANCELLED' || o.status === 'FAILED' || o.status === 'EXPIRED'
  ).length;

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  user?.role === 'ADMIN'
                    ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                    : 'bg-blue-900/60 text-blue-300 border border-blue-700'
                }`}
              >
                {user?.role}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Welcome back, <span className="font-semibold text-slate-200">{user?.name}</span>!
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <Link
              href="/pos"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-blue-600/20"
            >
              Open POS Terminal →
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading system overview metrics...
          </div>
        ) : user?.role === 'ADMIN' ? (
          /* ADMIN DASHBOARD VIEW */
          <div className="space-y-6">
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  Total Products
                </h3>
                <div className="text-3xl font-extrabold text-white">{totalProducts}</div>
                <p className="text-xs text-slate-500 mt-2">Active catalog items</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  Low / Out of Stock
                </h3>
                <div className="text-3xl font-extrabold text-amber-400">
                  {lowStockProducts.length}
                </div>
                <p className="text-xs text-slate-500 mt-2">Items with ≤ 5 stock</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  Total Orders
                </h3>
                <div className="text-3xl font-extrabold text-blue-400">{totalOrders}</div>
                <p className="text-xs text-slate-500 mt-2">System-wide orders</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  Successful Payments
                </h3>
                <div className="text-3xl font-extrabold text-emerald-400">{paidCount}</div>
                <p className="text-xs text-slate-500 mt-2">PAID status orders</p>
              </div>
            </div>

            {/* Order Status Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                Order Status Distribution
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4">
                  <div className="text-xs font-semibold text-amber-300 uppercase">RESERVED / PENDING</div>
                  <div className="text-2xl font-black text-amber-400 mt-1">{reservedCount}</div>
                  <p className="text-xs text-slate-400 mt-1">Awaiting payment lock</p>
                </div>

                <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-4">
                  <div className="text-xs font-semibold text-emerald-300 uppercase">PAID (Completed)</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{paidCount}</div>
                  <p className="text-xs text-slate-400 mt-1">Payment finalized</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs font-semibold text-slate-400 uppercase">
                    CANCELLED / EXPIRED / FAILED
                  </div>
                  <div className="text-2xl font-black text-slate-300 mt-1">
                    {terminalFailCount}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Stock released back</p>
                </div>
              </div>
            </div>

            {/* Low Stock Warning List */}
            {lowStockProducts.length > 0 && (
              <div className="bg-slate-900 border border-amber-800/60 rounded-2xl p-6 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-amber-300">
                    ⚠ Low Stock Alerts ({lowStockProducts.length})
                  </h2>
                  <Link
                    href="/products"
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                  >
                    Manage Inventory →
                  </Link>
                </div>
                <div className="divide-y divide-slate-800">
                  {lowStockProducts.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">{p.name}</span>
                      <span className="text-xs font-bold text-amber-400 bg-amber-950 border border-amber-800 px-2.5 py-0.5 rounded-full">
                        {p.stock} remaining
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* CASHIER DASHBOARD VIEW */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* POS Shortcut Card */}
              <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-800/60 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl">
                <div>
                  <h2 className="text-xl font-extrabold text-white">Ready for Checkout?</h2>
                  <p className="text-slate-300 text-sm mt-1">
                    Launch the POS Terminal to search catalog items, adjust quantities, and process customer orders.
                  </p>
                </div>
                <Link
                  href="/pos"
                  className="py-3 px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-center text-sm rounded-xl transition shadow-lg shadow-blue-600/30 block"
                >
                  Start New Checkout →
                </Link>
              </div>

              {/* Active Cart Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Current Active Cart</h2>
                    {itemCount > 0 && (
                      <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                        {itemCount} items
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    {itemCount > 0
                      ? `Active cart total: Rs. ${totalAmount.toFixed(2)}`
                      : 'No active cart in progress.'}
                  </p>
                </div>

                {itemCount > 0 ? (
                  <Link
                    href="/cart"
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-center text-xs rounded-xl transition block"
                  >
                    View & Edit Cart (Rs. {totalAmount.toFixed(2)}) →
                  </Link>
                ) : (
                  <Link
                    href="/pos"
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-center text-xs rounded-xl transition block"
                  >
                    + Add Items to Cart
                  </Link>
                )}
              </div>
            </div>

            {/* Recent Orders List */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white">Your Recent Placed Orders</h2>
                <Link href="/orders" className="text-xs font-semibold text-blue-400 hover:text-blue-300">
                  View All ({orders.length}) →
                </Link>
              </div>

              {orders.length === 0 ? (
                <p className="text-slate-400 text-sm py-4">No recent orders placed.</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {orders.slice(0, 5).map((ord) => (
                    <div key={ord.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-mono text-blue-400 font-bold text-xs">
                          #{ord.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(ord.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            ord.status === 'PAID'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : ord.status === 'RESERVED'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {ord.status}
                        </span>
                        <span className="font-bold text-white">
                          Rs. {Number(ord.totalAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
