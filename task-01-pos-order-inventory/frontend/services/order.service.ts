import { apiFetch, ApiResponse } from '../lib/api';

export interface ProcessPaymentPayload {
  outcome: 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
  idempotencyKey?: string;
}

export const orderService = {
  getOrders: async (): Promise<ApiResponse> => {
    return apiFetch('/api/orders');
  },

  getOrderById: async (id: string): Promise<ApiResponse> => {
    return apiFetch(`/api/orders/${id}`);
  },

  cancelOrder: async (id: string): Promise<ApiResponse> => {
    return apiFetch(`/api/orders/${id}/cancel`, {
      method: 'POST',
    });
  },

  processPayment: async (
    orderId: string,
    payload: ProcessPaymentPayload
  ): Promise<ApiResponse> => {
    return apiFetch(`/api/orders/${orderId}/payment`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
