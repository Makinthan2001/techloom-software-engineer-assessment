'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from './types';
import {
  apiFetch,
  getAccessToken,
  setAccessToken,
  refreshToken,
  setOnAuthFailed,
} from './api';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    // Register global auth failure listener for expired/revoked refresh tokens
    setOnAuthFailed(() => {
      setUser(null);
      setAccessTokenState(null);
      router.push('/login');
    });

    // On mount, perform silent refresh to check for active refresh cookie
    async function initializeAuth() {
      try {
        const success = await refreshToken();
        if (success) {
          const currentToken = getAccessToken();
          setAccessTokenState(currentToken);

          // Fetch current user details via /api/auth/me (or decoded token)
          const profileRes = await apiFetch('/api/auth/me');
          if (profileRes.ok && profileRes.data?.data) {
            setUser(profileRes.data.data);
          }
        }
      } catch (err) {
        console.error('Silent auth refresh error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initializeAuth();
  }, [router]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const msg = res.data?.message || 'Invalid email or password';
      throw new Error(msg);
    }

    const { user: userData, accessToken: token } = res.data.data;

    setAccessToken(token);
    setAccessTokenState(token);
    setUser(userData);

    return userData;
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setAccessToken(null);
      setAccessTokenState(null);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: accessTokenState,
        isAuthenticated: !!user && !!accessTokenState,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
