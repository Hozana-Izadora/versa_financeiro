import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { MONTHS, getYears, getAvailableMonths } from '../../utils/formatters.js';

export default function FilterBar() {
  const { state, actions, dispatch } = useApp();
  const { filterState, transactions, currentPage } = state;

  const tx = currentPage === 'competencia' ? transactions.competencia : transactions.caixa;
  const years = getYears(transactions);

  useEffect(() => {
    const avail = getAvailableMonths(tx, filterState.year);
    dispatch({ type: 'SET_FILTER', payload: { availableMonths: avail } });
  }, [filterState.year, currentPage, transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const allGroups = [...new Set(tx.map(r => r.grp))].sort();

  function toggleMonth(m) {
    const next = new Set(filterState.months);
    next.has(m) ? next.delete(m) : next.add(m);
    actions.applyFilter({ months: next });
  }

  function selectAllMonths() {
    actions.applyFilter({ months: new Set() });
  }

  const hiddenPages = ['plano', 'importar'];
  if (hiddenPages.includes(currentPage)) return null;

  return (
    <div className="bg-bg-3 dark:bg-[#0f1623] border-b border-slate-100 dark:border-[#1e2d42] px-7 py-2 flex items-center gap-2 flex-wrap transition-colors">
      {/* Year */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] uppercase tracking-[1.5px] text-text-3">Ano</span>
        <select
          value={filterState.year}
          onChange={e => actions.applyFilter({ year: +e.target.value, months: new Set() })}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-[260px]">
        <span className="text-[9px] uppercase tracking-[1.5px] text-text-3">Período</span>
        <div className="flex gap-0.5 flex-wrap items-center">
          <button
            onClick={selectAllMonths}
            className={`px-2 py-1 rounded text-[11px] font-semibold transition-all border whitespace-nowrap cursor-pointer ${
              filterState.months.size === 0
                ? 'bg-white text-text-base border-slate-300'
                : 'bg-white text-text-2 border-dashed border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos
          </button>
          {MONTHS.map((m, i) => {
            const disabled = !filterState.availableMonths.includes(i);
            const active = filterState.months.has(i);
            return (
              <button
                key={i}
                onClick={() => !disabled && toggleMonth(i)}
                disabled={disabled}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all border whitespace-nowrap cursor-pointer ${
                  disabled ? 'opacity-30 cursor-not-allowed' : ''
                } ${
                  active
                    ? 'bg-accent border-accent text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]'
                    : 'bg-white text-text-2 border-slate-200 hover:bg-slate-50 hover:text-text-base'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Group */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] uppercase tracking-[1.5px] text-text-3">Grupo</span>
        <select
          value={filterState.group}
          onChange={e => actions.applyFilter({ group: e.target.value })}
        >
          <option value="all">Todos</option>
          {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
    </div>
  );
}
