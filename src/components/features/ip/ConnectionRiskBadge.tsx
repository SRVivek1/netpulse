import type { ConnectionRisk } from '../../../types/api';
import { Badge } from '../../ui/Badge';

const VARIANT = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
} as const;

interface Props {
  risk: ConnectionRisk;
}

export function ConnectionRiskBadge({ risk }: Props) {
  return (
    <div className="rounded-xl border border-np bg-[var(--np-overlay)] px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[0.68rem] uppercase tracking-[0.12em] font-semibold text-np-faint">
          Connection type
        </span>
        <Badge variant={VARIANT[risk.level]}>{risk.label}</Badge>
      </div>
      <ul className="space-y-1">
        {risk.reasons.map((reason) => (
          <li key={reason} className="text-[0.72rem] text-np-muted leading-relaxed flex gap-1.5">
            <span className="text-np-faint shrink-0">·</span>
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
