'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../lib/auth';
import { useCart } from '../../lib/cartContext';
import { productService } from '../../services/product.service';
import Toast, { ToastMessage } from '../../components/Toast';

interface Product {
  id: string;
  name: string;
  price: string | number;
  stock: number;
  createdAt: string;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const { addItem } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Modal State for Create / Edit Product
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', stock: '' });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await productService.getProducts();
      if (res.ok && res.data?.data) {
        setProducts(res.data.data);
      } else {
        setToast({
          type: res.status === 403 ? 'warning' : 'error',
          message: res.data?.message || 'Failed to fetch products',
        });
      }
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error fetching products' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', price: '', stock: '10' });
    setShowModal(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: String(product.price),
      stock: String(product.stock),
    });
    setShowModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setToast(null);

    const payload = {
      name: formData.name,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock, 10),
    };

    try {
      if (editingProduct) {
        // Edit Product
        const res = await productService.updateProduct(editingProduct.id, payload);

        if (!res.ok) {
          throw new Error(
            res.status === 403
              ? '403 Forbidden: You do not have permission to edit products (ADMIN only).'
              : res.data?.message || 'Failed to update product'
          );
        }

        setToast({
          type: 'success',
          message: res.data?.message || `Product '${payload.name}' updated successfully!`,
        });
      } else {
        // Create Product
        const res = await productService.createProduct(payload);

        if (!res.ok) {
          throw new Error(
            res.status === 403
              ? '403 Forbidden: You do not have permission to create products (ADMIN only).'
              : res.data?.message || 'Failed to create product'
          );
        }

        setToast({
          type: 'success',
          message: res.data?.message || `Product '${payload.name}' created successfully!`,
        });
      }

      setShowModal(false);
      await fetchProducts();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to save product' });
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDeleteProduct = (productId: string, productName: string) => {
    setDeletingProduct({ id: productId, name: productName });
  };

  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    const { id: productId, name: productName } = deletingProduct;
    setDeletingProduct(null);

    setActionLoadingId(productId);
    setToast(null);

    try {
      const res = await productService.deleteProduct(productId);

      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? '403 Forbidden: You do not have permission to delete products (ADMIN only).'
            : res.data?.message || 'Failed to delete product'
        );
      }

      setToast({
        type: 'success',
        message: res.data?.message || `Product '${productName}' deleted successfully!`,
      });
      await fetchProducts();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to delete product' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAddToCart = async (productId: string, productName: string) => {
    setActionLoadingId(productId);
    setToast(null);

    try {
      await addItem(productId, 1);
      setToast({ type: 'success', message: `Added 1x '${productName}' to cart!` });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to add item to cart' });
    } finally {
      setActionLoadingId(null);
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
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-white">Product Inventory</h1>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  user?.role === 'ADMIN'
                    ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                    : 'bg-blue-900/60 text-blue-300 border border-blue-700'
                }`}
              >
                {user?.role} Mode
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {user?.role === 'ADMIN'
                ? 'Manage products, edit details, and monitor live inventory stock levels.'
                : 'Browse catalog and view real-time available stock.'}
            </p>
          </div>

          {user?.role === 'ADMIN' && (
            <button
              onClick={handleOpenCreateModal}
              disabled={submitting}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition cursor-pointer shadow-lg shadow-purple-600/20 shrink-0"
            >
              + Create Product
            </button>
          )}
        </div>

        {/* Notification Toast */}
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        {/* Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <input
            type="text"
            placeholder="Search products by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
          />
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading product inventory...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            No products found matching your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map((product) => {
              const isItemActionLoading = actionLoadingId === product.id;
              return (
                <div
                  key={product.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                        {product.name}
                      </h3>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                          product.stock > 5
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : product.stock > 0
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}
                      >
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
                      </span>
                    </div>

                    <div className="text-2xl font-extrabold text-blue-400 mb-4">
                      Rs. {Number(product.price).toFixed(2)}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => handleAddToCart(product.id, product.name)}
                      disabled={product.stock <= 0 || isItemActionLoading}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center space-x-1.5"
                    >
                      {isItemActionLoading ? (
                        <span>Adding...</span>
                      ) : (
                        <span>+ Add to Cart</span>
                      )}
                    </button>

                    {user?.role === 'ADMIN' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(product)}
                          disabled={isItemActionLoading}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => triggerDeleteProduct(product.id, product.name)}
                          disabled={isItemActionLoading}
                          className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 disabled:opacity-40 text-red-300 border border-red-800/60 text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <h2 className="text-xl font-bold text-white">
                {editingProduct ? 'Edit Product' : 'Create New Product'}
              </h2>

              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Wireless Barcode Scanner"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Unit Price (Rs.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="29.99"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Initial Available Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="50"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={submitting}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition cursor-pointer flex items-center space-x-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingProduct ? 'Save Changes' : 'Create Product'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingProduct && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-800/80 text-red-400 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete Product</h3>
                  <p className="text-xs text-slate-400">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-sm text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                Are you sure you want to delete <span className="font-semibold text-white">'{deletingProduct.name}'</span> from active inventory sales?
              </p>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingProduct(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteProduct}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-red-600/30"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
