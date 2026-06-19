interface Props {
  headers: Record<string, string>;
}

export function RequestHeadersPanel({ headers }: Props) {
  const entries = Object.entries(headers);

  if (!entries.length) {
    return <p className="px-4 py-3 text-[0.75rem] text-white/35">No headers available.</p>;
  }

  return (
    <div className="max-h-64 overflow-y-auto">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 px-4 py-2.5
                     border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
        >
          <span className="text-[0.72rem] text-sky-400/60 font-mono shrink-0 sm:w-44">{key}</span>
          <span className="text-[0.72rem] text-white/70 font-mono break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}
