'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { applyTheme, getStoredTheme, getThemeMeta, THEMES, type ThemeId } from '../../lib/theme';
import { cn } from '../../lib/utils';

export function ThemeSelector() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeId>('dark');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const active = getThemeMeta(current);

  const selectTheme = (id: ThemeId) => {
    applyTheme(id);
    setCurrent(id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${active.name}`}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-[0.7rem]',
          'font-mono bg-elevated border border-np cursor-pointer',
          'text-np-muted hover:text-np transition-colors',
        )}
      >
        <span
          className="size-[10px] rounded-full shrink-0"
          style={{ backgroundColor: active.swatch }}
          aria-hidden="true"
        />
        <ChevronDown
          size={12}
          className={cn('shrink-0 transition-transform duration-150', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Theme options"
          className={cn(
            'absolute right-0 top-[calc(100%+6px)] z-20 min-w-[160px]',
            'rounded-xl border border-np bg-elevated shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
            'py-1.5 animate-fade-up',
          )}
        >
          <p className="px-3 pt-1 pb-2 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-np-faint">
            Theme
          </p>
          {THEMES.map((theme) => {
            const selected = theme.id === current;
            return (
              <button
                key={theme.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectTheme(theme.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left text-[0.82rem]',
                  'border-0 cursor-pointer transition-colors',
                  selected
                    ? 'bg-[var(--np-accent)]/10 text-np'
                    : 'bg-transparent text-np-muted hover:bg-hover hover:text-np',
                )}
              >
                <span
                  className="size-[10px] rounded-full shrink-0"
                  style={{ backgroundColor: theme.swatch }}
                  aria-hidden="true"
                />
                <span className="flex-1">{theme.name}</span>
                {selected && (
                  <Check size={14} className="text-[#8b5cf6] shrink-0" strokeWidth={2.5} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
