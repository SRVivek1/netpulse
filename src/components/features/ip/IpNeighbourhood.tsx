import { getIpNeighbourhood } from '../../../lib/ip';
import { CopyButton } from '../../ui/CopyButton';

interface Props {
  ip: string;
}

export function IpNeighbourhood({ ip }: Props) {
  const hood = getIpNeighbourhood(ip, 10);

  if (!hood) {
    return (
      <div className="np-card px-4 py-3">
        <p className="text-[0.68rem] uppercase tracking-[0.12em] font-semibold text-np-faint mb-1.5">
          IP neighbourhood
        </p>
        <p className="text-[0.75rem] text-np-muted">
          Neighbourhood lookup is available for IPv4 addresses only.
        </p>
      </div>
    );
  }

  return (
    <div className="np-card px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[0.68rem] uppercase tracking-[0.12em] font-semibold text-np-faint">
          IP neighbourhood <span className="text-np-faint font-normal">/24 block</span>
        </p>
        <CopyButton text={hood.ips.join('\n')} className="size-[26px] !rounded-md" />
      </div>
      <div className="flex flex-wrap gap-1.5 font-mono text-[0.72rem]">
        {hood.ips.map((addr, i) => (
          <span
            key={addr}
            className={
              i === hood.currentIndex
                ? 'px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/25'
                : 'px-2 py-0.5 rounded-md text-np-muted hover:text-np transition-colors'
            }
          >
            {addr}
          </span>
        ))}
      </div>
    </div>
  );
}
