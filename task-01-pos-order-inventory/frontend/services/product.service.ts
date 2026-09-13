import { apiFetch, ApiResponse } from '../lib/api';

export interface CreateProductPayload {
  name: string;
  price: number;
  stock: number;
}

export interface UpdateProductPayload {
  name?: string;
  price?: number;
  stock?: number;
}

export const productService = {
  getProducts: async (): Promise<ApiResponse> => {
    return apiFetch('/api/products');
  },

  createProduct: async (payload: CreateProductPayload): Promise<ApiResponse> => {
    return apiFetch('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateProduct: async (id: string, payload: UpdateProductPayload): Promise<ApiResponse> => {
    return apiFetch(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteProduct: async (id: string): Promise<ApiResponse> => {
    return apiFetch(`/api/products/${id}`, {
      method: 'DELETE',
    });
  },
};
