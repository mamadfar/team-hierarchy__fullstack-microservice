import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-[99px] whitespace-nowrap', {
  variants: {
    variant: {
      /** Application chips: surface2 bg + solid border. */
      outline: 'text-[11.5px] bg-surface2 border border-border px-[10px] py-[3px] text-text',
      /** Keyword chips: dashed border, muted. */
      dashed: 'text-[11px] text-muted border border-dashed border-border px-[9px] py-[2px]',
    },
  },
  defaultVariants: { variant: 'outline' },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
