import React from 'react';

/**
 * Renders a Material Symbols Outlined icon.
 * @param {string} name - Material Symbol name, e.g. "account_balance"
 * @param {string} size - Tailwind text-size class, default "text-[18px]"
 * @param {string} className - Additional Tailwind classes
 * @param {object} style - Optional inline styles
 */
export default function Icon({ name, size = 'text-[18px]', className = '', style }) {
  return (
    <span
      className={`material-symbols-outlined leading-none select-none ${size} ${className}`}
      style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20", ...style }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
