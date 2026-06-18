'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../lib/utils';
import { cn } from '../../lib/utils';

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      className={cn(
        'flex items-center justify-center size-[30px] rounded-md border cursor-pointer',
        'transition-all duration-150',
        copied
          ? 'border-emerald-400/40 bg-emerald-400/8 text-emerald-400'
          : 'border-white/10 bg-[#161a20] text-white/30 hover:border-white/20 hover:text-white/70',
        className
      )}
    >
      {copied
        ? <Check size={13} strokeWidth={2.5} />
        : <Copy size={13} strokeWidth={1.75} />
      }
    </button>
  );
}
