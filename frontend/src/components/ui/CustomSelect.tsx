'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  const close = useCallback(() => {
    setOpen(false);
    setHighlightedIndex(-1);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    const overflowStack: { el: HTMLElement; val: string }[] = [];
    let el = ref.current?.parentElement;
    while (el && el !== document.body) {
      const cs = window.getComputedStyle(el);
      if (cs.overflow === 'hidden' || cs.overflow === 'clip' ||
          cs.overflowX === 'hidden' || cs.overflowX === 'clip' ||
          cs.overflowY === 'hidden' || cs.overflowY === 'clip') {
        overflowStack.push({ el, val: el.style.overflow });
        el.style.overflow = 'visible';
      }
      el = el.parentElement;
    }
    return () => {
      overflowStack.forEach(({ el, val }) => { el.style.overflow = val; });
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  useEffect(() => {
    if (open && highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          onChange(options[highlightedIndex].value);
          close();
        }
        break;
      case 'Escape':
        close();
        break;
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left border rounded-xl bg-white transition-all duration-200
          ${open ? 'ring-2 ring-blue-500/30 border-blue-400' : 'border-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {displayLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[160px] bg-white border border-gray-200 rounded-xl shadow-lg shadow-gray-200/50 py-1.5 max-h-60 overflow-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div ref={listRef}>
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isHighlighted = i === highlightedIndex;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    close();
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-sm text-left transition-colors duration-100
                    ${isHighlighted ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
                    ${isSelected ? 'font-medium' : 'font-normal'}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
