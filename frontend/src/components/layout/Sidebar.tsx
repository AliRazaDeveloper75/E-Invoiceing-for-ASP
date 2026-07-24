'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, FileText, Users, Building2, LogOut,
  ChevronDown, Inbox, ShieldCheck, PlusCircle,
  PanelLeftClose, PanelLeftOpen, ScanLine, ShieldAlert, UserPlus, Package, Wallet,
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
  { href: '/receivables',               label: 'Receivables',    icon: Wallet,          roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  { href: '/catalog',                   label: 'Catalog',        icon: Package,         roles: ['admin', 'supplier', 'accountant'] },
  { href: '/companies',                 label: 'Companies',      icon: Building2,       roles: ['admin', 'supplier', 'accountant', 'viewer'] },
  { href: '/inbound',                   label: 'Inbound',        icon: Inbox,           roles: ['admin', 'accountant'] },
  { href: '/ai-ocr',                    label: 'AI Scanner',     icon: ScanLine,        roles: ['admin', 'accountant'] },
  { href: '/fraud-alerts',              label: 'Fraud Alerts',   icon: ShieldAlert,     roles: ['admin'] },
  { href: '/management',                label: 'Management',     icon: ShieldCheck,     roles: ['admin'] },
  { href: '/management/invitations',    label: 'Invitations',    icon: UserPlus,        roles: ['admin'] },
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
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const closeOnMobile = () => {
    if (window.innerWidth < 640) toggle();
  };

  const visibleNav = NAV.filter(
    ({ roles }) => roles === null || (user?.role && roles.includes(user.role))
  );

  const initials = [user?.first_name?.[0], user?.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'U';

  return (
    <aside
      className={clsx(
        'group/sidebar flex flex-col h-screen bg-gradient-to-b from-blue-950 to-indigo-950',
        'text-white fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out',
        'border-r border-white/[0.06] shadow-2xl',
        collapsed ? 'w-0 sm:w-[68px] opacity-0 sm:opacity-100 pointer-events-none sm:pointer-events-auto' : 'w-full sm:w-64',
      )}
    >
      {/* ── Logo + toggle ─────────────────────────────────────── */}
      <div className={clsx(
        'flex items-center border-b border-white/[0.08] shrink-0',
        collapsed ? 'justify-center px-0 py-4' : 'justify-between pl-0 pr-1 py-0',
      )}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center group overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/numerak-logo.png" alt="Numerak" className="h-32 w-auto object-contain drop-shadow-lg group-hover:opacity-80 transition-opacity duration-200 -mt-6 -mb-8 -ml-2" />
          </Link>
        )}
        {collapsed && (
          <NavTooltip label="Numerak">
            <Link href="/dashboard" className="flex items-center justify-center group overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/numerak-logo.png" alt="Numerak" className="h-24 w-auto object-contain drop-shadow-lg group-hover:opacity-80 transition-opacity duration-200 -mt-4 -mb-6" />
            </Link>
          </NavTooltip>
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
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 font-semibold">
            Active Company
          </p>
          {/* Current company card + dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className={clsx(
                'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 border text-left transition-all',
                open
                  ? 'bg-white/[0.10] border-blue-400/40 shadow-sm shadow-blue-500/10'
                  : 'bg-white/[0.06] border-white/[0.08] hover:bg-white/[0.10] hover:border-white/[0.12]',
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate leading-tight">
                  {activeCompany?.name ?? 'Select a company'}
                </p>
                {activeCompany?.trn && (
                  <p className="text-[11px] text-white/40 truncate mt-0.5">TRN: {activeCompany.trn}</p>
                )}
              </div>
              <ChevronDown className={clsx(
                'h-4 w-4 text-white/40 shrink-0 transition-transform duration-200',
                open && 'rotate-180',
              )} />
            </button>

            {/* Dropdown menu */}
            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-white/[0.12] bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl shadow-black/50 overflow-hidden">
                  {companies.map((c) => {
                    const isActive = c.id === activeCompany?.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setActiveId(c.id); setOpen(false); }}
                        className={clsx(
                          'flex items-center gap-3 w-full px-3.5 py-2.5 text-left transition-all',
                          isActive
                            ? 'bg-blue-500/15 text-white'
                            : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                        )}
                      >
                        <div className={clsx(
                          'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors',
                          isActive
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-500/20'
                            : 'bg-white/[0.06] text-white/40',
                        )}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={clsx(
                              'text-sm truncate leading-tight',
                              isActive ? 'font-semibold' : 'font-medium',
                            )}>
                              {c.name}
                            </p>
                            {isActive && (
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                            )}
                          </div>
                          {c.trn && (
                            <p className="text-[11px] text-white/40 truncate mt-0.5">TRN: {c.trn}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {/* Divider */}
                  <div className="h-px bg-white/[0.06] mx-3" />
                  <button
                    onClick={() => { router.push('/companies?new=1'); setOpen(false); }}
                    className="flex items-center gap-3 w-full px-3.5 py-2.5 text-left text-blue-300 hover:bg-white/[0.06] hover:text-blue-200 transition-all font-medium text-sm"
                  >
                    <div className="h-7 w-7 rounded-lg border border-dashed border-blue-400/40 flex items-center justify-center shrink-0">
                      <PlusCircle className="h-3.5 w-3.5" />
                    </div>
                    Add new company
                  </button>
                </div>
              </>
            )}
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
                onClick={closeOnMobile}
                className={clsx(
                  'flex items-center justify-center w-full h-10 rounded-xl transition-all duration-150',
                  active
                    ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
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
              onClick={closeOnMobile}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-white/[0.12] text-white shadow-inner'
                  : 'text-white/60 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              <Icon className={clsx(
                'h-4 w-4 shrink-0 transition-colors',
                active ? 'text-blue-400' : 'text-white/40 group-hover:text-white/70',
              )} />
              <span>{label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
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
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600
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
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600
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
