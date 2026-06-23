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
      'border-b border-np last:border-0',
      'hover:bg-hover/50 transition-colors group',
      className
    )}>
      <span className="text-[0.76rem] font-semibold text-np-muted min-w-0 truncate">
        {label}
      </span>
      <span className={cn(
        'text-[0.84rem] text-np text-right flex items-center gap-1.5 shrink-0 justify-end',
        mono && 'font-mono text-[0.78rem]'
      )}>
        {value ?? <span className="text-np-faint">—</span>}
      </span>
    </div>
  );
}
