import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
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
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white dark:bg-[#161b22] border-b px-5 lg:px-8 py-2.5 flex items-center gap-3 flex-wrap transition-colors"
      style={{ borderColor: 'rgba(0,0,0,0.07)' }}
    >
      {/* Year selector */}
      <div className="flex items-center gap-2">
        <span className="text-[9.5px] uppercase tracking-[0.12em] text-text-3 font-semibold">Ano</span>
        <select
          value={filterState.year}
          onChange={e => actions.applyFilter({ year: +e.target.value, months: new Set() })}
          style={{ fontSize: 12, paddingTop: 5, paddingBottom: 5, minWidth: 70 }}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)' }} />

      {/* Month pills */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-[240px]">
        <span className="text-[9.5px] uppercase tracking-[0.12em] text-text-3 font-semibold mb-0.5">Período</span>
        <div className="flex gap-1 flex-wrap items-center">
          {/* All button */}
          <button
            onClick={selectAllMonths}
            className="transition-all"
            style={{
              padding: '3px 9px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: '1px solid',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              background: filterState.months.size === 0 ? '#10b981' : '#ffffff',
              color:      filterState.months.size === 0 ? '#ffffff' : '#6b7280',
              borderColor: filterState.months.size === 0 ? '#10b981' : 'rgba(0,0,0,0.10)',
              boxShadow: filterState.months.size === 0 ? '0 2px 8px rgba(16,185,129,0.25)' : 'none',
            }}
          >
            Todos
          </button>

          {MONTHS.map((m, i) => {
            const disabled = !filterState.availableMonths.includes(i);
            const active   = filterState.months.has(i);
            return (
              <motion.button
                key={i}
                onClick={() => !disabled && toggleMonth(i)}
                disabled={disabled}
                whileHover={!disabled && !active ? { scale: 1.06 } : {}}
                whileTap={!disabled ? { scale: 0.95 } : {}}
                style={{
                  padding: '3px 9px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  border: '1px solid',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                  opacity: disabled ? 0.3 : 1,
                  background: active ? '#10b981' : '#ffffff',
                  color:      active ? '#ffffff' : '#6b7280',
                  borderColor: active ? '#10b981' : 'rgba(0,0,0,0.10)',
                  boxShadow:  active ? '0 2px 8px rgba(16,185,129,0.25)' : 'none',
                }}
              >
                {m}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)' }} />

      {/* Group filter */}
      <div className="flex items-center gap-2">
        <span className="text-[9.5px] uppercase tracking-[0.12em] text-text-3 font-semibold">Grupo</span>
        <select
          value={filterState.group}
          onChange={e => actions.applyFilter({ group: e.target.value })}
          style={{ fontSize: 12, paddingTop: 5, paddingBottom: 5 }}
        >
          <option value="all">Todos</option>
          {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
    </motion.div>
  );
}
