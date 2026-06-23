import { cn } from '../../lib/utils';

export type CategoryKind = 'GEO' | 'BGP' | 'STACK' | 'WALL' | 'RBL' | 'PING' | 'MAP' | 'EDGE';

const KIND_STYLES: Record<CategoryKind, string> = {
  GEO:   'category-badge--geo',
  BGP:   'category-badge--bgp',
  STACK: 'category-badge--stack',
  WALL:  'category-badge--wall',
  RBL:   'category-badge--rbl',
  PING:  'category-badge--ping',
  MAP:   'category-badge--map',
  EDGE:  'category-badge--edge',
};

interface CategoryBadgeProps {
  kind: CategoryKind;
  className?: string;
}

export function CategoryBadge({ kind, className }: CategoryBadgeProps) {
  return (
    <span className={cn('category-badge', KIND_STYLES[kind], className)}>
      {kind}
    </span>
  );
}
