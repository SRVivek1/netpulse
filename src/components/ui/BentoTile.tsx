import { cn } from '../../lib/utils';
import { CategoryBadge, type CategoryKind } from './CategoryBadge';

const LG_COL: Record<number, string> = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4',
  5: 'lg:col-span-5', 6: 'lg:col-span-6', 7: 'lg:col-span-7', 8: 'lg:col-span-8',
  9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
};

const MD_COL: Record<number, string> = {
  1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4',
  5: 'md:col-span-5', 6: 'md:col-span-6',
};

interface BentoTileProps {
  children: React.ReactNode;
  title: string;
  badge?: CategoryKind;
  numbered?: string;
  footer?: React.ReactNode;
  colSpan?: number;
  mdColSpan?: number;
  glass?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function BentoTile({
  children,
  title,
  badge,
  numbered,
  footer,
  colSpan = 12,
  mdColSpan,
  glass = false,
  className,
  style,
}: BentoTileProps) {
  return (
    <div
      className={cn(
        'bento-tile np-card flex flex-col justify-between p-4 sm:p-5',
        glass && 'np-card-glass',
        LG_COL[colSpan] ?? 'lg:col-span-12',
        mdColSpan != null ? MD_COL[mdColSpan] : 'md:col-span-6',
        className,
      )}
      style={style}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-3 border-b border-np pb-2">
          <span className="bento-tile__title">
            {numbered && (
              <span className="text-np-faint mr-1.5">{numbered}</span>
            )}
            {title}
          </span>
          {badge && <CategoryBadge kind={badge} />}
        </div>
        {children}
      </div>
      {footer && (
        <p className="bento-tile__footer mt-3">{footer}</p>
      )}
    </div>
  );
}
