'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, FileText, Users, Building2, LogOut,
  ChevronDown, Inbox, ShieldCheck, PlusCircle,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { useSidebar } from '@/context/SidebarContext';

const NAV: {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[] | null;
}[] = [
  { href: '/dashboard',                label: 'Dashboard',      icon: LayoutDashboard, roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  { href: '/invoices',                  label: 'Invoices',       icon: FileText,        roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  { href: '/customers',                 label: 'Customers',      icon: Users,           roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  { href: '/companies',                 label: 'Companies',      icon: Building2,       roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  { href: '/inbound',                   label: 'Inbound',        icon: Inbox,           roles: ['admin'] },
  { href: '/management',                label: 'Management',     icon: ShieldCheck,     roles: ['admin'] },
  { href: '/supplier-portal',           label: 'My Portal',      icon: LayoutDashboard, roles: ['inbound_supplier'] },
  { href: '/supplier-portal/invoices',  label: 'My Invoices',   icon: FileText,        roles: ['inbound_supplier'] },
  { href: '/supplier-portal/submit',    label: 'Submit Invoice', icon: PlusCircle,      roles: ['inbound_supplier'] },
];

const ROLE_STYLE: Record<string, string> = {
  admin:            'bg-red-500/20    text-red-300',
  supplier:         'bg-blue-500/20   text-blue-300',
  accountant:       'bg-indigo-500/20 text-indigo-300',
  inbound_supplier: 'bg-amber-500/20  text-amber-300',
};

// Tooltip wrapper for collapsed mode
function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative flex">
      {children}
      <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2
                       whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium
                       text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150
                       shadow-xl z-50 before:absolute before:right-full before:top-1/2
                       before:-translate-y-1/2 before:border-4 before:border-transparent
                       before:border-r-gray-900">
        {label}
      </span>
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { companies, activeCompany, setActiveId } = useCompany();
  const { collapsed, toggle } = useSidebar();

  const visibleNav = NAV.filter(
    ({ roles }) => roles === null || (user?.role && roles.includes(user.role))
  );

  const initials = [user?.first_name?.[0], user?.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'U';

  return (
    <aside
      className={clsx(
        'group/sidebar flex flex-col h-screen bg-gradient-to-b from-[#0f1b35] to-[#162040]',
        'text-white fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out',
        'border-r border-white/[0.06] shadow-2xl',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* ── Logo + toggle ─────────────────────────────────────── */}
      <div className={clsx(
        'flex items-center border-b border-white/[0.08] shrink-0',
        collapsed ? 'justify-center px-0 py-4' : 'justify-between px-5 py-4',
      )}>
        {!collapsed && (
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-black">E</span>
              </div>
              <h1 className="text-[15px] font-bold tracking-tight text-white">E-Numerak</h1>
            </div>
            <p className="text-[10px] text-white/40 mt-0.5 ml-9">E-Invoicing Platform</p>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white text-sm font-black">E</span>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggle}
            title="Collapse sidebar"
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Company selector ──────────────────────────────────── */}
      {companies.length > 0 && !collapsed && (
        <div className="px-4 py-3 border-b border-white/[0.08] shrink-0">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 font-semibold">
            Active Company
          </p>
          <div className="relative">
            <select
              value={activeCompany?.id ?? ''}
              onChange={(e) => setActiveId(e.target.value)}
              className="w-full bg-white/[0.07] text-white text-sm rounded-xl px-3 py-2 pr-8
                         border border-white/[0.12] appearance-none cursor-pointer
                         focus:outline-none focus:ring-2 focus:ring-brand-400/40
                         hover:bg-white/[0.10] transition-colors"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="text-gray-900 bg-white">
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 pointer-events-none text-white/40" />
          </div>
        </div>
      )}

      {/* Collapsed company dot */}
      {companies.length > 0 && collapsed && (
        <div className="flex justify-center py-3 border-b border-white/[0.08] shrink-0">
          <NavTooltip label={activeCompany?.name ?? 'Company'}>
            <div className="h-8 w-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center cursor-default">
              <Building2 className="h-4 w-4 text-white/60" />
            </div>
          </NavTooltip>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className={clsx(
        'flex-1 py-3 space-y-0.5',
        '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        collapsed ? 'px-2 overflow-hidden' : 'px-3 overflow-y-auto',
      )}>
        {!collapsed && (
          <p className="text-[9px] text-white/25 uppercase tracking-[0.15em] font-bold px-3 pb-1.5">
            Navigation
          </p>
        )}
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
          return collapsed ? (
            <NavTooltip key={href} label={label}>
              <Link
                href={href}
                className={clsx(
                  'flex items-center justify-center w-full h-10 rounded-xl transition-all duration-150',
                  active
                    ? 'bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/30'
                    : 'text-white/50 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </Link>
            </NavTooltip>
          ) : (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-white/[0.12] text-white shadow-inner'
                  : 'text-white/60 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              <Icon className={clsx(
                'h-4 w-4 shrink-0 transition-colors',
                active ? 'text-brand-400' : 'text-white/40 group-hover:text-white/70',
              )} />
              <span>{label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Expand toggle (collapsed mode) ────────────────────── */}
      {collapsed && (
        <div className="flex justify-center py-3 border-t border-white/[0.08]">
          <NavTooltip label="Expand sidebar">
            <button
              onClick={toggle}
              className="h-9 w-9 rounded-xl flex items-center justify-center
                         text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </NavTooltip>
        </div>
      )}

      {/* ── User section ──────────────────────────────────────── */}
      {!collapsed ? (
        <div className="px-4 py-4 border-t border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600
                            flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-lg">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate leading-tight">{user?.full_name}</p>
              <p className="text-[11px] text-white/40 truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
          {user?.role && (
            <div className="mb-3">
              <span className={clsx(
                'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                ROLE_STYLE[user.role] ?? 'bg-white/10 text-white/50',
              )}>
                {user.role.replace('_', ' ')}
              </span>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm
                       text-white/50 hover:bg-white/[0.07] hover:text-white transition-colors group"
          >
            <LogOut className="h-4 w-4 text-white/30 group-hover:text-red-400 transition-colors" />
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-3 px-2 border-t border-white/[0.08] shrink-0">
          <NavTooltip label={user?.full_name ?? 'User'}>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600
                            flex items-center justify-center text-sm font-bold text-white shadow-lg cursor-default">
              {initials}
            </div>
          </NavTooltip>
          <NavTooltip label="Sign out">
            <button
              onClick={logout}
              className="h-9 w-9 rounded-xl flex items-center justify-center
                         text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </NavTooltip>
        </div>
      )}
    </aside>
  );
}
