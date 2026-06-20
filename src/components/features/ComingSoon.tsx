import { Construction } from 'lucide-react';

export default function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
      <Construction className="text-np-faint" size={40} strokeWidth={1.25} />
      <p className="font-display font-semibold text-np-muted text-lg">{label}</p>
      <p className="font-mono text-[0.75rem] text-np-faint">Coming in the next build</p>
    </div>
  );
}
