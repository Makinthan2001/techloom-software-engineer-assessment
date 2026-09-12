'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const pathname = usePathname();

  if (!user) return null;

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  return (
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
              onClick={() => logout()}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-red-600/80 border border-slate-700 hover:border-red-500 rounded-md transition-all cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
