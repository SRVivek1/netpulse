interface Props {
  headers: Record<string, string>;
}

export function RequestHeadersPanel({ headers }: Props) {
  const entries = Object.entries(headers);

  if (!entries.length) {
    return <p className="px-4 py-3 text-[0.75rem] text-np-muted">No headers available.</p>;
  }

  return (
    <div className="max-h-64 overflow-y-auto">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 px-4 py-2.5
                     border-b border-np last:border-0 hover:bg-hover/50"
        >
          <span className="text-[0.72rem] text-accent/60 font-mono shrink-0 sm:w-44">{key}</span>
          <span className="text-[0.72rem] text-np-muted font-mono break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}
