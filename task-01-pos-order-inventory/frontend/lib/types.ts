export type Role = 'ADMIN' | 'CASHIER';

export type OrderStatus =
  | 'PENDING'
  | 'RESERVED'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export type ReservationStatus = 'ACTIVE' | 'RELEASED' | 'FINALIZED';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthData {
  user: User;
  accessToken: string;
}

export interface ApiResponse<T = any> {
  status?: string;
  success?: boolean;
  message?: string;
  data?: T;
  errors?: any;
}
