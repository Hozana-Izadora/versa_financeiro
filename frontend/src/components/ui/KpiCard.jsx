import React from 'react';
import Icon from './Icon.jsx';

const VALUE_COLORS = {
  'kc-g': '#10b981',
  'kc-r': '#ef4444',
  'kc-b': '#2563eb',
  'kc-p': '#7c3aed',
  'kc-c': '#0891b2',
  'kc-y': '#d97706',
};

export default function KpiCard({ label, value, sub, icon, colorClass }) {
  const color = VALUE_COLORS[colorClass] || '#2563eb';
  return (
    <div className={`kpi-card ${colorClass}`}>
      <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5">{label}</div>
      <div className="font-inter font-bold text-[22px] tracking-tight mb-1" style={{ color }}>{value}</div>
      <div className="text-[11px] text-text-3">{sub}</div>
      <Icon name={icon} size="text-[22px]" className="absolute top-3.5 right-3.5 opacity-20" style={{ color }} />
    </div>
  );
}
