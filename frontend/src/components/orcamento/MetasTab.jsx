import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../api/index.js';
import InfoPopover from '../ui/InfoPopover.jsx';
import Icon from '../ui/Icon.jsx';
import { buildDrillTree, sumNode } from '../../utils/drillHierarchy.js';

const MES12 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ALL_MES = [0,1,2,3,4,5,6,7,8,9,10,11];

const DELTA_DEFS = [
  { key: 'pessimista',      label: 'Pessimista',      sign: -1, color: '#E53E3E', default: '15' },
  { key: 'otimista',        label: 'Otimista',        sign:  1, color: '#059669', default: '20' },
  { key: 'muito_otimista',  label: 'Muito Otimista',  sign:  1, color: '#2B6CB0', default: '40' },
];

function fmtBrl(v) {
  if (!v) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function fmtK(v) {
  const n = Number(v) || 0;
  return n > 0 ? 'R$' + (n / 1000).toFixed(0) + 'K' : '—';
}

// Colored icon badge used in each panel header — gives every section its own
// visual identity at a glance (payments/receita, receipt/gastos, tree/categoria, dice/cenários).
function SectionIcon({ name, color, bg }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: 28, height: 28, background: bg }}
    >
      <Icon name={name} size="text-[15px]" style={{ color }} />
    </span>
  );
}

