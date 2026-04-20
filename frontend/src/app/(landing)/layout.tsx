'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FileText, Menu, X, ArrowRight, ExternalLink } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Home',     href: '/' },
  { label: 'About',    href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'PEPPOL',   href: '/peppol' },
  { label: 'Contact',  href: '/contact' },
];

function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#1e3a5f] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <span className="text-white font-bold text-sm tracking-wide">UAE E-Invoicing</span>
              <span className="block text-blue-300 text-[10px] font-medium tracking-widest uppercase">PEPPOL Platform</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                    ${active
                      ? 'bg-white/15 text-white'
                      : 'text-blue-200 hover:text-white hover:bg-white/10'
                    }
                  `}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* CTA button */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-blue-200 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="
                flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                bg-blue-500 hover:bg-blue-400 text-white
                transition-all duration-150 shadow-md hover:shadow-lg
              "
            >
              E-Invoice Portal
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-blue-200 hover:text-white hover:bg-white/10"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#172f4d] border-t border-white/10 px-4 py-3 space-y-1">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`
                  block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? 'bg-white/15 text-white' : 'text-blue-200 hover:text-white hover:bg-white/10'}
                `}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:text-white hover:bg-white/10"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-400"
            >
              E-Invoice Portal <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-[#1e3a5f] text-blue-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500">
                <FileText className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-white font-bold text-sm">UAE E-Invoicing Platform</span>
            </div>
            <p className="text-xs leading-relaxed text-blue-300 max-w-xs">
              PEPPOL 5-Corner compliant e-invoicing solution for UAE businesses.
              FTA-certified, VAT-ready, and built for the UAE digital economy.
            </p>
          </div>
          <div>
            <p className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Platform</p>
            <ul className="space-y-2 text-xs">
              {NAV_LINKS.map((l) => (
                <li key={l.href}><Link href={l.href} className="hover:text-white transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Legal</p>
            <ul className="space-y-2 text-xs">
              <li><span className="cursor-default">Privacy Policy</span></li>
              <li><span className="cursor-default">Terms of Service</span></li>
              <li><span className="cursor-default">FTA Compliance</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-blue-400">
          <span>&copy; {new Date().getFullYear()} UAE E-Invoicing Platform. All rights reserved.</span>
          <span>Federal Decree-Law No. 16 of 2024 &bull; PEPPOL BIS 3.0 &bull; UAE FTA Certified</span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}
