'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type ?? 'text'}
      className={cn(
        'w-full box-border border border-border bg-surface text-[13px] text-text outline-none focus-ring-input',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
