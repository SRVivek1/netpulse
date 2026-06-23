import { cn } from '../../lib/utils';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('np-card overflow-hidden', className)}>
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
