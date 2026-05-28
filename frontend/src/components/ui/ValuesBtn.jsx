import React from 'react';
import Icon from './Icon.jsx';

export default function ValuesBtn({ show, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={show ? 'Ocultar valores' : 'Exibir valores'}
      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
        show
          ? 'text-accent border-accent/40 bg-accent/10'
          : 'text-text-3 border-transparent hover:text-text-base hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <Icon name={show ? 'visibility' : 'visibility_off'} size="text-[12px]" />
      <span>Valores</span>
    </button>
  );
}
