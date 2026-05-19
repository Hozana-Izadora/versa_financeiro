import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill text-[10.5px] font-semibold whitespace-nowrap px-2 py-0.5',
  {
    variants: {
      variant: {
        green:  'bg-[rgba(16,185,129,0.10)] text-[#059669]',
        red:    'bg-[rgba(239,68,68,0.10)]  text-[#dc2626]',
        blue:   'bg-[rgba(59,130,246,0.10)] text-[#2563eb]',
        purple: 'bg-[rgba(139,92,246,0.10)] text-[#7c3aed]',
        amber:  'bg-[rgba(245,158,11,0.10)] text-[#d97706]',
        cyan:   'bg-[rgba(6,182,212,0.10)]  text-[#0891b2]',
        gray:   'bg-slate-100 text-text-2 border border-[rgba(0,0,0,0.08)]',
        outline:'bg-transparent text-text-2 border border-[rgba(0,0,0,0.12)]',
      },
      size: {
        default: 'text-[10.5px] px-2 py-0.5',
        sm:      'text-[9.5px]  px-1.5 py-px',
        lg:      'text-[12px]   px-2.5 py-1',
      },
    },
    defaultVariants: { variant: 'green', size: 'default' },
  }
);

export default function Badge({ children, variant, size, className, dot, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'currentColor', flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}

export { badgeVariants };
