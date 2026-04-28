import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useDrillDown } from '../../hooks/useDrillDown';
import { sumNode } from '../../utils/drillHierarchy';
import { fmt, fmtK } from '../../utils/formatters';
import Icon from './Icon';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = [
  '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4',
  '#f97316', '#ec4899', '#10b981', '#6366f1',
  '#14b8a6', '#a78bfa',
];

export default function DrillChart({ transactions, visMonths, year, darkMode }) {
  const { currentChildren, breadcrumb, handleDrillDown, handleDrillUp, depth } = useDrillDown();

  // Calcula valor de cada filho no nível atual
  const items = useMemo(() =>
    currentChildren
      .map((node, i) => ({
        node,
        value: sumNode(node, transactions, visMonths, year),
        color: COLORS[i % COLORS.length],
        hasChildren: !!node.children?.length,
      }))
      .filter(item => item.value > 0),
    [currentChildren, transactions, visMonths, year]
  );

  const total = items.reduce((s, i) => s + i.value, 0);

  // Chave única por nível: força re-animação do gráfico ao navegar
  const chartKey = breadcrumb.map(b => b.label).join('>');

  const donutData = {
    labels: items.map(i => i.node.label),
    datasets: [{
      data: items.map(i => i.value),
      backgroundColor: items.map(i => i.color),
      borderWidth: 2,
      borderColor: darkMode ? '#152030' : '#ffffff',
      hoverOffset: 8,
    }],
  };

  const donutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    animation: { duration: 380 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1C1C1C', titleColor: '#fff', bodyColor: '#aaa',
        padding: 9, cornerRadius: 5,
        callbacks: {
          label: ctx => {
            const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : '0.0';
            return ` ${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
          },
        },
      },
    },
    onClick: (_, elements) => {
      if (elements.length) handleDrillDown(items[elements[0].index].node);
    },
  };

  const atMaxDepth = depth > 0 && currentChildren.every(c => !c.children?.length);
  const prevCrumb  = breadcrumb[breadcrumb.length - 2]; // item anterior no breadcrumb

  return (
    <div className="panel mb-3.5">
      {/* ── Cabeçalho com breadcrumb ── */}
      <div className="panel-hdr" style={{ alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-inter font-semibold text-[13px]">Composição das Saídas</div>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
            {breadcrumb.map((crumb, i) => {
              const isCurrent = i === breadcrumb.length - 1;
              return (
                <React.Fragment key={crumb.index}>
                  <button
                    onClick={() => !isCurrent && handleDrillUp(crumb.index)}
                    style={{
                      background: isCurrent ? 'rgba(37,99,235,0.09)' : 'transparent',
                      border: 'none', cursor: isCurrent ? 'default' : 'pointer',
                      padding: '2px 7px', borderRadius: 5,
                      fontSize: 11, fontWeight: isCurrent ? 700 : 500,
                      fontFamily: 'inherit',
                      color: isCurrent ? '#2563eb' : '#64748b',
                      transition: 'color .12s',
                    }}
                    onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.color = '#1e40af'; }}
                    onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.color = '#64748b'; }}
                  >
                    {crumb.label}
                  </button>
                  {!isCurrent && (
                    <span style={{ color: '#cbd5e1', fontSize: 10, lineHeight: 1 }}>›</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!atMaxDepth && items.length > 0 && (
            <span style={{ fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              clique para detalhar ⤵
            </span>
          )}
          {depth > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleDrillUp(prevCrumb.index)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
            >
              <Icon name="arrow_back" size="text-[13px]" />
              {prevCrumb.label}
            </button>
          )}
        </div>
      </div>

      {/* ── Corpo: donut à esquerda, lista à direita ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr' }}>

        {/* Donut */}
        <div style={{ padding: '12px 8px 12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {items.length > 0 ? (
            <div style={{ height: 200, width: '100%', cursor: atMaxDepth ? 'default' : 'pointer' }}>
              <Doughnut key={chartKey} data={donutData} options={donutOpts} />
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
              Sem dados<br />no período
            </div>
          )}
        </div>

        {/* Lista de breakdown */}
        <div style={{ padding: '12px 16px 12px 8px', overflowY: 'auto', maxHeight: 240 }}>
          {items.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: 12, paddingTop: 16 }}>
              Nenhum lançamento encontrado para este nível.
            </div>
          )}

          {items.map(item => {
            const pct = total > 0 ? (item.value / total * 100) : 0;
            return (
              <div
                key={item.node.id}
                onClick={() => item.hasChildren && handleDrillDown(item.node)}
                style={{
                  marginBottom: 9,
                  padding: '5px 7px',
                  borderRadius: 7,
                  cursor: item.hasChildren ? 'pointer' : 'default',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => {
                  if (item.hasChildren)
                    e.currentTarget.style.background = darkMode
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.035)';
                }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Linha: label + valor + % */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: darkMode ? '#e2eaf4' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.node.label}
                    </span>
                    {item.hasChildren && (
                      <Icon name="chevron_right" size="text-[12px]" style={{ color: '#94a3b8', flexShrink: 0 }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
                      {fmtK(item.value)}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 34, textAlign: 'right' }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div style={{ height: 3, background: darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: item.color,
                    width: `${Math.min(100, pct)}%`,
                    transition: 'width .4s ease',
                  }} />
                </div>
              </div>
            );
          })}

          {/* Total no rodapé */}
          {items.length > 0 && (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Total</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444' }}>{fmtK(total)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
