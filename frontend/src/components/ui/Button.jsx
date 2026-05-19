import React from 'react';
import { motion } from 'framer-motion';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-[12.5px] font-semibold transition-all cursor-pointer select-none border-0',
  {
    variants: {
      variant: {
        primary: 'text-white',
        ghost:   'bg-white text-text-2 dark:bg-[#21262d] dark:text-[#adbac7]',
        danger:  'text-white',
        outline: 'bg-transparent text-text-2',
        link:    'bg-transparent text-accent underline-offset-2 hover:underline p-0 h-auto',
      },
      size: {
        default: 'px-3.5 py-2',
        sm:      'px-2.5 py-1.5 text-[11px]',
        lg:      'px-5 py-2.5 text-[13.5px]',
        icon:    'p-1.5 w-7 h-7',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  }
);

const VARIANT_STYLES = {
  primary: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    boxShadow: '0 1px 3px rgba(16,185,129,0.25)',
  },
  ghost: {
    border: '1px solid rgba(0,0,0,0.10)',
  },
  danger: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    boxShadow: '0 1px 3px rgba(239,68,68,0.25)',
  },
  outline: {
    border: '1.5px solid rgba(0,0,0,0.12)',
  },
  link: {},
};

const HOVER_STYLES = {
  primary: { scale: 1.015, boxShadow: '0 6px 20px rgba(16,185,129,0.30)' },
  ghost:   { scale: 1.01,  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', y: -1 },
  danger:  { scale: 1.015, boxShadow: '0 4px 16px rgba(239,68,68,0.28)' },
  outline: { scale: 1.01,  y: -1 },
  link:    {},
};

export default function Button({
  children,
  variant = 'primary',
  size = 'default',
  className,
  disabled,
  onClick,
  type = 'button',
  style,
  ...props
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={!disabled ? HOVER_STYLES[variant] : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      transition={{ duration: 0.20, ease: 'easeOut' }}
      className={cn(buttonVariants({ variant, size }), disabled && 'opacity-50 cursor-not-allowed', className)}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export { buttonVariants };
