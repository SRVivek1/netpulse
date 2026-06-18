import { cn } from '../../lib/utils';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'bg-[#161a20] border border-white/[0.06] rounded-xl',
      'shadow-[0_1px_3px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.25)]',
      'hover:border-white/[0.1] hover:shadow-[0_1px_3px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.25),0_0_20px_rgba(56,189,248,0.07)]',
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
      'text-[0.72rem] font-semibold uppercase tracking-[0.07em] text-white/30',
      'border-b border-white/[0.05]',
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
