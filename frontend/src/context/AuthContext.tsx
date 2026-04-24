'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { AxiosError } from 'axios';
import { api, setTokens, clearTokens } from '@/lib/api';
import type { User, APISuccess } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  completeMfaLogin: (mfaToken: string, code: string) => Promise<void>;
  completeMfaSetup: (setupToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Login always returns one of these two shapes — never tokens directly
type LoginPayload =
  | { mfa_required: true;       mfa_token:   string }
  | { mfa_setup_required: true; setup_token: string };

type TokenPayload = { access: string; refresh: string; user: User };

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
      const { data } = await api.get<APISuccess<User>>('/auth/me/');
      setState({ user: data.data, isLoading: false, isAuthenticated: true });
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    if (Cookies.get('access_token')) {
      refreshUser();
    } else {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, [refreshUser]);

  // ── Step 1: password check ─────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post<APISuccess<LoginPayload>>('/auth/login/', { email, password });
      const payload = data.data;

      if ('mfa_required' in payload) {
        sessionStorage.setItem('mfa_token', payload.mfa_token);
        router.push('/mfa-verify');
        return;
      }

      // mfa_setup_required — first-time setup
      sessionStorage.setItem('setup_token', payload.setup_token);
      router.push('/mfa-setup');
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { details?: { code?: string } } }>;
      if (axiosErr.response?.data?.error?.details?.code === 'EMAIL_NOT_VERIFIED') {
        const e = new Error('EMAIL_NOT_VERIFIED') as Error & { code: string };
        e.code = 'EMAIL_NOT_VERIFIED';
        throw e;
      }
      throw err;
    }
  };

  // ── Step 2a: verify existing TOTP ─────────────────────────────────────────
  const completeMfaLogin = async (mfaToken: string, code: string) => {
    const { data } = await api.post<APISuccess<TokenPayload>>(
      '/auth/mfa/verify-login/',
      { mfa_token: mfaToken, code },
    );
    _finishLogin(data.data);
    sessionStorage.removeItem('mfa_token');
  };

  // ── Step 2b: first-time MFA setup → enable → get tokens ──────────────────
  const completeMfaSetup = async (setupToken: string, code: string) => {
    const { data } = await api.post<APISuccess<TokenPayload>>(
      '/auth/mfa/enable-login/',
      { setup_token: setupToken, code },
    );
    _finishLogin(data.data);
    sessionStorage.removeItem('setup_token');
  };

  const _finishLogin = ({ access, refresh, user }: TokenPayload) => {
    setTokens(access, refresh);
    setState({ user, isLoading: false, isAuthenticated: true });
    router.push(user.role === 'inbound_supplier' ? '/supplier-portal' : '/dashboard');
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
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
    sessionStorage.removeItem('mfa_token');
    sessionStorage.removeItem('setup_token');
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{ ...state, login, completeMfaLogin, completeMfaSetup, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
