import { cn } from '../../lib/utils';

interface DataFieldProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}

export function DataField({ label, value, mono = false, className }: DataFieldProps) {
  return (
    <div className={cn('data-field', className)}>
      <p className="data-field__label">{label}</p>
      <div className={cn('data-field__value', mono && 'font-mono')}>
        {value ?? '—'}
      </div>
    </div>
  );
}
