'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-[5px] whitespace-nowrap cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 transition-colors duration-150 font-sora font-semibold',
  {
    variants: {
      variant: {
        primary:
          'border-none bg-accent text-accent-fg rounded-[7px] hover:bg-accent-hover text-[11.5px] font-semibold',
        outline:
          'border border-border bg-transparent rounded-[7px] text-muted hover:text-accent hover:border-accent text-[11.5px] font-normal font-sans',
        icon: 'border border-border bg-surface rounded-lg text-muted hover:bg-surface2 hover:text-text',
        ghost: 'border-none bg-transparent text-muted hover:text-text',
      },
      size: {
        sm: 'px-[9px] py-1',
        md: 'px-[11px] py-[5px]',
        iconMd: 'w-8 h-8',
        iconSm: 'w-[26px] h-[26px] rounded-[7px]',
        bare: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
