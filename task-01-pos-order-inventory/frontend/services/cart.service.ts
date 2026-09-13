import { apiFetch, ApiResponse } from '../lib/api';

export interface AddCartItemPayload {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemPayload {
  quantity: number;
}

export const cartService = {
  getCart: async (cartId: string): Promise<ApiResponse> => {
    return apiFetch(`/api/carts/${cartId}`);
  },

  createCart: async (): Promise<ApiResponse> => {
    return apiFetch('/api/carts', {
      method: 'POST',
    });
  },

  addItem: async (cartId: string, payload: AddCartItemPayload): Promise<ApiResponse> => {
    return apiFetch(`/api/carts/${cartId}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateItem: async (
    cartId: string,
    itemId: string,
    payload: UpdateCartItemPayload
  ): Promise<ApiResponse> => {
    return apiFetch(`/api/carts/${cartId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeItem: async (cartId: string, itemId: string): Promise<ApiResponse> => {
    return apiFetch(`/api/carts/${cartId}/items/${itemId}`, {
      method: 'DELETE',
    });
  },
};
