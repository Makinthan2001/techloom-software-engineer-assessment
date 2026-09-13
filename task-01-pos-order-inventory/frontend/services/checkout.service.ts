import { apiFetch, ApiResponse } from '../lib/api';

export interface ProcessCheckoutPayload {
  cartId: string;
  idempotencyKey?: string;
}

export const checkoutService = {
  processCheckout: async (payload: ProcessCheckoutPayload): Promise<ApiResponse> => {
    return apiFetch('/api/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
