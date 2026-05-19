import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils.js';

const cardVariants = {
  hidden:  { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export function Card({ children, className, style, hover = true, custom, animate = true, ...props }) {
  const Component = animate ? motion.div : 'div';
  const motionProps = animate
    ? {
        custom,
        initial: 'hidden',
        animate: 'visible',
        variants: cardVariants,
        whileHover: hover ? {
          scale: 1.010,
          boxShadow: '0 8px 28px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)',
          y: -2,
          transition: { duration: 0.22, ease: 'easeOut' },
        } : {},
      }
    : {};

  return (
    <Component
      {...motionProps}
      className={cn('bg-white dark:bg-[#161b22] rounded-card overflow-hidden', className)}
      style={{
        border: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div
      className={cn('px-5 py-3.5 flex items-center justify-between', className)}
      style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3
      className={cn('text-[13px] font-bold text-text-base dark:text-[#e6edf3]', className)}
      style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.2px' }}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }) {
  return (
    <div
      className={cn('px-5 py-3 flex items-center', className)}
      style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}
      {...props}
    >
      {children}
    </div>
  );
}
