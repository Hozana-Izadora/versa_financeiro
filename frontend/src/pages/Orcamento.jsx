import React, { useState, useMemo, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend,
} from 'chart.js';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/index.js';
import { DRILL_TREE, sumNode } from '../utils/drillHierarchy.js';
import ChartModal from '../components/ui/ChartModal.jsx';
import Icon from '../components/ui/Icon.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const MES12    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ALL_MES  = [0,1,2,3,4,5,6,7,8,9,10,11];
const GR = 'rgba(109,191,69,.75)';
const GY = 'rgba(200,208,218,.8)';
const RD = '#E53E3E';
const BL = '#2B6CB0';
const OR = '#F5A623';

const SCENARIO_DEFS = [
  { key: 'pessimista',      label: 'Pessimista',      color: 'rgba(229,62,62,.55)',  desc: 'Projeção conservadora' },
  { key: 'moderado',        label: 'Moderado',        color: 'rgba(200,208,218,.6)', desc: 'Baseada no histórico recente' },
  { key: 'otimista',        label: 'Otimista',        color: 'rgba(109,191,69,.55)', desc: 'Com aceleração de vendas' },
  { key: 'muito_otimista',  label: 'Muito Otimista',  color: 'rgba(43,108,176,.55)', desc: 'Com forte expansão de receita' },
];

// Gasto nodes mapeados do DRILL_TREE (L0 e L1 de saídas)
const GASTO_NODES = DRILL_TREE.children; // [gastos-op, gastos-nop]
const GASTO_L1 = {
  'gastos-op':  DRILL_TREE.children[0].children,
  'gastos-nop': DRILL_TREE.children[1].children,
};

function fmtBrl(v) {
  if (v == null) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtK(v) { return v == null ? '' : 'R$' + (v / 1000).toFixed(0) + 'K'; }
function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; }

// Soma transações de um node para o ano inteiro (todos os 12 meses)
function sumNodeYear(node, tx, year) {
  return sumNode(node, tx, ALL_MES, year);
}

// Soma transações de um node para um mês específico
function sumNodeMes(node, tx, year, mes) {
  return sumNode(node, tx, [mes], year);
}

// Receita real por mês (competência, nivel='Receita', mov='Entrada')
function receitaRealPorMes(tx, year) {
  return ALL_MES.map(m => {
    const total = tx.filter(r => {
      const d = new Date(r.data + 'T12:00');
      return d.getFullYear() === year && d.getMonth() === m
        && r.mov === 'Entrada' && r.nivel === 'Receita';
    }).reduce((s, r) => s + r.valor, 0);
    return total > 0 ? total : null;
  });
}

