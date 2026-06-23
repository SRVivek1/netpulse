interface Props {
  headers: Record<string, string>;
  embedded?: boolean;
}

export function RequestHeadersPanel({ headers, embedded = false }: Props) {
  const entries = Object.entries(headers);
  const rowPad = embedded ? 'px-0 py-2.5' : 'px-4 py-2.5';
  const emptyPad = embedded ? 'py-3' : 'px-4 py-3';

  if (!entries.length) {
    return <p className={`${emptyPad} text-[0.75rem] text-np-muted`}>No headers available.</p>;
  }

  return (
    <div className={`max-h-64 overflow-y-auto ${embedded ? '-mx-1' : ''}`}>
      {entries.map(([key, value]) => (
        <div
          key={key}
          className={`flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 ${rowPad}
                     border-b border-np last:border-0 hover:bg-hover/50`}
        >
          <span className="text-[0.72rem] text-accent/60 font-mono shrink-0 sm:w-44">{key}</span>
          <span className="text-[0.72rem] text-np-muted font-mono break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}
