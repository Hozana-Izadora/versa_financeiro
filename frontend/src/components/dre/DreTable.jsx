import React, { useState, useEffect, useMemo } from 'react';
import { fmt, fmtSigned, fmtPct, pct, MONTHS } from '../../utils/formatters.js';
import Icon from '../ui/Icon.jsx';

// Rounds to cents before comparing to zero — a value like -0.0001 is float dust left
// over from summing many transactions, displays as "0,00", and must read as neutral,
// not red.
function roundedSign(v) {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : (r > 0 ? 1 : -1);
}

// `isPos` reflects the row's usual direction (Entrada vs. Saída), but a value can still
// come out negative — e.g. the "não classificadas" reconciliation rows, which are a
// subtraction rather than a sum of (always non-negative) transaction amounts. Whenever
// that happens the actual sign must win, red, regardless of the row's normal convention.
function cellColorCls(v, isPos) {
  const s = roundedSign(v);
  if (s === 0) return 'cv-neu';
  if (s < 0) return 'cv-neg';
  return isPos ? 'cv-pos' : 'cv-neg';
}

// For rows whose color must follow the value's own sign (Margem, Lucro Líquido, Saldo)
// rather than a fixed row-level direction — zero stays neutral, not green.
function signCls(v) {
  const s = roundedSign(v);
  return s === 0 ? 'cv-neu' : (s > 0 ? 'cv-pos' : 'cv-neg');
}

const PERIOD_OPTIONS = [
  { key: 'mensal', label: 'Mensal', size: 1 },
  { key: 'bimestral', label: 'Bimestral', size: 2 },
  { key: 'trimestral', label: 'Trimestral', size: 3 },
  { key: 'quadrimestral', label: 'Quadrimestral', size: 4 },
  { key: 'semestral', label: 'Semestral', size: 6 },
  { key: 'total', label: 'Total', size: 12 },
];

function bucketLabel(bucket) {
  if (bucket.months.length === 1) return MONTHS[bucket.months[0]];
  return `${MONTHS[bucket.months[0]]}–${MONTHS[bucket.months[bucket.months.length - 1]]}`;
}

// Sums a row's month values into one bucket. `saldo-acum` is a running balance (a
// "photo", not a flow) — summing it across months would be meaningless, so it takes
// the value of the bucket's last month instead.
function aggregateCell(row, bucket, monthIdxMap) {
  if (row.type === 'saldo-acum') {
    const lastM = bucket.months[bucket.months.length - 1];
    const idx = monthIdxMap.get(lastM);
    return {
      v: idx != null ? (row.monthValues[idx] ?? 0) : 0,
      refV: idx != null ? (row.refValues?.[idx] ?? 0) : 0,
    };
  }
  let v = 0, refV = 0;
  for (const m of bucket.months) {
    const idx = monthIdxMap.get(m);
    if (idx == null) continue;
    v += row.monthValues[idx] ?? 0;
    refV += row.refValues?.[idx] ?? 0;
  }
  return { v, refV };
}

// `onDoubleClick` drills into Lançamentos filtered to this exact cell's period — a
// month cell drills to just that month, a bimestral/trimestral/etc. cell to its whole
// span, so the filter the user lands on matches exactly what they double-clicked.
function CellValue({ v, refV, isPos, showPct, onDoubleClick }) {
  const cls = cellColorCls(v, isPos);
  return (
    <td
      className={cls}
      onDoubleClick={onDoubleClick}
      style={onDoubleClick ? { cursor: 'pointer' } : undefined}
      title={onDoubleClick ? 'Duplo clique para ver lançamentos deste período' : undefined}
    >
      {v === 0 ? '—' : fmtSigned(v)}
      {showPct && refV > 0 && <span className="cv-pct">{fmtPct(pct(v, refV))}</span>}
    </td>
  );
}

function TotalCell({ v, isPos, showPct, refV, onDoubleClick }) {
  const cls = cellColorCls(v, isPos);
  return (
    <td
      className={cls}
      onDoubleClick={onDoubleClick}
      style={onDoubleClick ? { cursor: 'pointer' } : undefined}
      title={onDoubleClick ? 'Duplo clique para ver lançamentos do período total' : undefined}
    >
      {v === 0 ? '—' : fmtSigned(v)}
      {showPct && refV > 0 && <span className="cv-pct">{fmtPct(pct(v, refV))}</span>}
    </td>
  );
}

// Date range covering the demonstrativo's currently visible months — used so a
// drill-down click also filters Lançamentos by date, not just cat/grp/tipo.
function visMonthsDateRange(year, visMonths) {
  if (!year || !visMonths?.length) return { dateFrom: null, dateTo: null };
  const pad = n => String(n).padStart(2, '0');
  const minM = Math.min(...visMonths);
  const maxM = Math.max(...visMonths);
  const lastDay = new Date(year, maxM + 1, 0).getDate();
  return {
    dateFrom: `${year}-${pad(minM + 1)}-01`,
    dateTo: `${year}-${pad(maxM + 1)}-${pad(lastDay)}`,
  };
}

