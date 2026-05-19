import React from 'react';
import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import InfoPopover from './InfoPopover.jsx';

const VALUE_COLORS = {
  'kc-g': '#10b981',
  'kc-r': '#ef4444',
  'kc-b': '#3b82f6',
  'kc-p': '#8b5cf6',
  'kc-c': '#06b6d4',
  'kc-y': '#f59e0b',
};

const DELTA_STYLES = {
  up:   { color: '#059669', prefix: '▲ ' },
  down: { color: '#ef4444', prefix: '▼ ' },
  neut: { color: '#9ca3af', prefix: '' },
};

// Shared stagger variant — parent must set custom={i}
export const kpiVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.36, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export default function KpiCard({ label, value, sub, icon, colorClass, delta, deltaDir = 'neut', info, custom }) {
  const color = VALUE_COLORS[colorClass] || '#10b981';
  const ds = DELTA_STYLES[deltaDir] || DELTA_STYLES.neut;

  return (
    <motion.div
      className={`kpi-card ${colorClass}`}
      custom={custom}
      variants={kpiVariants}
      initial="hidden"
      animate="visible"
      whileHover={{
        scale: 1.018,
        boxShadow: `0 8px 28px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)`,
        y: -2,
        transition: { duration: 0.22, ease: 'easeOut' },
      }}
    >
      {/* Label row */}
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.10em',
        color: '#9ca3af', marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 5,
        fontWeight: 600,
      }}>
        {label}
        {info && <InfoPopover title={info.title || label} description={info.description} />}
      </div>

      {/* Value */}
      <div
        style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', marginBottom: 4, color }}
      >
        {value}
      </div>

      {/* Delta / sub */}
      {delta
        ? <div style={{ fontSize: 10.5, fontWeight: 600, color: ds.color }}>{ds.prefix}{delta}</div>
        : <div style={{ fontSize: 11, color: '#9ca3af' }}>{sub}</div>
      }
      {delta && sub && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}

      {/* Background icon */}
      <Icon
        name={icon}
        size="text-[26px]"
        style={{
          position: 'absolute', top: 14, right: 14,
          opacity: 0.10, color,
          pointerEvents: 'none',
        }}
      />
    </motion.div>
  );
}
