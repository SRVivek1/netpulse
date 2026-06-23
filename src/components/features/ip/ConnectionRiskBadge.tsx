import type { ConnectionRisk } from '../../../types/api';
import { Badge } from '../../ui/Badge';

const VARIANT = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
} as const;

interface Props {
  risk: ConnectionRisk;
  embedded?: boolean;
}

export function ConnectionRiskBadge({ risk, embedded = false }: Props) {
  const inner = (
    <>
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
    </>
  );

  if (embedded) return <div>{inner}</div>;

  return (
    <div className="np-card px-4 py-3">
      {inner}
    </div>
  );
}
