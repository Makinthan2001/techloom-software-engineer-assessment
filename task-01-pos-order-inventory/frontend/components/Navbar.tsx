'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const pathname = usePathname();
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);

  if (!user) return null;

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    logout();
  };

  return (
    <>
      <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* App Branding */}
            <div className="flex items-center space-x-8">
              <Link href={user.role === 'CASHIER' ? '/pos' : '/dashboard'} className="flex items-center space-x-2">
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  TechLoom POS
                </span>
              </Link>

              {/* Nav Links */}
              <div className="hidden md:flex items-center space-x-1">
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/dashboard')
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Dashboard
                </Link>

                <Link
                  href="/pos"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/pos')
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  POS Checkout
                </Link>

                <Link
                  href="/cart"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                    isActive('/cart')
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>Cart</span>
                  {itemCount > 0 && (
                    <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {itemCount}
                    </span>
                  )}
                </Link>

                <Link
                  href="/orders"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/orders')
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Orders
                </Link>

                {/* ADMIN-only Products Management Link */}
                {user.role === 'ADMIN' && (
                  <Link
                    href="/products"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/products')
                        ? 'bg-purple-600 text-white'
                        : 'text-purple-300 hover:bg-purple-900/50 hover:text-white'
                    }`}
                  >
                    Products (Admin)
                  </Link>
                )}
              </div>
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-300 font-medium hidden sm:inline">
                  {user.name}
                </span>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    user.role === 'ADMIN'
                      ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                      : 'bg-blue-900/60 text-blue-300 border border-blue-700'
                  }`}
                >
                  {user.role}
                </span>
              </div>

              <button
                onClick={() => setShowLogoutModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-red-600/80 border border-slate-700 hover:border-red-500 rounded-md transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-800/80 text-red-400 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Logout</h3>
                <p className="text-xs text-slate-400">Are you sure you want to log out of your session?</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
              You will need to sign in again to access the POS terminal and inventory management features.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-red-600/30"
              >
                Confirm Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
