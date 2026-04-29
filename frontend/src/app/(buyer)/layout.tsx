'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Building2,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clearTokens, getAccessToken } from '@/lib/api';
import type { BuyerProfile } from '@/types';
import { ChatWidget } from '@/components/chat/ChatWidget';

function BuyerSidebar({ profile, onClose }: { profile: BuyerProfile | null; onClose?: () => void }) {
  const router = useRouter();
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const navItems = [
    { href: '/buyer/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/buyer/invoices',  icon: FileText,        label: 'My Invoices' },
  ];

  async function handleLogout() {
    try { await api.post('/auth/logout/', {}); } catch {}
    clearTokens();
    router.push('/login');
  }

  return (
    <aside className="flex flex-col h-full bg-slate-900 text-white w-64 shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-700">
        <div>
          <div className="text-lg font-bold tracking-tight">E-Numerak</div>
          <div className="text-xs text-slate-400 mt-0.5">Buyer Portal</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Company badge */}
      {profile && (
        <div className="mx-3 mt-4 px-3 py-3 rounded-lg bg-slate-800 border border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
              {profile.customer_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{profile.customer_name}</div>
              <div className="text-xs text-slate-400 truncate">{profile.email}</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-slate-700 pt-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.push('/login'); return; }

    api.get<{ success: boolean; data: BuyerProfile }>('/buyer/me/')
      .then(r => setProfile(r.data.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <BuyerSidebar profile={profile} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 flex h-full">
            <BuyerSidebar profile={profile} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-slate-800">Buyer Portal</span>
          <div className="w-5" />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}
