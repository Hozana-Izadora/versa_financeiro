import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RcTooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import { buildDrillTree, DRILL_TREE, sumNode } from '../../utils/drillHierarchy';
import { fmt, fmtK, MONTHS } from '../../utils/formatters';
import InfoPopover from './InfoPopover';
import ChartFilterPicker from './ChartFilterPicker';
import ValuesBtn from './ValuesBtn';
import MinimizeBtn from './MinimizeBtn';
import ChartModal from './ChartModal';

// Quantos Tipos aparecem por padrão em "Composição por Tipo" antes de precisar clicar
// em "mostrar todos" — em teste, temporariamente 10 (era 6).
const TOP_TIPOS_LIMIT = 10;

// Cor fixa por posição do Grupo na lista (não por ordem de seleção) — assim um Grupo
// mantém sempre a mesma cor entre cliques, em vez de trocar toda vez que a seleção
// muda. A primeira é o mesmo azul usado antes para o único Grupo selecionado, então
// o caso mais comum (1 selecionado) fica visualmente idêntico a antes.
const COMPARE_COLORS = [
  { line: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  { line: '#059669', bg: 'rgba(5,150,105,0.12)' },
  { line: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { line: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { line: '#e11d48', bg: 'rgba(225,29,72,0.12)' },
  { line: '#0891b2', bg: 'rgba(8,145,178,0.12)' },
  { line: '#ca8a04', bg: 'rgba(202,138,4,0.12)' },
  { line: '#db2777', bg: 'rgba(219,39,119,0.12)' },
];

function ChartTip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  // Presente só quando o ponto vem da composição por Tipo comparando vários Grupos —
  // sem isso, duas linhas com o mesmo nome de Tipo em Grupos diferentes ficariam
  // indistinguíveis no tooltip.
  const grupoLabel = payload[0]?.payload?.grupoLabel;
  return (
    <div style={{ background: '#1C1C1C', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: '#fff', fontWeight: 600, marginBottom: grupoLabel ? 0 : 4 }}>{label}</div>
      {grupoLabel && <div style={{ color: '#8aa3be', fontSize: 9.5, marginBottom: 4 }}>{grupoLabel}</div>}
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

  function grupoColor(id) {
    const idx = grupos.findIndex(g => g.node.id === id);
    return COMPARE_COLORS[(idx >= 0 ? idx : 0) % COMPARE_COLORS.length];
  }

  // Grupos selecionados (multi-seleção) — nasce com o de maior valor no período. Se
  // algum selecionado deixar de existir (ex. mudou o filtro de período), remove só
  // esse; se nenhum sobrar, volta a cair no de maior valor.
  const [selectedGrpIds, setSelectedGrpIds] = useState(() => new Set());
  useEffect(() => {
    if (!grupos.length) { setSelectedGrpIds(new Set()); return; }
    setSelectedGrpIds(prev => {
      const stillValid = [...prev].filter(id => grupos.some(g => g.node.id === id));
      if (stillValid.length) return new Set(stillValid);
      return new Set([[...grupos].sort((a, b) => b.valor - a.valor)[0].node.id]);
    });
  }, [grupos]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleGrp(id) {
    setSelectedGrpIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Mesma ordem alfabética de `grupos`, filtrada pelos marcados — mantém a ordem
  // estável independente da ordem em que o usuário clicou.
  const selectedGrupos = grupos.filter(g => selectedGrpIds.has(g.node.id));
  const isComparing = selectedGrupos.length > 1;
  const single = selectedGrupos.length === 1 ? selectedGrupos[0] : null;

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

  // Painel 2, um só Grupo selecionado — evolução mensal (R$ + % do faturamento)
  const monthlyData = useMemo(() => {
    if (!single) return [];
    return visMonths.map(m => {
      const valor = sumNode(single.node, transactions, [m], year);
      const receita = monthlyRevenue.get(m) ?? 0;
      return { month: MONTHS[m], Valor: valor, '%': receita > 0 ? +(valor / receita * 100).toFixed(1) : 0 };
    });
  }, [single, transactions, visMonths, year, monthlyRevenue]);

  // Painel 2, comparando vários Grupos — mesmo formato do painel de 1 Grupo (barra de
  // Valor + linha de %), só que uma barra e uma linha por Grupo selecionado, cada uma
  // na cor do seu Grupo.
  const monthlyDataCompare = useMemo(() => {
    if (!isComparing) return [];
    return visMonths.map(m => {
      const row = { month: MONTHS[m] };
      const receita = monthlyRevenue.get(m) ?? 0;
      selectedGrupos.forEach(g => {
        const valor = sumNode(g.node, transactions, [m], year);
        row[g.node.id] = valor;
        row[`${g.node.id}__pct`] = receita > 0 ? +(valor / receita * 100).toFixed(1) : 0;
      });
      return row;
    });
  }, [isComparing, selectedGrupos, transactions, visMonths, year, monthlyRevenue]);

  // Painel 3, um só Grupo — composição por Tipo (R$ + % do faturamento do período)
  const tipoData = useMemo(() => {
    if (!single) return [];
    const tipos = [...new Set(
      plano
        .filter(p => p.cat === single.node.filter.cat && p.grp === single.node.filter.grp)
        .map(p => p.tipo)
    )];
    return tipos
      .map(tipo => {
        const valor = sumNode({ filter: { ...single.node.filter, tipo } }, transactions, visMonths, year);
        return { tipo, Valor: valor, '%': totalRevenue > 0 ? +(valor / totalRevenue * 100).toFixed(1) : 0 };
      })
      .filter(t => t.Valor > 0)
      .sort((a, b) => b.Valor - a.Valor);
  }, [single, plano, transactions, visMonths, year, totalRevenue]);

  // Painel 3, comparando vários Grupos — uma lista combinada de Tipos (cada um já
  // pertence a um único Grupo), ordenada por valor; cada barra é colorida pela cor do
  // seu Grupo de origem, com uma legenda de cores acima do gráfico.
  const tipoDataCompare = useMemo(() => {
    if (!isComparing) return [];
    const rows = [];
    selectedGrupos.forEach(g => {
      const tipos = [...new Set(
        plano.filter(p => p.cat === g.node.filter.cat && p.grp === g.node.filter.grp).map(p => p.tipo)
      )];
      tipos.forEach(tipo => {
        const valor = sumNode({ filter: { ...g.node.filter, tipo } }, transactions, visMonths, year);
        if (valor > 0) {
          rows.push({
            tipo, grupoId: g.node.id, grupoLabel: g.label, Valor: valor,
            '%': totalRevenue > 0 ? +(valor / totalRevenue * 100).toFixed(1) : 0,
          });
        }
      });
    });
    return rows.sort((a, b) => b.Valor - a.Valor);
  }, [isComparing, selectedGrupos, plano, transactions, visMonths, year, totalRevenue]);

  const activeTipoData = isComparing ? tipoDataCompare : tipoData;

  const [showValues, setShowValues] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);
  // Composição por Tipo: com rótulo horizontal (mais legível que na vertical), muitos
  // Tipos disputando pouco espaço viram ilegíveis — por padrão mostra só os
  // TOP_TIPOS_LIMIT principais (já vem ordenado por valor decrescente), com opção de
  // ver todos.
  const [showAllTipos, setShowAllTipos] = useState(false);
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
  // Rótulo de % fica solto no fundo do gráfico (não dentro de uma barra sólida como o
  // de Valor), então pode cair em cima da própria linha, de linhas de grade ou de outra
  // série — um contorno claro (halo) por trás do texto colorido garante leitura em
  // qualquer fundo, mesmo quando o número e a linha são exatamente da mesma cor.
  const pctLabelStyle = (color, fontSize = 12) => ({
    fontSize, fill: color, fontWeight: 700,
    paintOrder: 'stroke',
    stroke: darkMode ? '#0d1117' : '#ffffff',
    strokeWidth: 3,
    strokeLinejoin: 'round',
  });

  // Extraído para ser reaproveitado tanto no card normal quanto no modal "ampliar" —
  // só muda a altura dos gráficos e o teto de altura da lista de grupos.
  function renderBody(chartH, listMaxHClass, wide) {
    if (grupos.length === 0) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          Sem dados no período
        </div>
      );
    }
    // Duas classes literais (não um valor arbitrário montado por template string) — o
    // Tailwind gera o CSS varrendo o código-fonte em busca de strings de classe
    // completas, então uma classe montada dinamicamente com a largura em variável nunca
    // seria reconhecida no build.
    const gridColsClass = wide ? 'sm:grid-cols-[300px_1fr]' : 'sm:grid-cols-[240px_1fr]';
    const chartTipoData = showAllTipos ? activeTipoData : activeTipoData.slice(0, TOP_TIPOS_LIMIT);
    const selectionKey = [...selectedGrpIds].sort().join(',');
    return (
      <div className={`grid grid-cols-1 ${gridColsClass}`}>
        {/* ── Lista de Grupos (multi-seleção) ── */}
        <div
          style={{
            padding: '10px 8px',
            borderRight: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid #f1f5f9',
            overflowY: 'auto',
          }}
          className={listMaxHClass}
        >
          {grupos.map(g => {
            const isChecked = selectedGrpIds.has(g.node.id);
            const color = grupoColor(g.node.id);
            return (
              <button
                key={g.node.id}
                onClick={() => toggleGrp(g.node.id)}
                title="Clique para marcar/desmarcar — selecione mais de um para comparar"
                style={{
                  width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 2,
                  borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: isChecked ? 700 : 500,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: isChecked ? color.bg : 'transparent',
                  color: isChecked ? color.line : (darkMode ? '#cbd5e1' : '#475569'),
                  transition: 'background .12s, color .12s',
                }}
                onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)'; }}
                onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${isChecked ? color.line : (darkMode ? '#475569' : '#cbd5e1')}`,
                  background: isChecked ? color.line : 'transparent',
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Gráficos dos Grupos selecionados ── */}
        <div style={{ padding: '14px 16px', minWidth: 0 }}>
          {selectedGrupos.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Selecione ao menos um Grupo à esquerda.
            </div>
          ) : (
            <>
              <div className="text-[11.5px] font-semibold mb-1" style={{ color: darkMode ? '#e2eaf4' : '#334155' }}>
                {isComparing ? 'Comparação entre Grupos — evolução mensal' : `${single.label} — evolução mensal`}
              </div>
              <div style={{ height: chartH }}>
                <ResponsiveContainer key={`${selectionKey}-${showValues}-single`} width="100%" height="100%">
                  {isComparing ? (
                    <ComposedChart data={monthlyDataCompare} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="month" {...axisProps} />
                      <YAxis yAxisId="valor" {...axisProps} width={44} tickFormatter={v => fmtK(v)} />
                      <YAxis yAxisId="pct" orientation="right" tickFormatter={v => v + '%'} {...axisProps} width={40} />
                      <RcTooltip content={<ChartTip formatter={(v, name) => name.endsWith('%') ? v + '%' : fmt(v)} />} />
                      <Legend {...legendStyle} />
                      {/* Mesmo formato de antes (barra de Valor + linha de %), repetido uma vez
                          por Grupo selecionado — cada par barra+linha na cor daquele Grupo, em
                          vez de recolorir tudo num único gráfico genérico de comparação. */}
                      {selectedGrupos.map(g => {
                        const color = grupoColor(g.node.id);
                        return (
                          <Bar key={g.node.id} yAxisId="valor" dataKey={g.node.id} name={g.label} fill={color.line} radius={[4, 4, 0, 0]}>
                            {showValues && <LabelList dataKey={g.node.id} position="insideBottom" formatter={v => v ? fmtK(v) : ''} style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }} />}
                          </Bar>
                        );
                      })}
                      {selectedGrupos.map(g => {
                        const color = grupoColor(g.node.id);
                        return (
                          <Line
                            key={`${g.node.id}-pct`}
                            yAxisId="pct"
                            dataKey={`${g.node.id}__pct`}
                            name={`${g.label} %`}
                            type="monotone"
                            stroke={color.line}
                            strokeWidth={2.5}
                            strokeDasharray="4 3"
                            dot={{ r: 3.5, fill: color.line }}
                            activeDot={{ r: 5 }}
                          >
                            {showValues && <LabelList dataKey={`${g.node.id}__pct`} position="top" formatter={pctLbl} style={pctLabelStyle(color.line, 10)} />}
                          </Line>
                        );
                      })}
                    </ComposedChart>
                  ) : (
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
                        {showValues && <LabelList dataKey="%" position="top" formatter={pctLbl} style={pctLabelStyle('#f97316')} />}
                      </Line>
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between mb-1 mt-3">
                <div className="text-[11.5px] font-semibold" style={{ color: darkMode ? '#e2eaf4' : '#334155' }}>
                  Composição por Tipo — período filtrado
                </div>
                {activeTipoData.length > TOP_TIPOS_LIMIT && (
                  <span
                    className="text-[9.5px] text-text-3 cursor-pointer hover:text-accent"
                    onClick={() => setShowAllTipos(v => !v)}
                  >
                    {showAllTipos ? `mostrar só os ${TOP_TIPOS_LIMIT} principais` : `mostrar todos (${activeTipoData.length})`}
                  </span>
                )}
              </div>
              {isComparing && activeTipoData.length > 0 && (
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-1.5">
                  {selectedGrupos.map(g => (
                    <span key={g.node.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: tc }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: grupoColor(g.node.id).line, display: 'inline-block' }} />
                      {g.label}
                    </span>
                  ))}
                </div>
              )}
              {activeTipoData.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 12, padding: '20px 0' }}>Sem lançamentos nos Grupos selecionados no período.</div>
              ) : (
                <div style={{ height: chartH + 40 }}>
                  <ResponsiveContainer key={`${selectionKey}-${showValues}-${showAllTipos}`} width="100%" height="100%">
                    <BarChart data={chartTipoData} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid {...gridProps} />
                      {/* Legenda horizontal — só os TOP_TIPOS_LIMIT principais Tipos por padrão dão espaço de
                          sobra pra ler sem rotacionar o texto; "mostrar todos" existe pra quem
                          precisa do detalhe completo, mesmo que fique mais apertado com muitos
                          Tipos. Nomes longos são truncados (o nome completo continua no tooltip). */}
                      <XAxis
                        dataKey="tipo"
                        tick={{ fill: tc, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        tickMargin={8}
                        tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v}
                      />
                      <YAxis {...axisProps} width={0} tick={false} axisLine={false} />
                      <RcTooltip content={<ChartTip formatter={(v, name) => name === '%' ? v + '%' : fmt(v)} />} />
                      <Bar dataKey="Valor" radius={[4, 4, 0, 0]}>
                        {chartTipoData.map((entry, i) => (
                          <Cell key={i} fill={isComparing ? grupoColor(entry.grupoId).line : 'rgba(16,185,129,.75)'} />
                        ))}
                        {showValues && <LabelList dataKey="Valor" position="top" formatter={v => fmtK(v)} style={{ fontSize: 12, fill: tc }} />}
                        {showValues && <LabelList dataKey="%" position="insideTop" formatter={pctLbl} style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }} />}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
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
              description={'Selecione um ou mais Grupos na lista. Com um só selecionado, veja sua evolução mensal (R$ e % do faturamento) e sua composição por Tipo no período filtrado. Selecionando vários, compare a evolução mensal entre eles e veja a composição por Tipo combinada, colorida por Grupo de origem.\n\nOs percentuais são sempre sobre o faturamento (soma de todas as Entradas) do respectivo período — não sobre o total do próprio gráfico.'}
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

      {!collapsed && renderBody(220, 'max-h-[260px] sm:max-h-[420px]', false)}

      {/* Modal próprio, não o de Caixa.jsx — renderBody() roda de novo a cada render
          daqui, então trocar de grupo/Valores dentro do modal continua reativo. */}
      <ChartModal
        chart={fullscreen ? { title: 'Composição das Saídas', element: renderBody(320, '', true), wide: true } : null}
        onClose={() => setFullscreen(false)}
      />
    </div>
  );
}
