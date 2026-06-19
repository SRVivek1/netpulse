import { getIpNeighbourhood } from '../../../lib/ip';
import { CopyButton } from '../../ui/CopyButton';

interface Props {
  ip: string;
}

export function IpNeighbourhood({ ip }: Props) {
  const hood = getIpNeighbourhood(ip, 10);

  if (!hood) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[0.68rem] uppercase tracking-[0.12em] font-semibold text-white/25 mb-1.5">
          IP neighbourhood
        </p>
        <p className="text-[0.75rem] text-white/35">
          Neighbourhood lookup is available for IPv4 addresses only.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[0.68rem] uppercase tracking-[0.12em] font-semibold text-white/25">
          IP neighbourhood <span className="text-white/15 font-normal">/24 block</span>
        </p>
        <CopyButton text={hood.ips.join('\n')} className="size-[26px] !rounded-md" />
      </div>
      <div className="flex flex-wrap gap-1.5 font-mono text-[0.72rem]">
        {hood.ips.map((addr, i) => (
          <span
            key={addr}
            className={
              i === hood.currentIndex
                ? 'px-2 py-0.5 rounded-md bg-sky-400/15 text-sky-300 border border-sky-400/25'
                : 'px-2 py-0.5 rounded-md text-white/35 hover:text-white/55 transition-colors'
            }
          >
            {addr}
          </span>
        ))}
      </div>
    </div>
  );
}
