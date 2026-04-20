import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-3">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">

        {/* Left — copyright */}
        <p className="text-xs text-gray-400">
          &copy; {year} UAE E-Invoicing Platform &bull; PEPPOL 5-Corner
        </p>

        {/* Center — compliance badges */}
        <div className="flex items-center gap-2">
          {[
            { label: 'FTA Certified',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            { label: 'PEPPOL BIS 3.0', color: 'bg-blue-100 text-blue-700 border-blue-200' },
            { label: 'UBL 2.1',        color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
            { label: 'VAT Compliant',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
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
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors flex items-center gap-1">
            Home <ExternalLink className="h-2.5 w-2.5" />
          </Link>
          <span className="text-gray-200">|</span>
          <Link href="/contact" className="hover:text-gray-600 transition-colors">Contact</Link>
          <span className="text-gray-200">|</span>
          <a
            href="https://tax.gov.ae"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            FTA <ExternalLink className="h-2.5 w-2.5" />
          </a>
          <span className="text-gray-200">|</span>
          <span className="font-mono text-[10px]">v1.0.0</span>
        </div>
      </div>
    </footer>
  );
}
