import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RcTooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import { buildDrillTree, DRILL_TREE, sumNode } from '../../utils/drillHierarchy';
import { fmt, fmtK, MONTHS } from '../../utils/formatters';
import InfoPopover from './InfoPopover';
import ChartFilterPicker from './ChartFilterPicker';
import ValuesBtn from './ValuesBtn';
import MinimizeBtn from './MinimizeBtn';
import ChartModal from './ChartModal';

function ChartTip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1C1C1C', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#aaa', marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, display: 'inline-block', flexShrink: 0 }} />
          <span>{p.name}:</span>
          <span style={{ color: '#fff' }}>{formatter ? formatter(p.value, p.name) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DrillChart({ transactions, visMonths, year, darkMode, plano, filterOverride, onFilterOverride, globalFilterState, tx }) {
  const tree = useMemo(
    () => plano?.length ? buildDrillTree(plano) : DRILL_TREE,
    [plano]
  );

  // Achata a árvore direto no nível de Grupo — um Grupo pertence a um único nível
  // financeiro (nivel → cat → grp → tipo), então não há ambiguidade em pular a etapa
  // de Categoria. Fica restrito aos níveis de Saída que já formavam essa árvore
  // (Custo, Despesa Operacional, Despesa Não Operacional) — Dedução de Receita não
  // entra aqui, continua fora de "Composição das Saídas".
  const grupos = useMemo(() => {
    const list = [];
    (tree.children ?? []).forEach(macro => {
      (macro.children ?? []).forEach(cat => {
        (cat.children ?? []).forEach(grp => {
          const valor = sumNode(grp, transactions, visMonths, year);
          if (valor > 0) list.push({ node: grp, label: grp.label, valor });
        });
      });
    });
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [tree, transactions, visMonths, year]);

  // Grupo selecionado — nasce com o de maior valor no período; se o grupo selecionado
  // deixar de existir (ex. mudou o filtro de período) cai de volta no de maior valor.
  const [selectedGrpId, setSelectedGrpId] = useState(null);
  useEffect(() => {
    if (!grupos.length) { setSelectedGrpId(null); return; }
    if (selectedGrpId && grupos.some(g => g.node.id === selectedGrpId)) return;
    setSelectedGrpId([...grupos].sort((a, b) => b.valor - a.valor)[0].node.id);
  }, [grupos]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = grupos.find(g => g.node.id === selectedGrpId) ?? null;

  // Receita bruta (faturamento) por mês — todas as Entradas, mesma base usada nos %
  // dos dois gráficos à direita.
  const monthlyRevenue = useMemo(() => {
    const map = new Map();
    for (const r of transactions) {
      if (r.mov !== 'Entrada') continue;
      const d = new Date(r.data + 'T12:00');
      if (d.getFullYear() !== year) continue;
      const m = d.getMonth();
      map.set(m, (map.get(m) ?? 0) + r.valor);
    }
    return map;
  }, [transactions, year]);

  const totalRevenue = useMemo(
    () => visMonths.reduce((s, m) => s + (monthlyRevenue.get(m) ?? 0), 0),
    [visMonths, monthlyRevenue]
  );

  // Painel 2 — evolução mensal do grupo selecionado (R$ + % do faturamento)
  const monthlyData = useMemo(() => {
    if (!selected) return [];
    return visMonths.map(m => {
      const valor = sumNode(selected.node, transactions, [m], year);
      const receita = monthlyRevenue.get(m) ?? 0;
      return { month: MONTHS[m], Valor: valor, '%': receita > 0 ? +(valor / receita * 100).toFixed(1) : 0 };
    });
  }, [selected, transactions, visMonths, year, monthlyRevenue]);

  // Painel 3 — composição do grupo selecionado por Tipo (R$ + % do faturamento do período)
  const tipoData = useMemo(() => {
    if (!selected) return [];
    const tipos = [...new Set(
      plano
        .filter(p => p.cat === selected.node.filter.cat && p.grp === selected.node.filter.grp)
        .map(p => p.tipo)
    )];
    return tipos
      .map(tipo => {
        const valor = sumNode({ filter: { ...selected.node.filter, tipo } }, transactions, visMonths, year);
        return { tipo, Valor: valor, '%': totalRevenue > 0 ? +(valor / totalRevenue * 100).toFixed(1) : 0 };
      })
      .filter(t => t.Valor > 0)
      .sort((a, b) => b.Valor - a.Valor);
  }, [selected, plano, transactions, visMonths, year, totalRevenue]);

  const [showValues, setShowValues] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);
  // Estado próprio (não delegado ao modal genérico de Caixa.jsx) — o conteúdo ampliado
  // precisa recalcular a cada render para que trocar de grupo dentro do modal funcione;
  // um elemento pré-computado e guardado num state externo fica congelado no clique.
  const [fullscreen, setFullscreen] = useState(false);

  const tc = darkMode ? '#8aa3be' : '#94a3b8';
  const gc = darkMode ? '#1e2d42' : 'rgba(0,0,0,0.06)';
  const axisProps  = { tick: { fill: tc, fontSize: 11 }, axisLine: false, tickLine: false };
  const gridProps  = { strokeDasharray: '3 3', stroke: gc, vertical: false };
  const legendStyle = { wrapperStyle: { fontSize: 11, color: tc } };
  const pctLbl = v => v !== 0 ? v + '%' : '';

  // Extraído para ser reaproveitado tanto no card normal quanto no modal "ampliar" —
  // só muda a altura dos gráficos e o teto de altura da lista de grupos.
  function renderBody(chartH, listMaxHClass) {
    if (grupos.length === 0) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          Sem dados no período
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
        {/* ── Lista de Grupos ── */}
        <div
          style={{
            padding: '10px 8px',
            borderRight: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid #f1f5f9',
            overflowY: 'auto',
          }}
          className={listMaxHClass}
        >
          {grupos.map(g => {
            const isActive = g.node.id === selectedGrpId;
            return (
              <button
                key={g.node.id}
                onClick={() => setSelectedGrpId(g.node.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 2,
                  borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  background: isActive ? (darkMode ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.10)') : 'transparent',
                  color: isActive ? (darkMode ? '#93c5fd' : '#2563eb') : (darkMode ? '#cbd5e1' : '#475569'),
                  transition: 'background .12s, color .12s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        {/* ── Gráficos do grupo selecionado ── */}
        <div style={{ padding: '14px 16px', minWidth: 0 }}>
          <div className="text-[11.5px] font-semibold mb-1" style={{ color: darkMode ? '#e2eaf4' : '#334155' }}>
            {selected?.label} — evolução mensal
          </div>
          <div style={{ height: chartH }}>
            <ResponsiveContainer key={`${selectedGrpId}-${showValues}`} width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis yAxisId="valor" {...axisProps} width={0} tick={false} axisLine={false} />
                <YAxis yAxisId="pct" orientation="right" tickFormatter={v => v + '%'} {...axisProps} width={40} />
                <RcTooltip content={<ChartTip formatter={(v, name) => name === '%' ? v + '%' : fmt(v)} />} />
                <Legend {...legendStyle} />
                <Bar yAxisId="valor" dataKey="Valor" fill="rgba(43,108,176,.75)" radius={[4, 4, 0, 0]}>
                  {/* Dentro da barra, perto da base — nunca disputa espaço com o rótulo de % da linha, que fica acima do ponto */}
                  {showValues && <LabelList dataKey="Valor" position="insideBottom" formatter={v => v ? fmtK(v) : ''} style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }} />}
                </Bar>
                <Line yAxisId="pct" dataKey="%" type="monotone" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4, fill: '#f97316' }} activeDot={{ r: 5 }}>
                  {showValues && <LabelList dataKey="%" position="top" formatter={pctLbl} style={{ fontSize: 12, fill: '#f97316' }} />}
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[11.5px] font-semibold mb-1 mt-3" style={{ color: darkMode ? '#e2eaf4' : '#334155' }}>
            Composição por Tipo — período filtrado
          </div>
          {tipoData.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 12, padding: '20px 0' }}>Sem lançamentos neste grupo no período.</div>
          ) : (
            <div style={{ height: chartH + 110 }}>
              <ResponsiveContainer key={`${selectedGrpId}-${showValues}`} width="100%" height="100%">
                <BarChart data={tipoData} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  {/* Vertical (-90°) em vez de diagonal — com muitos Tipos, rótulos diagonais
                      "sangram" para fora da área do gráfico e cortam; na vertical cada rótulo
                      usa só a largura da própria barra. Nomes muito longos são truncados (o
                      nome completo continua no tooltip) para não estourar a altura do gráfico. */}
                  <XAxis
                    dataKey="tipo"
                    tick={{ fill: tc, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-90}
                    textAnchor="end"
                    height={130}
                    tickMargin={6}
                    tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '…' : v}
                  />
                  <YAxis {...axisProps} width={0} tick={false} axisLine={false} />
                  <RcTooltip content={<ChartTip formatter={(v, name) => name === '%' ? v + '%' : fmt(v)} />} />
                  <Bar dataKey="Valor" fill="rgba(16,185,129,.75)" radius={[4, 4, 0, 0]}>
                    {showValues && <LabelList dataKey="Valor" position="top" formatter={v => fmtK(v)} style={{ fontSize: 12, fill: tc }} />}
                    {showValues && <LabelList dataKey="%" position="insideTop" formatter={pctLbl} style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }} />}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="panel mb-3.5">
      {/* ── Cabeçalho ── */}
      <div className="panel-hdr" style={{ alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
            Composição das Saídas
            <InfoPopover
              title="Composição das Saídas"
              description={'Selecione um Grupo na lista para ver sua evolução mensal (R$ e % do faturamento) e sua composição por Tipo no período filtrado.\n\nOs percentuais são sempre sobre o faturamento (soma de todas as Entradas) do respectivo período — não sobre o total do próprio gráfico.'}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {tx && onFilterOverride && globalFilterState && (
            <ChartFilterPicker
              tx={tx}
              override={filterOverride ?? null}
              setOverride={onFilterOverride}
              globalFilterState={globalFilterState}
            />
          )}
          <ValuesBtn show={showValues} onToggle={() => setShowValues(v => !v)} />
          <span
            className="text-[9.5px] text-text-3 cursor-pointer"
            onClick={() => setFullscreen(true)}
          >
            ⤢ ampliar
          </span>
          <MinimizeBtn collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        </div>
      </div>

      {!collapsed && renderBody(220, 'max-h-[260px] sm:max-h-[420px]')}

      {/* Modal próprio, não o de Caixa.jsx — renderBody() roda de novo a cada render
          daqui, então trocar de grupo/Valores dentro do modal continua reativo. */}
      <ChartModal
        chart={fullscreen ? { title: 'Composição das Saídas', element: renderBody(320, ''), wide: true } : null}
        onClose={() => setFullscreen(false)}
      />
    </div>
  );
}
