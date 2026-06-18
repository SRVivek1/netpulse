import { cn } from '../../lib/utils';

type Variant = 'green' | 'blue' | 'orange' | 'yellow' | 'red' | 'slate' | 'violet';

const styles: Record<Variant, string> = {
  green:  'bg-emerald-400/10 text-emerald-400 border-emerald-400/25',
  blue:   'bg-sky-400/10     text-sky-400     border-sky-400/25',
  orange: 'bg-orange-400/10  text-orange-400  border-orange-400/25',
  yellow: 'bg-yellow-400/10  text-yellow-400  border-yellow-400/25',
  red:    'bg-red-400/10     text-red-400     border-red-400/25',
  slate:  'bg-white/5        text-white/50    border-white/10',
  violet: 'bg-violet-400/10  text-violet-400  border-violet-400/25',
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'slate', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-px rounded-full',
      'text-[0.67rem] font-semibold font-mono uppercase tracking-wide border',
      styles[variant],
      className
    )}>
      {children}
    </span>
  );
}
