import React from 'react';
import Icon from './Icon.jsx';

// Collapses a chart panel down to just its header — lets the user hide charts they
// don't need right now without leaving the page, reducing how much has to be scrolled.
export default function MinimizeBtn({ collapsed, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={collapsed ? 'Expandir gráfico' : 'Minimizar gráfico'}
      className="flex items-center justify-center text-text-3 hover:text-text-base transition-colors cursor-pointer"
      style={{ width: 22, height: 22, background: 'none', border: 'none' }}
    >
      <Icon
        name="expand_more"
        size="text-[16px]"
        className="transition-transform duration-150"
        style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
      />
    </button>
  );
}
