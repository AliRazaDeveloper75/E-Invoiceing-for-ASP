'use client';

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface FieldTooltipProps {
  content: string;
}

export function FieldTooltip({ content }: FieldTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center ml-1">
      <button
        type="button"
        tabIndex={-1}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        className="text-gray-400 hover:text-blue-500 transition-colors focus:outline-none"
        aria-label="Field information"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                     w-56 rounded-lg bg-gray-900 px-3 py-2.5 text-xs text-white
                     shadow-lg leading-relaxed pointer-events-none"
        >
          {content}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2
                           border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  );
}
