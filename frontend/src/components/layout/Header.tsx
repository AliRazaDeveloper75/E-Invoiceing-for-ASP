'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Bell, ChevronRight, User, Settings, LogOut, ExternalLink, Menu, Building2,
  FileText, Wallet, ShieldAlert, CheckCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { useSidebar } from '@/context/SidebarContext';
import { api } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

// ─── Notifications ──────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  category: 'invoice' | 'payment' | 'fraud' | 'admin';
  event: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

const NOTIF_ICON: Record<string, React.ElementType> = {
  invoice: FileText,
  payment: Wallet,
  fraud: ShieldAlert,
  admin: Building2,
};

const NOTIF_TONE: Record<string, string> = {
  invoice: 'text-blue-600 bg-blue-50',
  payment: 'text-emerald-600 bg-emerald-50',
  fraud: 'text-red-600 bg-red-50',
  admin: 'text-indigo-600 bg-indigo-50',
};

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const notifFetcher = (url: string) => api.get(url).then((r) => r.data?.data ?? r.data);

// ─── Breadcrumb map ───────────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  dashboard:  'Dashboard',
  invoices:   'Invoices',
  inbound:    'Inbound',
  customers:  'Customers',
  companies:  'Companies',
  new:        'New',
  settings:   'Settings',
};

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const isLast = i === segments.length - 1;
    const isUUID = /^[0-9a-f-]{32,36}$/i.test(seg);
    const label = isUUID ? 'Detail' : (ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1));
    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-blue-300" />}
          {crumb.isLast ? (
            <span className="font-semibold text-gray-900">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="text-gray-400 hover:text-blue-600 transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── User dropdown ────────────────────────────────────────────────────────────

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data, mutate } = useSWR<{ unread_count: number; results: NotificationItem[] }>(
    '/notifications/', notifFetcher, { refreshInterval: 45000, revalidateOnFocus: true },
  );
  const unread = data?.unread_count ?? 0;
  const items = data?.results ?? [];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function openItem(n: NotificationItem) {
    setOpen(false);
    try {
      if (!n.is_read) {
        await api.post(`/notifications/${n.id}/read/`);
        mutate();
      }
    } catch { /* ignore */ }
    if (n.link) router.push(n.link);
  }

  async function markAll() {
    try {
      await api.post('/notifications/read-all/');
      mutate();
    } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-blue-100/60 bg-white shadow-lg shadow-blue-500/5 z-50">
          <div className="px-4 py-3 border-b border-blue-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="h-6 w-6 mx-auto text-blue-200 mb-2" />
              <p className="text-sm text-gray-500">You&apos;re all caught up</p>
              <p className="text-xs text-gray-400 mt-0.5">No new notifications</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {items.map((n) => {
                const Icon = NOTIF_ICON[n.category] ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={clsx(
                      'w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0',
                      !n.is_read && 'bg-blue-50/40',
                    )}
                  >
                    <span className={clsx(
                      'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                      NOTIF_TONE[n.category] ?? 'text-gray-600 bg-gray-100',
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 truncate">{n.title}</span>
                      {n.message && <span className="block text-xs text-gray-500 leading-snug">{n.message}</span>}
                      <span className="block text-[10px] text-gray-400 mt-0.5">{relativeTime(n.created_at)}</span>
                    </span>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = [user?.first_name?.[0], user?.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'U';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-blue-50 transition-colors group"
      >
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-semibold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">{user?.full_name}</p>
          <p className="text-[10px] text-gray-500 capitalize leading-tight">{user?.role?.replace('_', ' ')}</p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg shadow-blue-500/5 border border-blue-100/60 py-1 z-50">
          <div className="px-4 py-3 border-b border-blue-50">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 capitalize">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <User className="h-3.5 w-3.5" /> Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </Link>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Home Page
            </Link>
          </div>
          <div className="border-t border-blue-50 py-1">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Header ──────────────────────────────────────────────────────────────

export function Header() {
  const { activeCompany } = useCompany();
  const { toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shadow-sm">

      {/* Sidebar toggle */}
      <button
        onClick={toggle}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0"
        title="Toggle sidebar"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      {/* Breadcrumbs */}
      <div className="flex-1 min-w-0">
        <Breadcrumbs />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Active company badge */}
        {activeCompany && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-gray-700 max-w-[120px] truncate">
              {activeCompany.name}
            </span>
            {activeCompany.trn && (
              <span className="text-[10px] text-gray-400 font-mono hidden lg:block">
                TRN: {activeCompany.trn}
              </span>
            )}
          </div>
        )}

        {/* Notifications */}
        <NotificationBell />

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200" />

        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  );
}
