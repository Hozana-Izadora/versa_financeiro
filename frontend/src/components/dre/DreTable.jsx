import React, { useState } from 'react';
import { fmt, fmtPct, pct, MONTHS } from '../../utils/formatters.js';
import Icon from '../ui/Icon.jsx';

function CellValue({ v, refV, isPos, showPct }) {
  const cls = v === 0 ? 'cv-neu' : isPos ? 'cv-pos' : 'cv-neg';
  const p = refV > 0 ? pct(v, refV) : 0;
  return (
    <td className={cls}>
      {v === 0 ? '—' : fmt(v)}
      {showPct && <span className="cv-pct">{p.toFixed(0)}%</span>}
    </td>
  );
}

function TotalCell({ v, isPos, showPct, refV }) {
  const cls = v === 0 ? 'cv-neu' : isPos ? 'cv-pos' : 'cv-neg';
  const p = refV > 0 ? pct(v, refV) : 0;
  return (
    <td className={cls}>
      {v === 0 ? '—' : fmt(v)}
      {showPct && refV > 0 && <span className="cv-pct">{p.toFixed(0)}%</span>}
    </td>
  );
}

export default function DreTable({ dre, onDrillItem, onDrillGroup, showPct }) {
  const [expanded, setExpanded] = useState(new Set());

  function toggle(gid) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });
  }

  const { rows, visMonths } = dre;

  return (
    <div className="overflow-x-auto max-w-full">
      <table className="dre-tbl">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Descrição</th>
            {visMonths.map(m => <th key={m}>{MONTHS[m]}</th>)}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
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
              const isExp = expanded.has(row.gid);
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
                    <CellValue key={mi} v={v} refV={row.refValues?.[mi] || 0} isPos={row.isPos} />
                  ))}
                  <TotalCell v={row.total} isPos={row.isPos} />
                </tr>
              );
            }

            if (row.type === 'subgroup') {
              if (!expanded.has(row.parentGid)) return null;
              return (
                <tr
                  key={i} className="dr-item"
                  onClick={() => onDrillGroup?.(row.label, row.movFilter)}
                  style={{ display: '' }}
                >
                  <td style={{ paddingLeft: '32px' }}>└ {row.label}</td>
                  {row.monthValues.map((v, mi) => (
                    <CellValue key={mi} v={v} refV={row.refValues?.[mi] || 0} isPos={row.isPos} />
                  ))}
                  <TotalCell v={row.total} isPos={row.isPos} />
                </tr>
              );
            }

            if (row.type === 'item') {
              if (!expanded.has(row.parentGid)) return null;
              return (
                <tr
                  key={i} className="dr-item"
                  onClick={() => onDrillItem?.(row.label, row.movFilter)}
                >
                  <td style={{ paddingLeft: '52px', color: '#94a3b8' }}>· {row.label}</td>
                  {row.monthValues.map((v, mi) => (
                    <CellValue key={mi} v={v} refV={row.refValues?.[mi] || 0} isPos={row.isPos} />
                  ))}
                  <TotalCell v={row.total} isPos={row.isPos} />
                </tr>
              );
            }

            if (row.type === 'subtotal') {
              return (
                <tr key={i} className="dr-subtotal">
                  <td style={{ paddingLeft: '8px' }}>{row.label}</td>
                  {row.monthValues.map((v, mi) => (
                    <td key={mi} className="cv-neg">({fmt(v)})</td>
                  ))}
                  <td className="cv-neg">({fmt(row.total)})</td>
                </tr>
              );
            }

            if (row.type === 'total') {
              return (
                <tr key={i} className="dr-total">
                  <td>{row.label}</td>
                  {row.monthValues.map((v, mi) => (
                    <td key={mi} className={v >= 0 ? 'cv-pos' : 'cv-neg'}>
                      {fmt(v)}
                      {row.showPct && showPct && row.refValues?.[mi] > 0 && (
                        <span className="cv-pct">{fmtPct(pct(v, row.refValues[mi]))}</span>
                      )}
                    </td>
                  ))}
                  <td className={row.total >= 0 ? 'cv-pos' : 'cv-neg'}>
                    {fmt(row.total)}
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
                    <td key={mi} className={v >= 0 ? 'cv-pos' : 'cv-neg'}>{fmt(v)}</td>
                  ))}
                  <td className={row.total >= 0 ? 'cv-pos' : 'cv-neg'}>{fmt(row.total)}</td>
                </tr>
              );
            }

            if (row.type === 'saldo-acum') {
              return (
                <tr key={i} className="dr-saldo-acum">
                  <td>{row.label}</td>
                  {row.monthValues.map((v, mi) => (
                    <td key={mi} className={v >= 0 ? 'cv-pos' : 'cv-neg'}>{fmt(v)}</td>
                  ))}
                  <td className={row.total >= 0 ? 'cv-pos' : 'cv-neg'}>{fmt(row.total)}</td>
                </tr>
              );
            }

            if (row.type === 'll') {
              return (
                <tr key={i} className="dr-ll">
                  <td>{row.label}</td>
                  {row.monthValues.map((v, mi) => (
                    <td key={mi} className={v >= 0 ? 'cv-pos' : 'cv-neg'}>
                      {fmt(v)}
                      {row.showPct && showPct && row.refValues?.[mi] > 0 && (
                        <span className="cv-pct">{fmtPct(pct(v, row.refValues[mi]))}</span>
                      )}
                    </td>
                  ))}
                  <td className={row.total >= 0 ? 'cv-pos' : 'cv-neg'}>
                    {fmt(row.total)}
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
  );
}
