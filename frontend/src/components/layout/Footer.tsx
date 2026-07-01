import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-blue-100/60 bg-gradient-to-r from-white via-blue-50/20 to-white px-6 py-3">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">

        {/* Left — copyright */}
        <p className="text-xs text-blue-400/70">
          &copy; {year} E-Numerak &bull; E-Invoicing Platform
        </p>

        {/* Center — compliance badges */}
        <div className="flex items-center gap-2">
          {[
            { label: 'FTA Certified',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
            { label: 'BIS 3.0', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
            { label: 'UBL 2.1',        color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
            { label: 'VAT Compliant',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
          ].map((badge) => (
            <span
              key={badge.label}
              className={`hidden sm:inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.color}`}
            >
              {badge.label}
            </span>
          ))}
        </div>

        {/* Right — links */}
        <div className="flex items-center gap-3 text-xs text-blue-400/70">
          <Link href="/" className="hover:text-blue-600 transition-colors flex items-center gap-1">
            Home <ExternalLink className="h-2.5 w-2.5" />
          </Link>
          <span className="text-blue-200">|</span>
          <Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
          <span className="text-blue-200">|</span>
          <a
            href="https://tax.gov.ae"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            FTA <ExternalLink className="h-2.5 w-2.5" />
          </a>
          <span className="text-blue-200">|</span>
          <span className="font-mono text-[10px] text-blue-400/50">v1.0.0</span>
        </div>
      </div>
    </footer>
  );
}
