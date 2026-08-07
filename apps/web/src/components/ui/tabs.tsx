'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex gap-[2px] bg-surface2 border border-border rounded-[9px] p-[3px]',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

/** Segmented trigger — active: surface bg + shadow; inactive: transparent muted. */
export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'border-none rounded-[7px] px-[14px] py-[5px] text-[12.5px] font-semibold font-sora cursor-pointer',
      'bg-transparent text-muted shadow-none',
      'data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:[box-shadow:0_1px_3px_rgba(0,0,0,.12)]',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = TabsPrimitive.Content;
