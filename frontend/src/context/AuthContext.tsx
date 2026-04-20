'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { api, setTokens, clearTokens } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<{ success: boolean; data: User }>('/auth/me/');
      setState({ user: data.data, isLoading: false, isAuthenticated: true });
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    // Skip the API call if there's no token — avoids a 401 → redirect loop
    // on the login/register pages.
    if (Cookies.get('access_token')) {
      refreshUser();
    } else {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login/', { email, password });
    setTokens(data.access, data.refresh);
    const { data: meRes } = await api.get<{ success: boolean; data: User }>('/auth/me/');
    const user = meRes.data;
    setState({ user, isLoading: false, isAuthenticated: true });
    if (!user.email_verified) {
      const err = new Error('EMAIL_NOT_VERIFIED') as Error & { code: string };
      err.code = 'EMAIL_NOT_VERIFIED';
      throw err;
    }
    router.push(user.role === 'inbound_supplier' ? '/supplier-portal' : '/dashboard');
  };

  const logout = async () => {
    try {
      const refresh = document.cookie
        .split('; ')
        .find((r) => r.startsWith('refresh_token='))
        ?.split('=')[1];
      if (refresh) await api.post('/auth/logout/', { refresh });
    } catch {
      // ignore — clear tokens regardless
    }
    clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
