import { apiFetch, ApiResponse } from '../lib/api';

export interface LoginPayload {
  email: string;
  password: string;
}

export const authService = {
  getMe: async (): Promise<ApiResponse> => {
    return apiFetch('/api/auth/me');
  },

  login: async (payload: LoginPayload): Promise<ApiResponse> => {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout: async (): Promise<ApiResponse> => {
    return apiFetch('/api/auth/logout', {
      method: 'POST',
    });
  },
};
