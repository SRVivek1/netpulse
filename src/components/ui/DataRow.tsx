import { cn } from '../../lib/utils';

interface DataRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}

export function DataRow({ label, value, mono = false, className }: DataRowProps) {
  return (
    <div className={cn(
      'flex items-baseline justify-between gap-3 px-4 py-[9px]',
      'border-b border-white/[0.04] last:border-0',
      'hover:bg-white/[0.02] transition-colors group',
      className
    )}>
      <span className="text-[0.76rem] text-white/30 shrink-0 whitespace-nowrap">
        {label}
      </span>
      <span className={cn(
        'text-[0.84rem] text-white/85 text-right flex items-center gap-1.5 flex-wrap justify-end',
        mono && 'font-mono text-[0.78rem]'
      )}>
        {value ?? <span className="text-white/20">—</span>}
      </span>
    </div>
  );
}
