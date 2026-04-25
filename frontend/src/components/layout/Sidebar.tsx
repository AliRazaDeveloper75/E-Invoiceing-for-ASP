'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  LogOut,
  ChevronDown,
  Inbox,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';

// roles: null  = visible to everyone
// roles: [...] = visible only to users whose role is in the list
const NAV: {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[] | null;
}[] = [
  // Standard platform users
  { href: '/dashboard',        label: 'Dashboard',        icon: LayoutDashboard, roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  { href: '/invoices',         label: 'Invoices',         icon: FileText,        roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  { href: '/customers',        label: 'Customers',        icon: Users,           roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  { href: '/companies',        label: 'Companies',        icon: Building2,       roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  // Admin-only
  { href: '/inbound',          label: 'Inbound',          icon: Inbox,           roles: ['admin'] },
  { href: '/management',       label: 'Management',       icon: ShieldCheck,     roles: ['admin'] },
  // Inbound supplier portal
  { href: '/supplier-portal',          label: 'My Portal',      icon: LayoutDashboard, roles: ['inbound_supplier'] },
  { href: '/supplier-portal/invoices', label: 'My Invoices',   icon: FileText,        roles: ['inbound_supplier'] },
  { href: '/supplier-portal/submit',   label: 'Submit Invoice', icon: PlusCircle,      roles: ['inbound_supplier'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { companies, activeCompany, setActiveId } = useCompany();

  const visibleNav = NAV.filter(
    ({ roles }) => roles === null || (user?.role && roles.includes(user.role))
  );

  return (
    <aside className="flex flex-col w-64 h-screen bg-brand-900 text-white fixed left-0 top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight">E-Numerak</h1>
        <p className="text-xs text-white/50 mt-0.5">E-Invoicing Platform</p>
      </div>

      {/* Company selector */}
      {companies.length > 0 && (
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1.5">Active Company</p>
          <div className="relative">
            <select
              value={activeCompany?.id ?? ''}
              onChange={(e) => setActiveId(e.target.value)}
              className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 pr-8
                         border border-white/20 appearance-none cursor-pointer
                         focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="text-gray-900">
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 pointer-events-none text-white/60" />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Role badge + user + logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold shrink-0">
            {user?.first_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-white/50 truncate">{user?.email}</p>
          </div>
        </div>
        {user?.role && (
          <div className="mb-3">
            <span className={clsx(
              'inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
              user.role === 'admin'
                ? 'bg-red-500/20 text-red-300'
                : user.role === 'supplier'
                  ? 'bg-blue-500/20 text-blue-300'
                  : user.role === 'accountant'
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : user.role === 'inbound_supplier'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-white/10 text-white/50'
            )}>
              {user.role}
            </span>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
                     text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
