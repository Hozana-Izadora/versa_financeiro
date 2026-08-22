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

function CellValue({ v, refV, isPos, showPct }) {
  const cls = cellColorCls(v, isPos);
  return (
    <td className={cls}>
      {v === 0 ? '—' : fmtSigned(v)}
      {showPct && refV > 0 && <span className="cv-pct">{fmtPct(pct(v, refV))}</span>}
    </td>
  );
}

function TotalCell({ v, isPos, showPct, refV }) {
  const cls = cellColorCls(v, isPos);
  return (
    <td className={cls}>
      {v === 0 ? '—' : fmtSigned(v)}
      {showPct && refV > 0 && <span className="cv-pct">{fmtPct(pct(v, refV))}</span>}
    </td>
  );
}

export default function DreTable({ dre, onDrillItem, onDrillGroup, showPct, filterCat, regime }) {
  // Every id that can be individually folded — group (Tipo) rows and subgroup (Grupo) rows.
  const allCollapsibleIds = useMemo(
    () => new Set(
      dre.rows
        .filter(r => r.type === 'group' || r.type === 'subgroup')
        .map(r => r.type === 'group' ? r.gid : r.sid)
    ),
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

  const isExpanded = (id) => !collapsed.has(id);
  const collapseAll = () => setCollapsed(new Set(allCollapsibleIds));
  const expandAll   = () => setCollapsed(new Set());

  const { rows, visMonths } = dre;

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
    <div>
      <div className="flex items-center justify-end gap-3 mb-1.5 px-0.5">
        <button
          type="button"
          onClick={expandAll}
          className="text-[10px] font-semibold text-text-3 hover:text-accent transition-colors cursor-pointer"
        >
          Expandir tudo
        </button>
        <span className="text-[10px] text-text-3">·</span>
        <button
          type="button"
          onClick={collapseAll}
          className="text-[10px] font-semibold text-text-3 hover:text-accent transition-colors cursor-pointer"
        >
          Recolher tudo
        </button>
      </div>
      <div className="overflow-x-auto max-w-full" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
      <table className="dre-tbl">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Descrição</th>
            {visMonths.map(m => <th key={m}>{MONTHS[m]}</th>)}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, i) => {
            if (row.type === 'section') {
              return (
                <tr key={i} className="dr-section">
                  <td>{row.label}</td>
                  {visMonths.map(m => <td key={m}></td>)}
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
                  {row.monthValues.map((v, mi) => (
                    <CellValue key={mi} v={v} refV={row.refValues?.[mi] || 0} isPos={row.isPos} showPct={showPct} />
                  ))}
                  <TotalCell v={row.total} isPos={row.isPos} showPct={showPct} refV={row.totRef || 0} />
                </tr>
              );
            }

            if (row.type === 'subgroup') {
              if (!isExpanded(row.parentGid)) return null;
              const sExp = isExpanded(row.sid);
              return (
                <tr key={i} className="dr-item" onClick={() => onDrillGroup?.({ cat: row.cat, grp: row.label, mov: row.movFilter, regime })}>
                  <td style={{ paddingLeft: '32px' }}>
                    <span
                      onClick={e => { e.stopPropagation(); toggle(row.sid); }}
                      style={{ cursor: 'pointer', display: 'inline-flex', verticalAlign: 'middle' }}
                    >
                      <Icon
                        name="chevron_right"
                        size="text-[12px]"
                        className="mr-1 text-text-3 inline-block transition-transform duration-150"
                        style={{ transform: sExp ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      />
                    </span>
                    {row.label}
                  </td>
                  {row.monthValues.map((v, mi) => (
                    <CellValue key={mi} v={v} refV={row.refValues?.[mi] || 0} isPos={row.isPos} showPct={showPct} />
                  ))}
                  <TotalCell v={row.total} isPos={row.isPos} showPct={showPct} refV={row.totRef || 0} />
                </tr>
              );
            }

            if (row.type === 'item') {
              if (!isExpanded(row.parentGid)) return null;
              if (row.parentSid && !isExpanded(row.parentSid)) return null;
              return (
                <tr key={i} className="dr-item dr-cat" onClick={() => onDrillItem?.({ cat: row.cat, grp: row.grp, tipo: row.label, mov: row.movFilter, regime })}>
                  <td style={{ paddingLeft: '52px' }}>{row.label}</td>
                  {row.monthValues.map((v, mi) => (
                    <CellValue key={mi} v={v} refV={row.refValues?.[mi] || 0} isPos={row.isPos} showPct={showPct} />
                  ))}
                  <TotalCell v={row.total} isPos={row.isPos} showPct={showPct} refV={row.totRef || 0} />
                </tr>
              );
            }

            if (row.type === 'subtotal') {
              const cls = row.isPos ? 'cv-pos' : 'cv-neg';
              const pRef = row.refValues;
              return (
                <tr key={i} className="dr-subtotal">
                  <td style={{ paddingLeft: '8px' }}>{row.label}</td>
                  {row.monthValues.map((v, mi) => {
                    const refV = pRef?.[mi] || 0;
                    return (
                      <td key={mi} className={cls}>
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
                  {row.monthValues.map((v, mi) => (
                    <td key={mi} className={signCls(v)}>
                      {fmtSigned(v)}
                      {row.showPct && showPct && row.refValues?.[mi] > 0 && (
                        <span className="cv-pct">{fmtPct(pct(v, row.refValues[mi]))}</span>
                      )}
                    </td>
                  ))}
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
                  {row.monthValues.map((v, mi) => (
                    <td key={mi} className={signCls(v)}>{fmtSigned(v)}</td>
                  ))}
                  <td className={signCls(row.total)}>{fmtSigned(row.total)}</td>
                </tr>
              );
            }

            if (row.type === 'saldo-acum') {
              return (
                <tr key={i} className="dr-saldo-acum">
                  <td>{row.label}</td>
                  {row.monthValues.map((v, mi) => (
                    <td key={mi} className={signCls(v)}>{fmtSigned(v)}</td>
                  ))}
                  <td className={signCls(row.total)}>{fmtSigned(row.total)}</td>
                </tr>
              );
            }

            if (row.type === 'll') {
              return (
                <tr key={i} className="dr-ll">
                  <td>{row.label}</td>
                  {row.monthValues.map((v, mi) => (
                    <td key={mi} className={signCls(v)}>
                      {fmtSigned(v)}
                      {row.showPct && showPct && row.refValues?.[mi] > 0 && (
                        <span className="cv-pct">{fmtPct(pct(v, row.refValues[mi]))}</span>
                      )}
                    </td>
                  ))}
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
