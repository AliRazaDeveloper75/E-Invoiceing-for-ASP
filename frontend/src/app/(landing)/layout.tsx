'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { FileText, Menu, X, ArrowRight, ChevronDown, ShieldCheck, ChevronUp, Mail, MapPin, Phone, Instagram, Facebook } from 'lucide-react';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { useI18n } from '@/context/I18nContext';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

const NAV_LINKS = [
  { key: 'nav.home',     href: '/' },
  { key: 'nav.about',    href: '/about' },
  { key: 'nav.services', href: '/services' },
  { key: 'nav.peppol',   href: '/peppol' },
  { key: 'nav.contact',  href: '/contact' },
];

function Navbar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const activeIndex = NAV_LINKS.findIndex(l => l.href === pathname);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#1e3a5f]/80 backdrop-blur-xl shadow-2xl'
          : 'bg-[#1e3a5f]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo */}
          <Link href="/" className="block overflow-hidden leading-none">
            <img src="/numerak-logo.png" alt="E-Numerak" className="h-32 w-auto object-contain -mt-12 -mb-12 -ml-7" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 relative">
            {NAV_LINKS.map((link, i) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${active
                      ? 'text-white'
                      : 'text-blue-200/80 hover:text-white hover:bg-white/[0.07]'
                    }
                  `}
                >
                  {t(link.key)}
                  {active && (
                    <span className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher variant="dark" />
            <Link
              href="/login"
              className="text-sm font-medium text-blue-200/80 hover:text-white transition-colors px-1"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              href="/dashboard"
              className="
                inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500
                text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40
                transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]
              "
            >
              {t('nav.portal')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden relative z-50 p-2 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <div className="relative h-5 w-5">
              <span className={`absolute inset-0 transition-all duration-300 ${menuOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`}>
                <Menu className="h-5 w-5" />
              </span>
              <span className={`absolute inset-0 transition-all duration-300 ${menuOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'}`}>
                <X className="h-5 w-5" />
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu — full screen overlay */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-all duration-300 ${
          menuOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />

        {/* Menu panel */}
        <div
          ref={menuRef}
          className={`absolute top-20 inset-x-4 bg-gradient-to-b from-[#172f4d] to-[#1e3a5f] rounded-2xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ${
            menuOpen
              ? 'translate-y-0 opacity-100'
              : '-translate-y-4 opacity-0'
          }`}
        >
          <div className="px-4 py-4 space-y-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`
                    flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150
                    ${active
                      ? 'bg-white/15 text-white shadow-inner'
                      : 'text-blue-200/80 hover:text-white hover:bg-white/[0.07]'
                    }
                  `}
                >
                  {t(link.key)}
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                </Link>
              );
            })}
          </div>

          <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3">
            <div className="px-1">
              <LanguageSwitcher variant="dark" />
            </div>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="block w-full text-center px-4 py-3 rounded-xl text-sm font-medium text-blue-200/80 hover:text-white hover:bg-white/[0.07] transition-colors"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:from-blue-400 hover:to-blue-500 transition-all"
            >
              {t('nav.portal')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useI18n();
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="relative overflow-hidden bg-[#0a1628] text-blue-100 mt-auto">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/10 to-transparent" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 py-14">
          <div>
            <div className="mb-4 overflow-hidden">
              <img src="/numerak-logo.png" alt="E-Numerak" className="h-28 w-auto object-contain -mt-10 -mb-12 -ml-7" />
            </div>
            <p className="text-xs leading-relaxed text-blue-200/70 max-w-sm mb-5">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://www.instagram.com/enumerak?igsh=cHhhbGk0cnZmcHNv"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-400/25 text-pink-400 hover:bg-pink-500 hover:text-white hover:border-pink-500 transition-all duration-200"
              >
                <Instagram className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://tiktok.com/@enumerak"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-500/15 border border-gray-400/25 text-gray-400 hover:bg-gray-500 hover:text-white hover:border-gray-500 transition-all duration-200"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.4 2.89 2.89 0 0 1-2.88-2.89 2.89 2.89 0 0 1 2.88-2.89c.28 0 .55.04.81.1v-3.5a6.37 6.37 0 0 0-.81-.06A6.34 6.34 0 0 0 3.5 15.18a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.67a8.26 8.26 0 0 0 4.83 1.55V6.69Z" />
                </svg>
              </a>
              <a
                href="https://facebook.com/enumerak"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-400/25 text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200"
              >
                <Facebook className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://wa.me/971506358421"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/25 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all duration-200"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <p className="text-white text-xs font-bold uppercase tracking-[0.12em] mb-5 pl-[18px]">{t('footer.platform')}</p>
            <ul className="space-y-3">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="group flex items-center gap-3 text-xs text-blue-200/60 hover:text-white transition-all duration-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400/0 group-hover:bg-blue-400 transition-all duration-200" />
                    <span className="group-hover:translate-x-0.5 transition-transform duration-200">{t(l.key)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-white text-xs font-bold uppercase tracking-[0.12em] mb-5 pl-[18px]">Resources</p>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://tax.gov.ae"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 text-xs text-blue-200/60 hover:text-white transition-all duration-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/0 group-hover:bg-blue-400 transition-all duration-200" />
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">Numerak</span>
                </a>
              </li>
              <li>
                <Link href="/login" className="group flex items-center gap-3 text-xs text-blue-200/60 hover:text-white transition-all duration-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/0 group-hover:bg-blue-400 transition-all duration-200" />
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">Portal</span>
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="group flex items-center gap-3 text-xs text-blue-200/60 hover:text-white transition-all duration-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/0 group-hover:bg-blue-400 transition-all duration-200" />
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">{t('footer.privacy')}</span>
                </Link>
              </li>
              <li>
                <Link href="/terms" className="group flex items-center gap-3 text-xs text-blue-200/60 hover:text-white transition-all duration-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/0 group-hover:bg-blue-400 transition-all duration-200" />
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">{t('footer.terms')}</span>
                </Link>
              </li>
              <li>
                <Link href="/fta-compliance" className="group flex items-center gap-3 text-xs text-blue-200/60 hover:text-white transition-all duration-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/0 group-hover:bg-blue-400 transition-all duration-200" />
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">{t('footer.ftaCompliance')}</span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-white text-xs font-bold uppercase tracking-[0.12em] mb-5 pl-[18px]">Contact</p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-xs text-blue-200/60">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.06] border border-white/[0.06] shrink-0 mt-0.5">
                  <Mail className="h-3 w-3" />
                </span>
                <span className="leading-relaxed">info@enumerak.com</span>
              </li>
              <li className="flex items-start gap-3 text-xs text-blue-200/60">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.06] border border-white/[0.06] shrink-0 mt-0.5">
                  <MapPin className="h-3 w-3" />
                </span>
                <span className="leading-relaxed">Dubai, United Arab Emirates</span>
              </li>
              <li className="flex items-start gap-3 text-xs text-blue-200/60">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.06] border border-white/[0.06] shrink-0 mt-0.5">
                  <Phone className="h-3 w-3" />
                </span>
                <a href="https://wa.me/971506358421" target="_blank" rel="noopener noreferrer" className="leading-relaxed hover:text-white transition-colors">
                  +971 50 635 8421
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="py-5 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-blue-200/50">
          <span>&copy; {new Date().getFullYear()} {t('footer.rights')}</span>
          <span className="flex items-center gap-1.5">
            {t('footer.certified')}
          </span>
          <button
            onClick={scrollToTop}
            className="inline-flex items-center gap-1 hover:text-blue-300/60 transition-colors"
            aria-label="Scroll to top"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
      </div>
    </footer>
  );
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 pt-16 md:pt-20">
        {children}
      </main>
      <Footer />
      <ChatWidget publicMode />
    </div>
  );
}