export default function Orcamento() {
  const { state, actions } = useApp();
  const { transactions, orcamento, filterState, darkMode } = state;
  const year = filterState.year;
  const tx = transactions.competencia;

  const [scenario, setScenario]     = useState(1);
  const [gastoStack, setGastoStack] = useState(['root']);
  const [modalChart, setModalChart] = useState(null);
  const [saving, setSaving]         = useState(false);

  const gc = darkMode ? '#1e2d42' : '#F0F2F5';
  const tc = darkMode ? '#8aa3be' : '#8A96A3';

  // ── Parse orcamento entries into lookup maps ──────────────────
  const orcMap = useMemo(() => {
    const receita   = {};   // mes → valor
    const cenarios  = {};   // key → { mes → valor }
    const metaCat   = {};   // nodeId → valor (annual)
    let breakeven   = 0;

    for (const e of orcamento) {
      if (e.tipo === 'receita')   receita[e.mes]    = e.valor;
      if (e.tipo === 'breakeven') breakeven          = e.valor;
      if (e.tipo === 'cenario') {
        if (!cenarios[e.referencia]) cenarios[e.referencia] = {};
        cenarios[e.referencia][e.mes] = e.valor;
      }
      if (e.tipo === 'meta_cat')  metaCat[e.referencia] = e.valor;
    }
    return { receita, cenarios, metaCat, breakeven };
  }, [orcamento]);

  // ── Actuals from transactions ─────────────────────────────────
  const receitaReal = useMemo(() => receitaRealPorMes(tx, year), [tx, year]);

  // Mês atual (último mês com dados reais)
  const lastRealMes = useMemo(() => {
    for (let m = 11; m >= 0; m--) if (receitaReal[m] != null) return m;
    return -1;
  }, [receitaReal]);

  // ── Chart data ────────────────────────────────────────────────
  const sc = SCENARIO_DEFS[scenario];
  const orcAnualData = useMemo(() => {
    const orcado  = ALL_MES.map(m => (orcMap.receita[m] ?? 0) / 1000 || null);
    const cenario = ALL_MES.map(m => {
      const v = orcMap.cenarios[sc.key]?.[m];
      return v != null ? v / 1000 : null;
    });
    const beVal   = orcMap.breakeven > 0 ? orcMap.breakeven / 1000 : null;
    return {
      labels: MES12,
      datasets: [
        { label: 'Realizado',               data: receitaReal.map(v => v != null ? v/1000 : null), backgroundColor: GR, borderRadius: 4 },
        { label: 'Orçado',                  data: orcado, backgroundColor: GY, borderRadius: 4 },
        { label: sc.label + ' (projeção)',  data: cenario, backgroundColor: sc.color, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,.1)' },
        ...(beVal ? [{ label: 'Ponto de Equilíbrio', data: Array(12).fill(beVal), type: 'line', borderColor: OR, borderWidth: 2, borderDash: [7,4], pointRadius: 0, tension: 0, fill: false }] : []),
      ],
    };
  }, [receitaReal, orcMap, sc, year]);

  // ── Gastos drill-down ─────────────────────────────────────────
  const gastoItems = useMemo(() => {
    const nodeKey = gastoStack[gastoStack.length - 1];
    let nodes;
    if (nodeKey === 'root')       nodes = GASTO_NODES;
    else if (GASTO_L1[nodeKey])   nodes = GASTO_L1[nodeKey];
    else {
      // L1 leaf — find node in GASTO_L1
      for (const children of Object.values(GASTO_L1)) {
        const n = children.find(c => c.id === nodeKey);
        if (n) { nodes = n.children ?? []; break; }
      }
      nodes = nodes ?? [];
    }
    return nodes.map(node => ({
      node,
      real: sumNodeYear(node, tx, year) / 1000,
      meta: (orcMap.metaCat[node.id] ?? 0) / 1000,
      hasChildren: !!(node.children?.length),
    }));
  }, [gastoStack, tx, year, orcMap]);

  const gastoLabel = useMemo(() => {
    const key = gastoStack[gastoStack.length - 1];
    if (key === 'root') return 'Todos os Grupos';
    for (const n of GASTO_NODES) {
      if (n.id === key) return n.label;
      for (const c of (n.children ?? [])) {
        if (c.id === key) return c.label;
      }
    }
    return '';
  }, [gastoStack]);

  const gastoData = useMemo(() => ({
    labels: gastoItems.map(i => i.node.label),
    datasets: [
      { label: 'Meta',      data: gastoItems.map(i => i.meta), backgroundColor: GY, borderRadius: 4 },
      { label: 'Realizado', data: gastoItems.map(i => i.real),
        backgroundColor: gastoItems.map(i => i.real > i.meta && i.meta > 0 ? 'rgba(229,62,62,.8)' : 'rgba(109,191,69,.8)'),
        borderRadius: 4 },
    ],
  }), [gastoItems]);

  const gastoOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: tc, font: { size: 10 }, boxWidth: 9 } },
      tooltip: { backgroundColor: '#1C1C1C', titleColor: '#fff', bodyColor: '#aaa', padding: 9, cornerRadius: 5 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tc, font: { size: 10 } } },
      y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: v => 'R$' + v + 'K' } },
    },
    onClick: (_, elements) => {
      if (!elements.length) return;
      const item = gastoItems[elements[0].index];
      if (item.hasChildren) setGastoStack(s => [...s, item.node.id]);
    },
  }), [gastoItems, gc, tc]);

  const chartBaseOpts = useCallback((cb) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: tc, font: { size: 10 }, boxWidth: 9, borderRadius: 2 } },
      tooltip: { backgroundColor: '#1C1C1C', titleColor: '#fff', bodyColor: '#aaa', padding: 9, cornerRadius: 5 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tc, font: { size: 10 } } },
      y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: cb || (v => v) } },
    },
  }), [gc, tc]);

  const orcAnualOpts = useMemo(() => ({
    ...chartBaseOpts(v => 'R$' + v + 'K'),
  }), [chartBaseOpts]);

  // ── KPI cards (último mês real vs meta mensal) ────────────────
  const kpiCards = useMemo(() => {
    if (lastRealMes < 0) return [];
    const m = lastRealMes;

    const recReal  = receitaReal[m] ?? 0;
    const recMeta  = orcMap.receita[m] ?? 0;

    // Saídas operacionais reais no mês
    const despOpNode = DRILL_TREE.children[0]; // gastos-op
    const despOpReal = sumNodeMes(despOpNode, tx, year, m);
    const despOpMeta = (orcMap.metaCat['gastos-op'] ?? 0) / 12;

    // Margem operacional
    const mgOpReal = recReal > 0 ? ((recReal - despOpReal) / recReal * 100) : 0;
    const mgOpMeta = recMeta > 0 ? ((recMeta - despOpMeta) / recMeta * 100) : 0;

    // Saídas não operacionais
    const nopNode  = DRILL_TREE.children[1];
    const nopReal  = sumNodeMes(nopNode, tx, year, m);
    const nopMeta  = (orcMap.metaCat['gastos-nop'] ?? 0) / 12;

    // Resultado líquido
    const resReal  = recReal - despOpReal - nopReal;
    const resMeta  = recMeta - despOpMeta - nopMeta;

    function card(label, meta, real, higherIsBetter, isPercent = false) {
      const diff    = real - meta;
      const pct     = meta !== 0 ? (diff / Math.abs(meta) * 100) : 0;
      const good    = higherIsBetter ? diff >= 0 : diff <= 0;
      const fmtV    = isPercent ? (v => v.toFixed(1) + '%') : fmtBrl;
      const delta   = isPercent
        ? (diff >= 0 ? '+' : '') + diff.toFixed(1) + 'pp vs meta'
        : fmtPct(pct) + ' vs meta';
      return { label, meta: fmtV(meta), real: fmtV(real), good, delta };
    }

    return [
      card('Receita Bruta',          recMeta,   recReal,   true),
      card('Desp. Operacionais',     despOpMeta, despOpReal, false),
      card('Margem Operacional',     mgOpMeta,  mgOpReal,  true, true),
      card('Gastos Não Operacionais', nopMeta,  nopReal,   false),
      card('Resultado Líquido',      resMeta,   resReal,   true),
    ];
  }, [lastRealMes, receitaReal, tx, year, orcMap]);

  // ── Acompanhamento orçamentário (tabela) ──────────────────────
  const orcTable = useMemo(() => {
    if (lastRealMes < 0) return [];
    const m = lastRealMes;

    const recRealMes  = receitaReal[m] ?? 0;
    const recOrcMes   = orcMap.receita[m] ?? 0;
    const recOrcAno   = ALL_MES.reduce((s, i) => s + (orcMap.receita[i] ?? 0), 0);

    // Projeção ano = realizado até mês m + orçado restante
    const recProjAno  = ALL_MES.reduce((s, i) => {
      if (receitaReal[i] != null) return s + receitaReal[i];
      return s + (orcMap.receita[i] ?? 0);
    }, 0);

    const despOpNode = DRILL_TREE.children[0];
    const despOpRealMes = sumNodeMes(despOpNode, tx, year, m);
    const despOpMeta    = (orcMap.metaCat['gastos-op'] ?? 0) / 12;
    const despOpMetaAno = orcMap.metaCat['gastos-op'] ?? 0;

    // Custos reais no mês
    const custoNode  = despOpNode.children?.[0]; // custos-diretos
    const custoReal  = custoNode ? sumNodeMes(custoNode, tx, year, m) : 0;
    const custoMeta  = custoNode ? (orcMap.metaCat[custoNode.id] ?? 0) / 12 : 0;

    const mgBReal = recRealMes - custoReal;
    const mgBMeta = recOrcMes - custoMeta;

    const resReal = recRealMes - despOpRealMes;
    const resMeta = recOrcMes - despOpMeta;

    return [
      { sec: true, label: 'RECEITAS' },
      { label: 'Receita Bruta', orcMes: recOrcMes, realMes: recRealMes, orcAno: recOrcAno, projAno: recProjAno, above: true },
      { sec: true, label: 'CUSTOS E DESPESAS' },
      { label: 'Custos Diretos', orcMes: custoMeta, realMes: custoReal, orcAno: custoMeta * 12, projAno: custoReal * 12, above: false },
      { res: true, label: '= Margem Bruta', orcMes: mgBMeta, realMes: mgBReal, orcAno: mgBMeta * 12, projAno: mgBReal * 12, above: true },
      { label: 'Desp. Operacionais', orcMes: despOpMeta, realMes: despOpRealMes, orcAno: despOpMetaAno, projAno: despOpRealMes * 12, above: false },
      { res: true, label: '= Resultado Líquido', orcMes: resMeta, realMes: resReal, orcAno: resMeta * 12, projAno: resReal * 12, above: true },
    ];
  }, [lastRealMes, receitaReal, tx, year, orcMap]);

  // ── Salvar metas no banco ─────────────────────────────────────
  async function saveMeta(tipo, referencia, mes, valor) {
    setSaving(true);
    try {
      await api.upsertOrcamento([{ ano: year, mes: mes ?? null, tipo, referencia: referencia ?? '', valor }]);
      const fresh = await api.getOrcamento(year);
      actions.dispatch({ type: 'SET_ORCAMENTO', payload: fresh });
      actions.notify('Meta salva!', 'ns');
    } catch (e) {
      actions.notify(e.message, 'ne');
    } finally {
      setSaving(false);
    }
  }

  function openModal(type, data, options, title) {
    setModalChart({ type, data, options, title });
  }

  const hasOrcamento = orcamento.length > 0;

  return (
    <div className="ani">
      {modalChart && <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />}

      {/* ── Aviso sem orçamento ── */}
      {!hasOrcamento && (
        <div className="panel mb-3.5 flex items-center gap-3 p-4" style={{ borderLeft: '3px solid #f59e0b' }}>
          <Icon name="info" size="text-[18px]" style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div>
            <div className="font-semibold text-[13px] text-text-base">Nenhuma meta cadastrada para {year}</div>
            <div className="text-[11px] text-text-3 mt-0.5">
              Use o painel <strong>Metas de Receita</strong> abaixo para definir os valores orçados mês a mês.
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs Meta vs Realizado ── */}
      {kpiCards.length > 0 && (
        <div className="flex gap-2.5 flex-wrap mb-3.5">
          {kpiCards.map((k, i) => (
            <div key={i} className={`kpi-card flex-1 min-w-[155px] ${k.good ? 'kc-g' : 'kc-r'}`}>
              <div className="text-[9.5px] uppercase tracking-[1px] text-text-3 mb-2">{k.label}</div>
              <div className="flex gap-3 items-end mb-1">
                <div>
                  <div className="text-[8.5px] text-text-3 mb-0.5">META</div>
                  <div className="text-[14px] font-bold text-text-3">{k.meta}</div>
                </div>
                <div>
                  <div className="text-[8.5px] mb-0.5" style={{ color: k.good ? '#059669' : RD }}>REALIZADO</div>
                  <div className="text-[16px] font-black text-text-base">{k.real}</div>
                </div>
              </div>
              <div className="text-[9.5px] font-semibold" style={{ color: k.good ? '#059669' : RD }}>{k.delta}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Seletor de cenários ── */}
      <div className="flex items-center gap-3 flex-wrap mb-3.5">
        <span className="text-[11px] font-semibold text-text-2">Cenário de Receita:</span>
        <div className="flex gap-1.5 flex-wrap">
          {SCENARIO_DEFS.map((s, i) => (
            <button key={s.key} onClick={() => setScenario(i)}
              className={`px-3 py-1.5 rounded-sm border text-[11px] font-semibold transition-all cursor-pointer ${
                scenario === i
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white dark:bg-[#1a2d42] text-text-2 dark:text-[#c4d4e4] border-slate-200 dark:border-[#2d4060] hover:border-accent hover:text-accent'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-text-3 italic">{sc.desc}</span>
      </div>

      {/* ── Gráficos: Receita + Gastos ── */}
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <div className="panel">
          <div className="panel-hdr">
            <div className="font-inter font-semibold text-[13px]">Receita Bruta — Realizado vs Orçado</div>
            <span className="text-[9.5px] text-text-3">⤢ clique para ampliar</span>
          </div>
          <div className="p-4 cursor-zoom-in" style={{ height: 220 }}
            onClick={() => openModal('bar', orcAnualData, orcAnualOpts, 'Receita Bruta — Realizado vs Orçado')}>
            <Bar data={orcAnualData} options={orcAnualOpts} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Gastos por Categoria — Meta vs Realizado</div>
              {gastoStack.length > 1 && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button onClick={() => setGastoStack(s => s.slice(0, -1))}
                    className="text-[10px] text-accent underline cursor-pointer">← Voltar</button>
                  <span className="text-[10px] text-text-3">› {gastoLabel}</span>
                </div>
              )}
            </div>
            <span className="text-[9.5px] text-text-3">Clique para detalhar</span>
          </div>
          <div className="p-4 cursor-pointer" style={{ height: 230 }}>
            <Bar data={gastoData} options={gastoOpts} />
          </div>
        </div>
      </div>

      {/* ── Tabela de acompanhamento ── */}
      {orcTable.length > 0 && (
        <div className="panel mb-3.5">
          <div className="panel-hdr">
            <div className="font-inter font-semibold text-[13px]">
              Acompanhamento Orçamentário — {MES12[lastRealMes]} {year}
            </div>
            <span className="text-[9.5px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(109,191,69,.12)', color: '#5aaa36' }}>Rolling Forecast</span>
          </div>
          <div className="overflow-x-auto">
            <table className="orc-tbl w-full border-collapse" style={{ fontSize: 11.5 }}>
              <thead>
                <tr>
                  {['Categoria','Orç. Mês','Real. Mês','Variação R$','Variação %','Orç. Ano','Proj. Ano','Status'].map(h => (
                    <th key={h} className={`py-2 px-3.5 text-[9px] uppercase tracking-widest border-b border-slate-100 whitespace-nowrap font-bold bg-[#1C2B3A] text-white ${h === 'Categoria' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orcTable.map((row, i) => {
                  if (row.sec) return (
                    <tr key={i}><td colSpan={8} className="px-3.5 py-2 font-bold text-[9.5px] uppercase tracking-[0.5px] bg-[#1C2B3A] text-white">{row.label}</td></tr>
                  );
                  const varR = row.realMes - row.orcMes;
                  const varP = row.orcMes !== 0 ? ((varR / Math.abs(row.orcMes)) * 100).toFixed(1) : '—';
                  const pos  = row.above ? varR >= 0 : varR <= 0;
                  const cls  = pos ? 'text-fin-green font-semibold' : 'text-fin-red font-semibold';
                  const status = row.above ? (varR >= 0 ? '✔ Acima' : '✖ Abaixo') : (varR <= 0 ? '✔ Abaixo' : '✖ Acima');
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      style={row.res ? { background: 'rgba(109,191,69,.07)', fontWeight: 800, borderTop: '2px solid rgba(109,191,69,.2)' } : {}}>
                      <td className="px-3.5 py-2 text-left text-text-base font-medium">{row.label}</td>
                      <td className="px-3.5 py-2 text-right text-text-2 font-mono">{fmtBrl(row.orcMes)}</td>
                      <td className="px-3.5 py-2 text-right text-text-base font-semibold font-mono">{fmtBrl(row.realMes)}</td>
                      <td className={`px-3.5 py-2 text-right font-mono ${cls}`}>{varR >= 0 ? '+' : ''}{fmtBrl(Math.abs(varR))}</td>
                      <td className={`px-3.5 py-2 text-right font-mono ${cls}`}>{varR >= 0 ? '+' : ''}{typeof varP === 'string' ? varP : varP + '%'}</td>
                      <td className="px-3.5 py-2 text-right text-text-2 font-mono">{fmtBrl(row.orcAno)}</td>
                      <td className={`px-3.5 py-2 text-right font-mono ${pos ? 'text-fin-green font-semibold' : 'text-fin-red font-semibold'}`}>{fmtBrl(row.projAno)}</td>
                      <td className={`px-3.5 py-2 text-right ${pos ? 'text-fin-green font-semibold' : 'text-fin-red font-semibold'}`}>{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Painel de edição de metas ── */}
      <div className="panel">
        <div className="panel-hdr">
          <div>
            <div className="font-inter font-semibold text-[13px]">Metas de Receita — {year}</div>
            <div className="text-[10px] text-text-3 mt-0.5">Defina o orçado mensal e o ponto de equilíbrio</div>
          </div>
          {saving && <span className="text-[11px] text-text-3 italic">Salvando…</span>}
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            {MES12.map((mes, m) => (
              <div key={m}>
                <div className="text-[9px] uppercase tracking-widest text-text-3 mb-1">{mes}</div>
                <input
                  type="number"
                  className="w-full text-[11px] border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="R$"
                  defaultValue={orcMap.receita[m] ?? ''}
                  onBlur={e => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) saveMeta('receita', '', m, v);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-text-2">Ponto de Equilíbrio (anual R$):</span>
            <input
              type="number"
              className="text-[11px] border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
              style={{ width: 140 }}
              placeholder="R$"
              defaultValue={orcMap.breakeven || ''}
              onBlur={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) saveMeta('breakeven', '', null, v);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