function SectionTotal({ label, value }) {
  return value > 0 ? (
    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
      <span className="text-[11px] text-text-3">{label}</span>
      <span className="text-[13px] font-bold text-text-base">
        {'R$ ' + value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
      </span>
    </div>
  ) : null;
}

// Controlled grid of 12 monthly inputs
function MonthGrid({ values, onChange }) {
  return (
    <div className="grid grid-cols-4 md:grid-cols-6 xl:grid-cols-12 gap-1.5">
      {MES12.map((mes, m) => (
        <div key={m}>
          <div className="text-[9px] uppercase tracking-widest text-text-3 mb-1">{mes}</div>
          <input
            type="number"
            min="0"
            className="w-full text-[11px] border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="0"
            value={values[m] === '' || values[m] == null ? '' : values[m]}
            onChange={e => onChange(m, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

// Uma linha da árvore de metas por categoria — recursiva, então funciona em qualquer
// profundidade do Plano de Contas: Categoria → Grupo → Tipo (tipo só existe como filho
// quando o grupo tem mais de um tipo cadastrado). Cada nível tem seu próprio campo de meta.
function MetaCategoriaNode({ node, depth, metaCat, onMetaChange, collapsedCats, onToggleCollapse, tx, year }) {
  const hasChildren = node.children?.length > 0;
  const isCollapsed = collapsedCats.has(node.id);
  const realizado   = tx ? sumNode(node, tx, ALL_MES, year) : 0;
  const isTop       = depth === 0;

  return (
    <div className={isTop ? 'rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden transition-shadow hover:shadow-sm' : ''}>
      <div
        className={`flex items-center justify-between gap-2 py-2 transition-colors ${
          isTop ? 'px-3 bg-bg-2 hover:bg-slate-100 dark:hover:bg-slate-700/40' : 'pr-3 hover:bg-slate-50 dark:hover:bg-slate-800/40'
        }`}
        style={{ cursor: hasChildren ? 'pointer' : 'default', paddingLeft: isTop ? undefined : 12 + depth * 18 }}
        onClick={() => hasChildren && onToggleCollapse(node.id)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {hasChildren && (
            <Icon
              name={isCollapsed ? 'chevron_right' : 'expand_more'}
              size="text-[13px]"
              style={{ color: '#94a3b8', flexShrink: 0 }}
            />
          )}
          <span className={`truncate ${isTop ? 'text-[12px] font-semibold text-text-base' : 'text-[11.5px] text-text-2'}`}>
            {node.label}
          </span>
          <span className="text-[10px] text-text-3 whitespace-nowrap">· realizado {fmtBrl(realizado)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-[10px] text-text-3">R$</span>
          <input
            type="number" min="0"
            className={`font-bold border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent ${isTop ? 'text-[12px]' : 'text-[11.5px]'}`}
            style={{ width: isTop ? 120 : 108 }}
            placeholder="0"
            value={metaCat[node.id] ?? ''}
            onChange={e => onMetaChange(node.id, e.target.value)}
          />
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <div className={isTop ? 'divide-y divide-slate-100 dark:divide-slate-700' : 'space-y-0.5 pb-1'}>
          {node.children.map(child => (
            <MetaCategoriaNode
              key={child.id}
              node={child}
              depth={depth + 1}
              metaCat={metaCat}
              onMetaChange={onMetaChange}
              collapsedCats={collapsedCats}
              onToggleCollapse={onToggleCollapse}
              tx={tx}
              year={year}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MetasTab({ orcamento, receitaReal, year, actions, plano, tx }) {
  const empty12 = () => Array(12).fill('');

  // ── Local state (controlled) ──────────────────────────────────
  const [receita,   setReceita]   = useState(empty12);
  const [despOp,    setDespOp]    = useState(empty12);
  const [despNop,   setDespNop]   = useState(empty12);
  const [custoPct,  setCustoPct]  = useState('');
  const [deltas,    setDeltas]    = useState(() =>
    Object.fromEntries(DELTA_DEFS.map(d => [d.key, d.default]))
  );
  const [distMode,  setDistMode]  = useState('manual');
  const [annualRec, setAnnualRec] = useState('');
  const [metaCat,   setMetaCat]   = useState({});
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [saving,    setSaving]    = useState(false);

  // ── Populate from orcamento ───────────────────────────────────
  useEffect(() => {
    const r   = empty12();
    const op  = empty12();
    const nop = empty12();
    let cPct  = '';
    const d   = Object.fromEntries(DELTA_DEFS.map(x => [x.key, x.default]));
    const mc  = {};

    for (const e of orcamento) {
      if (e.tipo === 'receita'       && e.mes >= 0 && e.mes <= 11)  r[e.mes]   = e.valor ?? '';
      if (e.tipo === 'meta_despesa'  && e.referencia === 'op'  && e.mes >= 0)  op[e.mes]  = e.valor ?? '';
      if (e.tipo === 'meta_despesa'  && e.referencia === 'nop' && e.mes >= 0)  nop[e.mes] = e.valor ?? '';
      if (e.tipo === 'meta_custo_pct')  cPct = e.valor != null ? String(e.valor) : '';
      if (e.tipo === 'cenario_delta')   d[e.referencia] = e.valor != null ? String(e.valor) : d[e.referencia];
      if (e.tipo === 'meta_cat')        mc[e.referencia] = e.valor != null ? String(e.valor) : '';
    }

    setReceita(r);
    setDespOp(op);
    setDespNop(nop);
    setCustoPct(cPct);
    setDeltas(d);
    setMetaCat(mc);
  }, [orcamento]);

  // ── Árvore do Plano de Contas (mesma usada no gráfico "Gastos por Categoria") ──
  const gastoTree = useMemo(() => plano?.length ? buildDrillTree(plano) : { children: [] }, [plano]);

  function toggleCatCollapse(id) {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function setMetaCatValue(nodeId, value) {
    setMetaCat(m => ({ ...m, [nodeId]: value }));
  }

  const totalMetaCat = useMemo(
    () => Object.values(metaCat).reduce((s, v) => s + (Number(v) || 0), 0),
    [metaCat]
  );

  // ── Sazonal weights from historical actuals ───────────────────
  const sazonalWeights = useMemo(() => {
    const total = (receitaReal || []).reduce((s, v) => s + (v ?? 0), 0);
    if (total === 0) return Array(12).fill(1 / 12);
    return (receitaReal || []).map(v => (v ?? 0) / total);
  }, [receitaReal]);

  const hasSazonalData = useMemo(
    () => (receitaReal || []).some(v => v != null && v > 0),
    [receitaReal]
  );

  // ── Distribute annual target to months ───────────────────────
  const applyDistribution = useCallback(() => {
    const annual = parseFloat(annualRec);
    if (!annual || annual <= 0) return;
    let newMonths;
    if (distMode === 'linear') {
      const monthly = Math.round(annual / 12);
      newMonths = Array(12).fill(monthly);
    } else {
      newMonths = sazonalWeights.map(w => Math.round(annual * w));
    }
    setReceita(newMonths);
  }, [annualRec, distMode, sazonalWeights]);

  // ── Computed totals ───────────────────────────────────────────
  const totalRec     = receita.reduce((s, v) => s + (Number(v) || 0), 0);
  const totalDespOp  = despOp.reduce((s, v) => s + (Number(v) || 0), 0);
  const totalDespNop = despNop.reduce((s, v) => s + (Number(v) || 0), 0);

  // ── Resumo geral (usado no cabeçalho da aba) ──────────────────
  const totalCustoEstimado   = totalRec * (Number(custoPct) || 0) / 100;
  const totalDespesasAnual   = totalDespOp + totalDespNop + totalCustoEstimado;
  const resultadoProjetado   = totalRec - totalDespesasAnual;

  const totalCategoriaNodes = useMemo(() => {
    let count = 0;
    (function walk(nodes) {
      nodes.forEach(n => { count++; if (n.children?.length) walk(n.children); });
    })(gastoTree.children ?? []);
    return count;
  }, [gastoTree]);

  const categoriasComMeta = useMemo(
    () => Object.values(metaCat).filter(v => Number(v) > 0).length,
    [metaCat]
  );

  // ── Scenario preview ─────────────────────────────────────────
  const cenarioPreview = useMemo(() => {
    const rows = [
      { key: 'moderado', label: 'Moderado', color: 'rgba(200,208,218,.9)',
        values: receita.map(v => Number(v) || 0),
        total: totalRec },
    ];
    for (const def of DELTA_DEFS) {
      const pct  = parseFloat(deltas[def.key]) || 0;
      const mult = 1 + def.sign * pct / 100;
      const vals = receita.map(v => Math.round((Number(v) || 0) * mult));
      rows.push({ key: def.key, label: def.label, color: def.color,
        values: vals, total: vals.reduce((s, x) => s + x, 0) });
    }
    return rows;
  }, [receita, deltas, totalRec]);

  // ── Save helpers ─────────────────────────────────────────────
  async function saveSection(entries) {
    if (!entries.length) { actions.notify('Nenhum valor para salvar.', 'ni'); return; }
    setSaving(true);
    try {
      await api.upsertOrcamento(entries.map(e => ({ ano: year, ...e })));
      const fresh = await api.getOrcamento(year);
      actions.dispatch({ type: 'SET_ORCAMENTO', payload: fresh });
      actions.notify('Metas salvas!', 'ns');
    } catch (err) {
      actions.notify(err.message, 'ne');
    } finally {
      setSaving(false);
    }
  }

  function saveReceita() {
    const entries = receita
      .map((v, m) => ({ mes: m, tipo: 'receita', referencia: '', valor: Number(v) || 0 }))
      .filter(e => e.valor > 0);
    saveSection(entries);
  }

  function saveGastos() {
    const entries = [];
    despOp.forEach((v, m)  => { if (Number(v) > 0) entries.push({ mes: m, tipo: 'meta_despesa', referencia: 'op',  valor: Number(v) }); });
    despNop.forEach((v, m) => { if (Number(v) > 0) entries.push({ mes: m, tipo: 'meta_despesa', referencia: 'nop', valor: Number(v) }); });
    if (Number(custoPct) > 0) entries.push({ mes: null, tipo: 'meta_custo_pct', referencia: '', valor: Number(custoPct) });
    saveSection(entries);
  }

  function saveMetaCategorias() {
    const entries = Object.entries(metaCat)
      .filter(([, v]) => Number(v) > 0)
      .map(([nodeId, v]) => ({ mes: null, tipo: 'meta_cat', referencia: nodeId, valor: Number(v) }));
    saveSection(entries);
  }

  function saveCenarios() {
    const entries = DELTA_DEFS
      .filter(def => parseFloat(deltas[def.key]) > 0)
      .map(def => ({ mes: null, tipo: 'cenario_delta', referencia: def.key, valor: parseFloat(deltas[def.key]) }));
    saveSection(entries);
  }

  const btnCls = 'btn text-[11px] px-3.5 py-1.5 cursor-pointer';

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-3.5">

      {/* ════ Resumo geral ════════════════════════════════════════ */}
      <div className="kpi-cascade mb-3.5">
        <div className="kpi-card flex-1 min-w-0 kpi-tone-green">
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5 flex items-center gap-1">
            <Icon name="payments" size="text-[11px]" style={{ color: '#10b981' }} /> Receita Anual
          </div>
          <div className="font-inter font-bold text-[18px] tracking-tight" style={{ color: '#10b981' }}>{fmtBrl(totalRec)}</div>
          <div className="text-[10.5px] text-text-3">Meta {year}</div>
        </div>
        <div className="kpi-card flex-1 min-w-0 kpi-tone-amber">
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5 flex items-center gap-1">
            <Icon name="receipt_long" size="text-[11px]" style={{ color: '#f59e0b' }} /> Despesas Anual
          </div>
          <div className="font-inter font-bold text-[18px] tracking-tight" style={{ color: '#f59e0b' }}>{fmtBrl(totalDespesasAnual)}</div>
          <div className="text-[10.5px] text-text-3">Custo + Operacional + Não Operacional</div>
        </div>
        <div className={`kpi-card flex-1 min-w-0 ${resultadoProjetado >= 0 ? 'kpi-tone-blue' : 'kpi-tone-red'}`}>
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5 flex items-center gap-1">
            <Icon name="trending_up" size="text-[11px]" style={{ color: resultadoProjetado >= 0 ? '#2563eb' : '#ef4444' }} /> Resultado Projetado
          </div>
          <div className="font-inter font-bold text-[18px] tracking-tight" style={{ color: resultadoProjetado >= 0 ? '#2563eb' : '#ef4444' }}>{fmtBrl(resultadoProjetado)}</div>
          <div className="text-[10.5px] text-text-3">Receita − Despesas</div>
        </div>
        <div className="kpi-card flex-1 min-w-0 kpi-tone-purple">
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5 flex items-center gap-1">
            <Icon name="account_tree" size="text-[11px]" style={{ color: '#8b5cf6' }} /> Categorias com Meta
          </div>
          <div className="font-inter font-bold text-[18px] tracking-tight" style={{ color: '#8b5cf6' }}>{categoriasComMeta} <span className="text-[13px] text-text-3 font-semibold">/ {totalCategoriaNodes}</span></div>
          <div className="text-[10.5px] text-text-3">Definidas no Plano de Contas</div>
        </div>
      </div>

      {/* ════ Meta de Receita ════════════════════════════════════ */}
      <div className="panel" style={{ borderTop: '3px solid #10b981' }}>
        <div className="panel-hdr">
          <div className="flex items-center gap-2.5">
            <SectionIcon name="payments" color="#10b981" bg="rgba(16,185,129,0.14)" />
            <div>
            <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
              Meta de Receita — {year}
              <InfoPopover
                title="Meta de Receita"
                description={'Define a receita esperada mês a mês para o ano selecionado.\n\n• Manual: edite cada mês individualmente.\n• Linear: informe a meta anual e ela é dividida igualmente entre os 12 meses.\n• Sazonal: distribui a meta anual proporcionalmente ao padrão histórico de receita do ano corrente.\n\nOs valores salvos aqui alimentam os KPIs e o gráfico de Acompanhamento.'}
              />
            </div>
            <div className="text-[10px] text-text-3 mt-0.5">Receita esperada mês a mês</div>
            </div>
          </div>
          <button onClick={saveReceita} disabled={saving} className={btnCls}>
            {saving ? 'Salvando…' : 'Salvar Receita'}
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Distribution mode */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-text-2">Distribuição:</span>
            {[
              { id: 'manual',   label: 'Manual',            icon: 'tune' },
              { id: 'linear',   label: 'Linear (÷12)',      icon: 'trending_up' },
              { id: 'sazonal',  label: 'Sazonal (histórico)', icon: 'insert_chart' },
            ].map(({ id, label, icon }) => (
              <button key={id} onClick={() => setDistMode(id)}
                className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  distMode === id
                    ? 'bg-accent text-white border-accent shadow-[0_2px_10px_rgba(16,185,129,0.35)]'
                    : 'bg-bg-1 text-text-2 border-slate-200 dark:border-slate-600 hover:border-accent hover:text-accent'
                }`}>
                <Icon name={icon} size="text-[13px]" />
                {label}
              </button>
            ))}
          </div>

          {/* Annual input for linear/sazonal */}
          {distMode !== 'manual' && (
            <div className="flex items-center gap-3 flex-wrap p-3 rounded bg-bg-2 border border-slate-100 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-text-2">Meta Anual:</span>
              <input
                type="number"
                min="0"
                className="text-[11px] border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ width: 160 }}
                placeholder="R$ 0"
                value={annualRec}
                onChange={e => setAnnualRec(e.target.value)}
              />
              <button onClick={applyDistribution} className={btnCls}>
                Distribuir
              </button>
              {distMode === 'sazonal' && !hasSazonalData && (
                <span className="text-[10px] text-fin-red">Sem histórico de receita para calcular sazonalidade</span>
              )}
              {distMode === 'sazonal' && hasSazonalData && (
                <span className="text-[10px] text-text-3">Pesos calculados com base no realizado de {year}</span>
              )}
            </div>
          )}

          <MonthGrid values={receita} onChange={(m, v) => setReceita(r => { const n = [...r]; n[m] = v; return n; })} />
          <SectionTotal label="Total anual:" value={totalRec} />
        </div>
      </div>

      {/* ════ Metas de Gastos ════════════════════════════════════ */}
      <div className="panel" style={{ borderTop: '3px solid #f59e0b' }}>
        <div className="panel-hdr">
          <div className="flex items-center gap-2.5">
            <SectionIcon name="receipt_long" color="#f59e0b" bg="rgba(245,158,11,0.14)" />
            <div>
              <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                Metas de Gastos — {year}
                <InfoPopover
                  title="Metas de Gastos"
                  description={'Define os limites de custo e despesa para o ano.\n\n• Custo Direto %: percentual máximo da Receita Bruta que pode ser consumido por custos diretos (CPV/CMV). Ex: 30% significa que os custos não devem ultrapassar 30% do faturamento.\n\n• Despesas Operacionais: teto mensal em R$ para pessoal, aluguel, administrativo, comercial e similares.\n\n• Despesas Não Operacionais: teto mensal em R$ para financeiros, impostos, tributos e investimentos.\n\nOs valores são comparados ao realizado no card de KPI e na tabela de Acompanhamento.'}
                />
              </div>
              <div className="text-[10px] text-text-3 mt-0.5">Limites mensais por categoria de gasto</div>
            </div>
          </div>
          <button onClick={saveGastos} disabled={saving} className={btnCls}>
            {saving ? 'Salvando…' : 'Salvar Gastos'}
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Custo Direto % */}
          <div className="flex items-center gap-3 flex-wrap p-3 rounded bg-bg-2 border border-slate-100 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-text-2 shrink-0 flex items-center gap-1">
              Custo Direto — % da Receita Bruta
              <InfoPopover
                title="Custo Direto (%)"
                description={'Percentual máximo que os custos diretos (matéria-prima, serviços prestados, CPV) podem representar sobre a receita bruta.\n\nExemplo: com meta de 30% e receita de R$ 100.000, o custo direto não deve ultrapassar R$ 30.000.\n\nEsse indicador é comparado com o realizado no KPI de Acompanhamento.'}
              />
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min="0" max="100" step="0.5"
                className="text-[12px] font-bold border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ width: 72 }}
                placeholder="0"
                value={custoPct}
                onChange={e => setCustoPct(e.target.value)}
              />
              <span className="text-[12px] font-semibold text-text-2">%</span>
            </div>
            {custoPct && totalRec > 0 && (
              <span className="text-[10px] text-text-3">
                ≈ {fmtBrl(totalRec * Number(custoPct) / 100 / 12)} / mês em média
              </span>
            )}
          </div>

          {/* Despesas Operacionais */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-text-2 flex items-center gap-1">
                Despesas Operacionais (R$ / mês)
                <InfoPopover
                  title="Meta — Despesas Operacionais"
                  description={'Teto mensal em R$ para o total de despesas operacionais: pessoal, aluguel, energia, administrativo, comercial, tecnologia e similares.\n\nDefina um valor por mês para refletir sazonalidade (ex: 13º salário em dezembro). Meses iguais indicam custo fixo planejado.\n\nComparado com o realizado no KPI "Desp. Operacionais" e na tabela de Acompanhamento.'}
                />
              </span>
              {totalDespOp > 0 && <span className="text-[10px] text-text-3">Total anual: {fmtBrl(totalDespOp)}</span>}
            </div>
            <MonthGrid
              values={despOp}
              onChange={(m, v) => setDespOp(r => { const n = [...r]; n[m] = v; return n; })}
            />
          </div>

          {/* Despesas Não Operacionais */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-text-2 flex items-center gap-1">
                Despesas Não Operacionais (R$ / mês)
                <InfoPopover
                  title="Meta — Despesas Não Operacionais"
                  description={'Teto mensal em R$ para despesas fora da operação principal: juros, tarifas bancárias, impostos sobre lucro (IRPJ/CSLL), tributos e investimentos.\n\nEsse grupo impacta o Resultado Líquido mas não a Margem Operacional (EBIT).\n\nComparado com o realizado no KPI "Gastos Não Operacionais".'}
                />
              </span>
              {totalDespNop > 0 && <span className="text-[10px] text-text-3">Total anual: {fmtBrl(totalDespNop)}</span>}
            </div>
            <MonthGrid
              values={despNop}
              onChange={(m, v) => setDespNop(r => { const n = [...r]; n[m] = v; return n; })}
            />
          </div>
        </div>
      </div>

      {/* ════ Metas por Categoria ════════════════════════════════ */}
      <div className="panel" style={{ borderTop: '3px solid #8b5cf6' }}>
        <div className="panel-hdr">
          <div className="flex items-center gap-2.5">
            <SectionIcon name="account_tree" color="#8b5cf6" bg="rgba(139,92,246,0.14)" />
            <div>
              <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                Metas por Categoria — {year}
                <InfoPopover
                  title="Metas por Categoria"
                  description={'Define uma meta anual para qualquer nível do Plano de Contas — Categoria, Grupo ou Tipo — além dos tetos gerais de Despesas Operacionais/Não Operacionais definidos acima.\n\nClique numa linha com seta para expandir e ver os grupos/tipos dentro dela; cada nível tem seu próprio campo de meta, independente dos demais.\n\nQuando um nível tem meta própria, ela é usada no gráfico "Gastos por Categoria" e nas metas mais específicas do Acompanhamento — em vez de só ratear o teto geral.\n\nO valor "realizado" ao lado de cada linha é a soma do ano corrente, só para referência ao definir a meta.'}
                />
              </div>
              <div className="text-[10px] text-text-3 mt-0.5">Meta anual (R$) por categoria, grupo ou tipo do plano de contas</div>
            </div>
          </div>
          <button onClick={saveMetaCategorias} disabled={saving} className={btnCls}>
            {saving ? 'Salvando…' : 'Salvar Metas por Categoria'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!gastoTree.children?.length && (
            <div className="text-[11px] text-text-3">Nenhuma categoria de gasto encontrada no Plano de Contas.</div>
          )}

          {gastoTree.children?.map(macro => (
            <div key={macro.id}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-3 mb-2 flex items-center gap-1.5">
                <Icon name="folder_open" size="text-[12px]" style={{ color: '#94a3b8' }} />
                {macro.label}
              </div>
              <div className="space-y-1.5">
                {macro.children?.map(cat => (
                  <MetaCategoriaNode
                    key={cat.id}
                    node={cat}
                    depth={0}
                    metaCat={metaCat}
                    onMetaChange={setMetaCatValue}
                    collapsedCats={collapsedCats}
                    onToggleCollapse={toggleCatCollapse}
                    tx={tx}
                    year={year}
                  />
                ))}
              </div>
            </div>
          ))}

          <SectionTotal label="Total das metas por categoria:" value={totalMetaCat} />
        </div>
      </div>

      {/* ════ Cenários ═══════════════════════════════════════════ */}
      <div className="panel" style={{ borderTop: '3px solid #2B6CB0' }}>
        <div className="panel-hdr">
          <div className="flex items-center gap-2.5">
            <SectionIcon name="casino" color="#2B6CB0" bg="rgba(43,108,176,0.14)" />
            <div>
              <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                Configuração de Cenários
                <InfoPopover
                  title="Cenários de Receita"
                  description={'Permite projetar diferentes expectativas de faturamento aplicando variações percentuais sobre a meta definida.\n\n• Moderado: a própria meta (100%) — cenário base.\n• Pessimista: meta reduzida pelo % configurado. Use para simular queda de vendas ou perda de clientes.\n• Otimista: meta acrescida pelo % configurado. Simula crescimento acima do esperado.\n• Muito Otimista: crescimento ainda maior — útil para cenários de expansão ou sazonalidade positiva.\n\nOs cenários aparecem no gráfico "Receita Bruta" da aba Acompanhamento. A prévia abaixo mostra os valores calculados para cada mês.'}
                />
              </div>
              <div className="text-[10px] text-text-3 mt-0.5">Variações percentuais sobre a meta de receita</div>
            </div>
          </div>
          <button onClick={saveCenarios} disabled={saving} className={btnCls}>
            {saving ? 'Salvando…' : 'Salvar Cenários'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Delta cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Moderado — fixed base */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-bg-2" style={{ borderLeft: '3px solid #94a3b8' }}>
              <div className="text-[9.5px] uppercase tracking-widest text-text-3 mb-1.5">Moderado</div>
              <div className="text-[15px] font-black text-text-base">= 100%</div>
              <div className="text-[9.5px] text-text-3 mt-1">Meta definida (base)</div>
            </div>

            {DELTA_DEFS.map(({ key, label, sign, color }) => (
              <div key={key} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-bg-2" style={{ borderLeft: `3px solid ${color}` }}>
                <div className="text-[9.5px] uppercase tracking-widest text-text-3 mb-1.5">{label}</div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold" style={{ color }}>
                    Meta {sign > 0 ? '+' : '−'}
                  </span>
                  <input
                    type="number" min="0" max="200" step="0.5"
                    className="text-[13px] font-bold border border-slate-200 dark:border-slate-600 rounded px-1.5 py-1 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
                    style={{ width: 54 }}
                    value={deltas[key]}
                    onChange={e => setDeltas(d => ({ ...d, [key]: e.target.value }))}
                  />
                  <span className="text-[11px] font-semibold" style={{ color }}>%</span>
                </div>
                <div className="text-[9.5px] text-text-3 mt-1">
                  Meta × (1 {sign > 0 ? '+' : '−'} {deltas[key] || '0'}%)
                </div>
              </div>
            ))}
          </div>

          {/* Preview table — only when receita exists */}
          {totalRec > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-text-2 mb-2">
                Prévia — Receita por Cenário
              </div>
              <div className="overflow-x-auto">
                <table style={{ fontSize: 10.5, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1.5 text-[9px] uppercase tracking-widest text-text-3 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap"
                        style={{ minWidth: 110 }}>Cenário</th>
                      {MES12.map(m => (
                        <th key={m} className="px-2 py-1.5 text-[9px] uppercase tracking-widest text-text-3 border-b border-slate-100 dark:border-slate-700 text-right whitespace-nowrap">{m}</th>
                      ))}
                      <th className="px-2 py-1.5 text-[9px] uppercase tracking-widest text-text-3 border-b border-slate-100 dark:border-slate-700 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cenarioPreview.map(({ key, label, color, values, total }) => (
                      <tr key={key} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="px-2 py-1.5 font-semibold whitespace-nowrap" style={{ color }}>
                          {label}
                        </td>
                        {values.map((v, m) => (
                          <td key={m} className="px-2 py-1.5 text-right font-mono whitespace-nowrap" style={{ color: v > 0 ? color : undefined }}>
                            {fmtK(v)}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right font-bold font-mono whitespace-nowrap" style={{ color }}>
                          {fmtK(total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