export default function DreTable({ dre, onDrillItem, onDrillGroup, showPct, filterCat, regime, maxHeight = '70vh' }) {
  const { dateFrom, dateTo } = visMonthsDateRange(dre.year, dre.visMonths);

  // Dois níveis de recolhimento, cada um agindo sobre seu próprio conjunto de ids sem
  // mexer no do outro nível (aditivo/subtrativo sobre `collapsed`, nunca substituindo o
  // Set inteiro) — assim "Recolher Tipo" seguido de "Recolher Grupo" e depois só
  // "Expandir Grupo" mantém os Tipos ainda fechados, como esperado numa hierarquia real.
  //
  // Nível Tipo: esconde só as linhas sem negrito (item, texto normal), recolhendo todo
  // sid usado por algum item como parentSid — o sid de um Grupo (subgroup) de verdade,
  // ou o sid sintético que categorias sem Grupo (ex.: "Entradas/Saídas não
  // classificadas") usam só para isso. Nunca reaproveita o gid da Categoria, que
  // pertence ao nível Grupo — ids compartilhados entre os dois níveis fariam expandir um
  // nível re-revelar linhas que o outro tinha recolhido.
  const tipoLevelIds = useMemo(
    () => new Set(dre.rows.filter(r => r.type === 'item' && r.parentSid).map(r => r.parentSid)),
    [dre.rows],
  );

  // Nível Grupo: recolhe a própria Categoria (group, via gid), escondendo Grupo e Tipo
  // de uma vez — sobra só o cabeçalho em negrito da Categoria.
  const grupoLevelIds = useMemo(
    () => new Set(dre.rows.filter(r => r.type === 'group').map(r => r.gid)),
    [dre.rows],
  );

  // collapsed = ids the user manually folded; default: none (all open)
  const [collapsed, setCollapsed] = useState(new Set());

  // Reset collapsed when filter changes or rows change
  useEffect(() => { setCollapsed(new Set()); }, [filterCat, dre.rows]);

  function toggle(id) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function addIds(ids) {
    setCollapsed(prev => new Set([...prev, ...ids]));
  }
  function removeIds(ids) {
    setCollapsed(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  }

  const isExpanded = (id) => !collapsed.has(id);
  const collapseTipo  = () => addIds(tipoLevelIds);
  const expandTipo    = () => removeIds(tipoLevelIds);
  const collapseGrupo = () => addIds(grupoLevelIds);
  const expandGrupo   = () => removeIds(grupoLevelIds);

  const { rows, visMonths } = dre;

  // Column period: how many months' worth of data each column aggregates. 'total'
  // collapses everything down to just the existing "Total" column.
  const [periodMode, setPeriodMode] = useState('mensal');

  const monthIdxMap = useMemo(() => new Map(visMonths.map((m, i) => [m, i])), [visMonths]);

  const columns = useMemo(() => {
    if (periodMode === 'total') return [];
    const size = PERIOD_OPTIONS.find(o => o.key === periodMode)?.size || 1;
    const buckets = new Map();
    for (const m of visMonths) {
      const b = Math.floor(m / size);
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(m);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([key, months]) => ({ key, months: months.sort((a, b) => a - b) }));
  }, [visMonths, periodMode]);

  // Date range per column — a drill-down double-click on a specific column (e.g. the
  // "Janeiro" cell) must filter Lançamentos to just that column's months, not the whole
  // demonstrativo period.
  const columnRanges = useMemo(
    () => columns.map(b => visMonthsDateRange(dre.year, b.months)),
    [columns, dre.year],
  );

  // When a category is filtered, only show that group tree (hide structural rows)
  const visibleRows = filterCat
    ? rows.filter(row => {
        if (row.type === 'group') return row.cat === filterCat;
        if (row.type === 'subgroup' || row.type === 'item') return row.cat === filterCat;
        return false;
      })
    : rows;

  // max-height + overflow-y here (not just overflow-x) is what makes the sticky
  // <thead> actually stick — an ancestor with only overflow-x set still becomes
  // the containing block for sticky descendants, but without its own bounded
  // vertical scroll the header has nothing to stick against.
  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      <div className="flex items-center justify-between gap-3 mb-1.5 px-4 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-1 flex-wrap">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriodMode(opt.key)}
              className={`text-[9.5px] font-semibold px-2 py-0.5 my-1 rounded-full border transition-colors cursor-pointer ${
                periodMode === opt.key
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-slate-200 dark:border-slate-600 text-text-3 hover:border-accent hover:text-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={expandGrupo}
              className="text-[10px] font-semibold text-text-3 hover:text-accent transition-colors cursor-pointer"
            >
              Expandir Grupo
            </button>
            <span className="text-[10px] text-text-3">·</span>
            <button
              type="button"
              onClick={collapseGrupo}
              className="text-[10px] font-semibold text-text-3 hover:text-accent transition-colors cursor-pointer"
            >
              Recolher Grupo
            </button>
          </div>
          <span className="text-[10px] text-text-3">|</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={expandTipo}
              className="text-[10px] font-semibold text-text-3 hover:text-accent transition-colors cursor-pointer"
            >
              Expandir Tipo
            </button>
            <span className="text-[10px] text-text-3">·</span>
            <button
              type="button"
              onClick={collapseTipo}
              className="text-[10px] font-semibold text-text-3 hover:text-accent transition-colors cursor-pointer"
            >
              Recolher Tipo
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto max-w-full" style={{ maxHeight, minHeight: 0, flex: '1 1 auto', overflowY: 'auto' }}>
      <table className="dre-tbl">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Descrição</th>
            {columns.map((b, bi) => <th key={bi}>{bucketLabel(b)}</th>)}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, i) => {
            if (row.type === 'section') {
              return (
                <tr key={i} className="dr-section">
                  <td>{row.label}</td>
                  {columns.map((_, bi) => <td key={bi}></td>)}
                  <td></td>
                </tr>
              );
            }

            if (row.type === 'group') {
              const isExp = isExpanded(row.gid);
              return (
                <tr key={i} className="dr-group" onClick={() => toggle(row.gid)} style={{ cursor: 'pointer' }}>
                  <td>
                    <Icon
                      name="chevron_right"
                      size="text-[14px]"
                      className="mr-1 text-text-3 inline-block transition-transform duration-150"
                      style={{ transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    />
                    {row.label}
                  </td>
                  {columns.map((b, bi) => {
                    const { v, refV } = aggregateCell(row, b, monthIdxMap);
                    return <CellValue key={bi} v={v} refV={refV} isPos={row.isPos} showPct={showPct} />;
                  })}
                  <TotalCell v={row.total} isPos={row.isPos} showPct={showPct} refV={row.totRef || 0} />
                </tr>
              );
            }

            if (row.type === 'subgroup') {
              if (!isExpanded(row.parentGid)) return null;
              const sExp = isExpanded(row.sid);
              const drillGroup = (range) => onDrillGroup?.({ cat: row.cat, grp: row.label, mov: row.movFilter, regime, dateFrom: range.dateFrom, dateTo: range.dateTo });
              return (
                <tr
                  key={i}
                  className="dr-item dr-subgroup"
                  onClick={() => toggle(row.sid)}
                  title="Clique para expandir/recolher · duplo clique numa célula para ver os lançamentos daquele período"
                >
                  <td
                    style={{ paddingLeft: '32px' }}
                    onDoubleClick={(e) => { e.stopPropagation(); drillGroup({ dateFrom, dateTo }); }}
                  >
                    <Icon
                      name="chevron_right"
                      size="text-[12px]"
                      className="mr-1 text-text-3 inline-block transition-transform duration-150"
                      style={{ transform: sExp ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    />
                    {row.label}
                  </td>
                  {columns.map((b, bi) => {
                    const { v, refV } = aggregateCell(row, b, monthIdxMap);
                    return (
                      <CellValue
                        key={bi} v={v} refV={refV} isPos={row.isPos} showPct={showPct}
                        onDoubleClick={(e) => { e.stopPropagation(); drillGroup(columnRanges[bi]); }}
                      />
                    );
                  })}
                  <TotalCell
                    v={row.total} isPos={row.isPos} showPct={showPct} refV={row.totRef || 0}
                    onDoubleClick={(e) => { e.stopPropagation(); drillGroup({ dateFrom, dateTo }); }}
                  />
                </tr>
              );
            }

            if (row.type === 'item') {
              if (!isExpanded(row.parentGid)) return null;
              if (row.parentSid && !isExpanded(row.parentSid)) return null;
              const drillItem = (range) => onDrillItem?.({ cat: row.cat, grp: row.grp, tipo: row.label, mov: row.movFilter, regime, dateFrom: range.dateFrom, dateTo: range.dateTo });
              return (
                <tr key={i} className="dr-item dr-cat" title="Duplo clique numa célula para ver os lançamentos daquele período">
                  <td
                    style={{ paddingLeft: '52px' }}
                    onDoubleClick={() => drillItem({ dateFrom, dateTo })}
                  >{row.label}</td>
                  {columns.map((b, bi) => {
                    const { v, refV } = aggregateCell(row, b, monthIdxMap);
                    return (
                      <CellValue
                        key={bi} v={v} refV={refV} isPos={row.isPos} showPct={showPct}
                        onDoubleClick={() => drillItem(columnRanges[bi])}
                      />
                    );
                  })}
                  <TotalCell
                    v={row.total} isPos={row.isPos} showPct={showPct} refV={row.totRef || 0}
                    onDoubleClick={() => drillItem({ dateFrom, dateTo })}
                  />
                </tr>
              );
            }

            if (row.type === 'subtotal') {
              const cls = row.isPos ? 'cv-pos' : 'cv-neg';
              return (
                <tr key={i} className="dr-subtotal">
                  <td style={{ paddingLeft: '8px' }}>{row.label}</td>
                  {columns.map((b, bi) => {
                    const { v, refV } = aggregateCell(row, b, monthIdxMap);
                    return (
                      <td key={bi} className={cls}>
                        {row.isPos ? fmt(v) : `(${fmt(v)})`}
                        {showPct && refV > 0 && <span className="cv-pct">{fmtPct(pct(v, refV))}</span>}
                      </td>
                    );
                  })}
                  <td className={cls}>
                    {row.isPos ? fmt(row.total) : `(${fmt(row.total)})`}
                    {showPct && row.totRef > 0 && <span className="cv-pct">{fmtPct(pct(row.total, row.totRef))}</span>}
                  </td>
                </tr>
              );
            }

            if (row.type === 'total') {
              return (
                <tr key={i} className="dr-total">
                  <td>{row.label}</td>
                  {columns.map((b, bi) => {
                    const { v, refV } = aggregateCell(row, b, monthIdxMap);
                    return (
                      <td key={bi} className={signCls(v)}>
                        {fmtSigned(v)}
                        {row.showPct && showPct && refV > 0 && (
                          <span className="cv-pct">{fmtPct(pct(v, refV))}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={signCls(row.total)}>
                    {fmtSigned(row.total)}
                    {row.showPct && showPct && row.totRef > 0 && (
                      <span className="cv-pct">{fmtPct(pct(row.total, row.totRef))}</span>
                    )}
                  </td>
                </tr>
              );
            }

            if (row.type === 'saldo') {
              return (
                <tr key={i} className="dr-saldo">
                  <td>{row.label}</td>
                  {columns.map((b, bi) => {
                    const { v, refV } = aggregateCell(row, b, monthIdxMap);
                    return (
                      <td key={bi} className={signCls(v)}>
                        {fmtSigned(v)}
                        {row.showPct && showPct && refV > 0 && (
                          <span className="cv-pct">{fmtPct(pct(v, refV))}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={signCls(row.total)}>
                    {fmtSigned(row.total)}
                    {row.showPct && showPct && row.totRef > 0 && (
                      <span className="cv-pct">{fmtPct(pct(row.total, row.totRef))}</span>
                    )}
                  </td>
                </tr>
              );
            }

            if (row.type === 'ajuste') {
              return (
                <tr key={i} className="dr-ajuste">
                  <td>{row.label}</td>
                  {columns.map((b, bi) => {
                    const { v } = aggregateCell(row, b, monthIdxMap);
                    return <td key={bi} className={signCls(v)}>{v === 0 ? '—' : fmtSigned(v)}</td>;
                  })}
                  <td className={signCls(row.total)}>{row.total === 0 ? '—' : fmtSigned(row.total)}</td>
                </tr>
              );
            }

            if (row.type === 'saldo-acum') {
              return (
                <tr key={i} className="dr-saldo-acum">
                  <td>{row.label}</td>
                  {columns.map((b, bi) => {
                    const { v, refV } = aggregateCell(row, b, monthIdxMap);
                    return (
                      <td key={bi} className={signCls(v)}>
                        {fmtSigned(v)}
                        {row.showPct && showPct && refV > 0 && (
                          <span className="cv-pct">{fmtPct(pct(v, refV))}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={signCls(row.total)}>
                    {fmtSigned(row.total)}
                    {row.showPct && showPct && row.totRef > 0 && (
                      <span className="cv-pct">{fmtPct(pct(row.total, row.totRef))}</span>
                    )}
                  </td>
                </tr>
              );
            }

            if (row.type === 'll') {
              return (
                <tr key={i} className="dr-ll">
                  <td>{row.label}</td>
                  {columns.map((b, bi) => {
                    const { v, refV } = aggregateCell(row, b, monthIdxMap);
                    return (
                      <td key={bi} className={signCls(v)}>
                        {fmtSigned(v)}
                        {row.showPct && showPct && refV > 0 && (
                          <span className="cv-pct">{fmtPct(pct(v, refV))}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={signCls(row.total)}>
                    {fmtSigned(row.total)}
                    {row.showPct && showPct && row.totRef > 0 && (
                      <span className="cv-pct">{fmtPct(pct(row.total, row.totRef))}</span>
                    )}
                  </td>
                </tr>
              );
            }

            return null;
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
