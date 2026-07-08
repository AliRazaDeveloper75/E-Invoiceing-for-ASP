'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronRight,
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
    <aside className="flex flex-col h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white w-64 shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-600/20">
            EN
          </div>
          <div>
            <div className="text-base font-bold tracking-tight">E-Numerak</div>
            <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">Buyer Portal</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Company badge */}
      {profile && (
        <div className="mx-3 mt-4 px-3 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-sm font-bold shrink-0 shadow-lg shadow-blue-600/30">
              {profile.customer_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{profile.customer_name}</div>
              <div className="text-[11px] text-slate-400 truncate">{profile.email}</div>
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
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                active
                  ? 'bg-blue-600/20 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-500 rounded-r-full animate-scale-in" />
              )}
              <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                active ? 'text-blue-400' : ''
              }`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-slate-700/50 pt-4">
        <button
          onClick={handleLogout}
          className="group flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200"
        >
          <LogOut className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-1" />
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 w-10 h-10 border-[3px] border-blue-400/30 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          </div>
          <p className="text-sm text-slate-400 animate-pulse-soft">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col">
        <BuyerSidebar profile={profile} />
      </div>

      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={`relative z-50 h-full transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <BuyerSidebar profile={profile} onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600 hover:text-slate-800 transition-colors p-1">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-slate-800">Buyer Portal</span>
          <div className="w-5" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}
