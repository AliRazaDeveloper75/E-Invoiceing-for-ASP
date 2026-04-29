/**
 * Axios instance with JWT auth interceptors.
 *
 * - Attaches Authorization: Bearer <access_token> to every request
 * - On 401, silently refreshes the token and retries once
 * - On second 401 (refresh also failed), clears tokens and redirects to /login
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request interceptor: attach access token ───────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = Cookies.get('access_token');
  if (access && config.headers) {
    config.headers['Authorization'] = `Bearer ${access}`;
  }
  return config;
});

// ── Response interceptor: refresh on 401 ──────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refresh = Cookies.get('refresh_token');
      if (!refresh) {
        clearTokens();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/token/refresh/`, {
          refresh,
        });
        const newAccess: string = data.access;
        Cookies.set('access_token', newAccess, { secure: true, sameSite: 'strict' });
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
        processQueue(null, newAccess);
        originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        if (typeof window !== 'undefined') {
          const errData = (refreshError as AxiosError<{ error?: { details?: { mfa_expired?: boolean } } }>)
            ?.response?.data;
          const mfaExpired = errData?.error?.details?.mfa_expired === true;
          window.location.href = mfaExpired ? '/login?reason=mfa_expired' : '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function setTokens(access: string, refresh: string) {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const opts = { secure: isHttps, sameSite: 'strict' as const };
  Cookies.set('access_token', access, { ...opts, expires: 1 / 24 });   // 1 hour
  Cookies.set('refresh_token', refresh, { ...opts, expires: 7 });       // 7 days
}

export function clearTokens() {
  Cookies.remove('access_token');
  Cookies.remove('refresh_token');
}

export function getAccessToken() {
  return Cookies.get('access_token') ?? null;
}
