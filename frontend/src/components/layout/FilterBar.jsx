import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import { MONTHS, getYears, getAvailableMonths, getExtraFieldKeys } from '../../utils/formatters.js';
import Icon from '../ui/Icon.jsx';

export default function FilterBar() {
  const { state, actions, dispatch } = useApp();
  const { filterState, transactions, currentPage } = state;

  const tx = currentPage === 'competencia' ? transactions.competencia : transactions.caixa;
  const years = getYears(transactions);

  useEffect(() => {
    const avail = getAvailableMonths(tx, filterState.year);
    dispatch({ type: 'SET_FILTER', payload: { availableMonths: avail } });
  }, [filterState.year, currentPage, transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const costCenterValues = filterState.costCenterField
    ? [...new Set(tx.map(r => r.extra?.[filterState.costCenterField]).filter(Boolean))].sort()
    : [];

  function openCostCenterConfig() {
    const keys = getExtraFieldKeys(tx);
    let selected = filterState.costCenterField || '';

    actions.openModal(
      <div>
        <div className="font-inter font-bold text-base mb-4 flex items-center gap-2">
          <Icon name="tune" size="text-[18px]" className="text-accent" /> Configurar Centro de Custo
        </div>
        {keys.length === 0 ? (
          <div className="text-[13px] text-text-2 mb-4">
            Nenhum campo extra encontrado nos lançamentos ainda. Cadastre um campo adicional
            (ex: "Centro de Custo" ou "Unidade de Negócio") ao importar dados ou editar um
            lançamento — depois volte aqui para selecioná-lo como filtro.
          </div>
        ) : (
          <div className="field">
            <label>Campo que representa Centro de Custo / Unidade de Negócio</label>
            <select defaultValue={selected} onChange={e => { selected = e.target.value; }}>
              <option value="">— Nenhum —</option>
              {keys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button
            className="btn btn-primary flex-1"
            onClick={async () => {
              try {
                await actions.setCostCenterField(selected || null);
                actions.closeModal();
                actions.notify('Centro de Custo configurado!', 'ns');
              } catch (e) { actions.notify(e.message, 'ne'); }
            }}
          >
            Salvar
          </button>
          <button className="btn btn-ghost" onClick={actions.closeModal}>Cancelar</button>
        </div>
      </div>
    );
  }

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
          onChange={e => {
            const newYear = +e.target.value;
            const updates = { year: newYear, months: new Set() };
            if (filterState.compareYear === newYear) updates.compareYear = null;
            actions.applyFilter(updates);
          }}
          style={{ fontSize: 12, paddingTop: 5, paddingBottom: 5, minWidth: 70 }}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Compare year selector — o Orçamento é sempre do ano selecionado, sem comparação entre anos */}
      {years.length > 1 && currentPage !== 'orcamento' && (
        <div className="flex items-center gap-2">
          <span className="text-[9.5px] uppercase tracking-[0.12em] text-text-3 font-semibold">vs</span>
          <select
            value={filterState.compareYear ?? ''}
            onChange={e => actions.applyFilter({ compareYear: e.target.value ? +e.target.value : null })}
            style={{ fontSize: 12, paddingTop: 5, paddingBottom: 5, minWidth: 70 }}
          >
            <option value="">—</option>
            {years.filter(y => y !== filterState.year).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

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

      {/* Cost center / business unit filter */}
      <div className="flex items-center gap-2">
        <span className="text-[9.5px] uppercase tracking-[0.12em] text-text-3 font-semibold">Centro de Custo</span>
        {filterState.costCenterField ? (
          <select
            value={filterState.costCenter}
            onChange={e => actions.applyFilter({ costCenter: e.target.value })}
            style={{ fontSize: 12, paddingTop: 5, paddingBottom: 5 }}
          >
            <option value="all">Todos</option>
            {costCenterValues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : (
          <span className="text-[11px] text-text-3 italic">não configurado</span>
        )}
        <button
          type="button"
          title="Configurar campo de Centro de Custo"
          onClick={openCostCenterConfig}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 2 }}
        >
          <Icon name="tune" size="text-[14px]" />
        </button>
      </div>
    </motion.div>
  );
}
