import { BentoTile } from '../../ui/BentoTile';

const PROVIDERS = ['SPAMHAUS', 'ABUSEIPDB', 'BARRACUDA', 'SAFE BROWSING'] as const;

export function ThreatIntelPlaceholder() {
  return (
    <BentoTile
      title="Global reputation blacklist"
      badge="RBL"
      numbered="05 /"
      colSpan={12}
      mdColSpan={6}
      footer="Threat intel APIs — coming soon"
      className="h-full"
    >
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map((name) => (
          <div
            key={name}
            className="rounded-lg border border-np bg-[var(--np-bg-base)]/60 p-2.5"
          >
            <span className="text-[0.625rem] font-mono text-np-faint block">{name}</span>
            <span className="text-[0.7rem] font-mono text-np-faint mt-1 block">—</span>
          </div>
        ))}
      </div>
    </BentoTile>
  );
}
