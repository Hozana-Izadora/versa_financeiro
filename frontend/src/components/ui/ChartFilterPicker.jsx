import React, { useState, useRef, useEffect, useMemo } from 'react';
import Icon from './Icon.jsx';
import { MONTHS, getAvailableMonths } from '../../utils/formatters.js';

export default function ChartFilterPicker({ tx, override, setOverride, globalFilterState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const localYear   = override?.year ?? globalFilterState.year;
  const localMonths = override?.months ?? new Set();
  const isOverriding = override !== null;

  const availableYears = useMemo(() => {
    const ys = [...new Set(tx.map(r => new Date(r.data + 'T12:00').getFullYear()))].sort((a, b) => b - a);
    if (!ys.length) ys.push(new Date().getFullYear());
    return ys;
  }, [tx]);

  const availableMonths = useMemo(() => getAvailableMonths(tx, localYear), [tx, localYear]);

  function toggleMonth(m) {
    const next = new Set(localMonths);
    if (next.has(m)) next.delete(m); else next.add(m);
    setOverride({ year: localYear, months: next });
  }

  const label = useMemo(() => {
    if (!override) return null;
    const m = override.months;
    if (m.size === 0) return String(override.year);
    const sorted = [...m].sort((a, b) => a - b);
    if (sorted.length === 1) return `${MONTHS[sorted[0]]} ${override.year}`;
    return `${MONTHS[sorted[0]]}–${MONTHS[sorted[sorted.length - 1]]} ${override.year}`;
  }, [override]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Filtrar este gráfico"
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors border ${
          isOverriding
            ? 'text-accent border-accent/40 bg-accent/10'
            : 'text-text-3 border-transparent hover:text-text-base hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <Icon name="tune" size="text-[12px]" />
        <span>{isOverriding ? label : 'Filtrar'}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 bg-card rounded-card border border-slate-200 dark:border-slate-700 shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
          style={{ zIndex: 100, minWidth: 235, padding: '12px 14px' }}
        >
          <div className="text-[9.5px] font-semibold text-text-3 uppercase tracking-wider mb-1.5">Ano</div>
          <select
            value={localYear}
            onChange={e => setOverride({ year: +e.target.value, months: new Set() })}
            className="w-full text-[11px] border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-bg-1 text-text-base mb-3 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="text-[9.5px] font-semibold text-text-3 uppercase tracking-wider mb-1.5">Meses</div>
          <div className="flex flex-wrap gap-1 mb-3">
            <button
              onClick={() => setOverride({ year: localYear, months: new Set() })}
              className={`text-[9.5px] px-2 py-0.5 rounded-full border transition-colors ${
                isOverriding && localMonths.size === 0
                  ? 'bg-accent text-white border-accent'
                  : 'border-slate-300 dark:border-slate-600 text-text-3 hover:border-accent hover:text-accent'
              }`}
            >
              Todos
            </button>
            {[0,1,2,3,4,5,6,7,8,9,10,11].map(m => {
              const hasData = availableMonths.includes(m);
              const sel = localMonths.has(m);
              return (
                <button
                  key={m}
                  onClick={() => hasData && toggleMonth(m)}
                  className={`text-[9.5px] px-2 py-0.5 rounded-full border transition-colors ${
                    sel
                      ? 'bg-accent text-white border-accent'
                      : hasData
                      ? 'border-slate-300 dark:border-slate-600 text-text-3 hover:border-accent hover:text-accent'
                      : 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-default'
                  }`}
                >
                  {MONTHS[m]}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => { setOverride(null); setOpen(false); }}
              className="text-[10px] text-text-3 hover:text-red-400 transition-colors"
            >
              ↩ Usar filtro global
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-[10px] text-text-3 hover:text-text-base transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
