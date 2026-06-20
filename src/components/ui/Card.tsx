import { cn } from '../../lib/utils';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'bg-elevated border border-np rounded-xl',
      'shadow-[0_1px_3px_var(--np-shadow),0_4px_16px_var(--np-shadow)]',
      'hover:border-[var(--np-border-strong)] hover:shadow-[0_1px_3px_var(--np-shadow),0_4px_16px_var(--np-shadow),0_0_20px_var(--np-accent-subtle)]',
      'transition-all duration-200 overflow-hidden',
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-3',
      'text-[0.72rem] font-semibold uppercase tracking-[0.07em] text-np-faint',
      'border-b border-np',
      className
    )}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('py-1', className)}>
      {children}
    </div>
  );
}
