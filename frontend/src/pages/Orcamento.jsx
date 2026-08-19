import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/index.js';
import { DRILL_TREE, buildDrillTree, sumNode } from '../utils/drillHierarchy.js';
import ChartModal from '../components/ui/ChartModal.jsx';
import Icon from '../components/ui/Icon.jsx';
import MetasTab from '../components/orcamento/MetasTab.jsx';
import InfoPopover from '../components/ui/InfoPopover.jsx';

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
  const { transactions, orcamento, filterState, darkMode, plano } = state;
  const year = filterState.year;
  const tx = transactions.competencia;

  const [tab, setTab]               = useState('acompanhamento'); // 'acompanhamento' | 'metas'
  const [scenario, setScenario]     = useState(1);
  const [gastoStack, setGastoStack] = useState(['root']);
  const [modalChart, setModalChart] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

  // O orçamento é sempre do ano selecionado no filtro — recarrega ao trocar o "Ano",
  // deixando o sistema pronto para consultar o histórico de anos anteriores.
  useEffect(() => {
    let cancelled = false;
    api.getOrcamento(year).then(orc => {
      if (!cancelled) actions.dispatch({ type: 'SET_ORCAMENTO', payload: orc });
    });
    return () => { cancelled = true; };
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const gc = darkMode ? '#1e2d42' : 'rgba(0,0,0,0.06)';
  const tc = darkMode ? '#8aa3be' : '#94a3b8';
  const axisProps = { tick: { fill: tc, fontSize: 10 }, axisLine: false, tickLine: false };
  const gridProps = { strokeDasharray: '3 3', stroke: gc, vertical: false };

  // ── Parse orcamento entries into lookup maps ──────────────────
  const orcMap = useMemo(() => {
    const receita      = {};   // mes → valor
    const cenarios     = {};   // key → { mes → valor }
    const metaCat      = {};   // nodeId → valor (annual)
    const metaDespesa  = {};   // 'op'|'nop' → { mes → valor }
    const cenarioDelta = {};   // 'pessimista'|'otimista'|'muito_otimista' → %
    let breakeven      = 0;
    let metaCustoPct   = null;

    for (const e of orcamento) {
      if (e.tipo === 'receita')        receita[e.mes] = e.valor;
      if (e.tipo === 'breakeven')      breakeven = e.valor;
      if (e.tipo === 'cenario') {
        if (!cenarios[e.referencia]) cenarios[e.referencia] = {};
        cenarios[e.referencia][e.mes] = e.valor;
      }
      if (e.tipo === 'meta_cat')       metaCat[e.referencia] = (metaCat[e.referencia] || 0) + e.valor;
      if (e.tipo === 'meta_despesa') {
        if (!metaDespesa[e.referencia]) metaDespesa[e.referencia] = {};
        metaDespesa[e.referencia][e.mes] = e.valor;
      }
      if (e.tipo === 'meta_custo_pct') metaCustoPct = e.valor;
      if (e.tipo === 'cenario_delta')  cenarioDelta[e.referencia] = e.valor;
    }

    // Metas de categoria em modo "%" (Custos Diretos com percentual livre por categoria):
    // converte para R$ usando a meta de receita do mês e soma ao total anual da categoria.
    // Feito num 2º passe porque a ordenação do backend pode trazer meta_cat_pct antes de receita.
    for (const e of orcamento) {
      if (e.tipo === 'meta_cat_pct' && e.mes >= 0 && e.mes <= 11) {
        const rec = receita[e.mes] || 0;
        metaCat[e.referencia] = (metaCat[e.referencia] || 0) + (rec * e.valor / 100);
      }
    }

    // Compute cenario projections from meta × delta when delta entries exist
    if (Object.keys(cenarioDelta).length > 0) {
      const meses = Object.keys(receita).map(Number);
      ['pessimista', 'otimista', 'muito_otimista'].forEach(key => {
        const pct  = cenarioDelta[key];
        if (pct == null) return;
        const mult = key === 'pessimista' ? (1 - pct / 100) : (1 + pct / 100);
        if (!cenarios[key]) cenarios[key] = {};
        meses.forEach(m => { if (receita[m]) cenarios[key][m] = Math.round(receita[m] * mult); });
      });
      // Moderado = 100% of meta
      if (!cenarios['moderado']) {
        cenarios['moderado'] = {};
        Object.keys(receita).forEach(m => { cenarios['moderado'][Number(m)] = receita[Number(m)]; });
      }
    }

    return { receita, cenarios, metaCat, metaDespesa, metaCustoPct, cenarioDelta, breakeven };
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
  const orcAnualData = useMemo(() => MES12.map((month, m) => ({
    month,
    Realizado:              receitaReal[m] != null ? +(receitaReal[m] / 1000).toFixed(1) : null,
    Orçado:                 (orcMap.receita[m] ?? 0) > 0 ? +((orcMap.receita[m] ?? 0) / 1000).toFixed(1) : null,
    [sc.label + ' (proj)']: orcMap.cenarios[sc.key]?.[m] != null ? +(orcMap.cenarios[sc.key][m] / 1000).toFixed(1) : null,
  })), [receitaReal, orcMap, sc]);

  // Árvore real do Plano de Contas (cat/grp/tipo) — a mesma usada em Metas por Categoria.
  // Antes disso usava a DRILL_TREE estática (fallback com filhos vazios), o que fazia o
  // drill-down parar sempre no nível macro (Gastos Operacionais / Não Operacionais).
  const gastoTree = useMemo(() => plano?.length ? buildDrillTree(plano) : DRILL_TREE, [plano]);

  function findGastoNode(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children?.length) {
        const found = findGastoNode(n.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  // ── Gastos drill-down ─────────────────────────────────────────
  const gastoItems = useMemo(() => {
    const nodeKey = gastoStack[gastoStack.length - 1];
    const nodes = nodeKey === 'root'
      ? gastoTree.children
      : (findGastoNode(gastoTree.children, nodeKey)?.children ?? []);
    return nodes.map(node => ({
      node,
      real: sumNodeYear(node, tx, year) / 1000,
      meta: (orcMap.metaCat[node.id] ?? 0) / 1000,
      hasChildren: !!(node.children?.length),
    }));
  }, [gastoStack, tx, year, orcMap, gastoTree]);

  const gastoLabel = useMemo(() => {
    const key = gastoStack[gastoStack.length - 1];
    if (key === 'root') return 'Todos os Grupos';
    return findGastoNode(gastoTree.children, key)?.label ?? '';
  }, [gastoStack, gastoTree]);

  const gastoData = useMemo(() => gastoItems.map(i => ({
    name: i.node.label,
    Meta:      +i.meta.toFixed(1),
    Realizado: +i.real.toFixed(1),
    _excede:   i.real > i.meta && i.meta > 0,
    _hasChildren: i.hasChildren,
  })), [gastoItems]);

  const breakeven = orcMap.breakeven > 0 ? +(orcMap.breakeven / 1000).toFixed(1) : null;

  function OrcTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#1C1C1C', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#aaa', marginTop: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill || p.color, display: 'inline-block', flexShrink: 0 }} />
            <span>{p.name}:</span>
            <span style={{ color: '#fff' }}>R${p.value}K</span>
          </div>
        ))}
      </div>
    );
  }

  // ── KPI cards (último mês real vs meta mensal) ────────────────
  const kpiCards = useMemo(() => {
    if (lastRealMes < 0) return [];
    const m = lastRealMes;

    const recReal  = receitaReal[m] ?? 0;
    const recMeta  = orcMap.receita[m] ?? 0;

    // Saídas operacionais reais no mês
    const despOpNode = findGastoNode(gastoTree.children, 'gastos-op');
    const despOpReal = despOpNode ? sumNodeMes(despOpNode, tx, year, m) : 0;
    const despOpMeta = orcMap.metaDespesa?.op?.[m] ?? (orcMap.metaCat['gastos-op'] ?? 0) / 12;

    // Margem operacional
    const mgOpReal = recReal > 0 ? ((recReal - despOpReal) / recReal * 100) : 0;
    const mgOpMeta = recMeta > 0 ? ((recMeta - despOpMeta) / recMeta * 100) : 0;

    // Saídas não operacionais
    const nopNode  = findGastoNode(gastoTree.children, 'gastos-nop');
    const nopReal  = nopNode ? sumNodeMes(nopNode, tx, year, m) : 0;
    const nopMeta  = orcMap.metaDespesa?.nop?.[m] ?? (orcMap.metaCat['gastos-nop'] ?? 0) / 12;

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
      return { label, meta: fmtV(meta), real: fmtV(real), good, higherIsBetter, delta };
    }

    return [
      card('Receita Bruta',          recMeta,   recReal,   true),
      card('Desp. Operacionais',     despOpMeta, despOpReal, false),
      card('Margem Operacional',     mgOpMeta,  mgOpReal,  true, true),
      card('Gastos Não Operacionais', nopMeta,  nopReal,   false),
      card('Resultado Líquido',      resMeta,   resReal,   true),
    ];
  }, [lastRealMes, receitaReal, tx, year, orcMap, gastoTree]);

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

    const despOpNode = findGastoNode(gastoTree.children, 'gastos-op');
    const despOpRealMes = despOpNode ? sumNodeMes(despOpNode, tx, year, m) : 0;
    const despOpMeta    = orcMap.metaDespesa?.op?.[m] ?? (orcMap.metaCat['gastos-op'] ?? 0) / 12;
    const despOpMetaAno = ALL_MES.reduce((s, i) => s + (orcMap.metaDespesa?.op?.[i] ?? (orcMap.metaCat['gastos-op'] ?? 0) / 12), 0);

    // Custos reais no mês — encontra a categoria de nível "Custo" pelo nome,
    // em vez de assumir que é sempre o primeiro filho (a ordem não é garantida).
    const custoCatName = plano?.find(p => p.nivel === 'Custo')?.cat;
    const custoNode  = custoCatName ? despOpNode?.children?.find(c => c.label === custoCatName) : null;
    const custoReal  = custoNode ? sumNodeMes(custoNode, tx, year, m) : 0;
    const custoMeta  = orcMap.metaCustoPct
      ? (recOrcMes * orcMap.metaCustoPct / 100)
      : custoNode ? (orcMap.metaCat[custoNode.id] ?? 0) / 12 : 0;

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
  }, [lastRealMes, receitaReal, tx, year, orcMap, gastoTree, plano]);

  // ── Alertas de estouro ─────────────────────────────────────────
  // KPIs de despesa (não os de receita/margem) que já estão acima da meta do mês.
  const kpiAlerts = useMemo(
    () => kpiCards.filter(k => !k.good && k.higherIsBetter === false),
    [kpiCards]
  );

  // Categorias/grupos com meta anual (definida em Metas por Categoria) cujo realizado
  // até o último mês com dados já ultrapassa o ritmo esperado (meta ÷ 12 × meses decorridos).
  const categoriaAlerts = useMemo(() => {
    if (lastRealMes < 0) return [];
    const mesesDecorridos = lastRealMes + 1;
    const mesesAteAgora = ALL_MES.slice(0, mesesDecorridos);
    const alerts = [];

    function walk(nodes) {
      nodes.forEach(node => {
        const metaAnual = Number(orcMap.metaCat[node.id]) || 0;
        if (metaAnual > 0) {
          const metaRitmo = metaAnual * mesesDecorridos / 12;
          const realizado = sumNode(node, tx, mesesAteAgora, year);
          if (realizado > metaRitmo) {
            alerts.push({
              id: node.id,
              label: node.label,
              realizado,
              metaRitmo,
              excedente: realizado - metaRitmo,
              pct: metaRitmo > 0 ? ((realizado - metaRitmo) / metaRitmo * 100) : 0,
            });
          }
        }
        if (node.children?.length) walk(node.children);
      });
    }
    walk(gastoTree.children ?? []);
    return alerts.sort((a, b) => b.excedente - a.excedente);
  }, [orcMap.metaCat, tx, year, lastRealMes, gastoTree]);

  const totalAlerts = kpiAlerts.length + categoriaAlerts.length;

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

  function openModal(title, element) {
    setModalChart({ title, element });
  }

  const hasOrcamento = orcamento.length > 0;

  const KPI_INFO = {
    'Receita Bruta': {
      title: 'KPI — Receita Bruta',
      description: 'Total faturado no último mês com dados reais, comparado à meta mensal definida na aba Metas.\n\nVerde = receita acima ou igual à meta.\nVermelho = receita abaixo da meta.',
    },
    'Desp. Operacionais': {
      title: 'KPI — Despesas Operacionais',
      description: 'Soma de todos os gastos operacionais (pessoal, aluguel, administrativo, comercial, etc.) no último mês com dados, comparado à meta mensal.\n\nVerde = despesas abaixo da meta (bom).\nVermelho = despesas acima da meta (atenção).',
    },
    'Margem Operacional': {
      title: 'KPI — Margem Operacional (EBIT)',
      description: 'Percentual da Receita Bruta que sobra após deduzir custos diretos e despesas operacionais.\n\nFórmula: (Receita − Custos − Desp. Op.) / Receita × 100\n\nVerde = margem acima da meta.\nVermelho = margem abaixo da meta.',
    },
    'Gastos Não Operacionais': {
      title: 'KPI — Gastos Não Operacionais',
      description: 'Total de despesas fora da operação principal (impostos sobre lucro, juros, tarifas bancárias, investimentos) no último mês com dados.\n\nVerde = abaixo da meta (bom).\nVermelho = acima da meta (atenção).',
    },
    'Resultado Líquido': {
      title: 'KPI — Resultado Líquido',
      description: 'Receita Bruta menos todos os gastos (operacionais + não operacionais) no último mês com dados.\n\nFórmula: Receita − Desp. Op. − Desp. Não Op.\n\nVerde = resultado acima da meta.\nVermelho = resultado abaixo da meta.',
    },
  };

  return (
    <div className="ani">
      {modalChart && <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />}

      {/* ── Sub-tabs ── */}
      <div className="flex items-center gap-0 mb-4 border-b border-slate-200 dark:border-slate-700">
        {[
          { id: 'acompanhamento', label: 'Acompanhamento' },
          { id: 'metas',          label: 'Metas' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-3 hover:text-text-2'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Metas ── */}
      {tab === 'metas' && (
        <MetasTab
          orcamento={orcamento}
          receitaReal={receitaReal}
          year={year}
          actions={actions}
          plano={plano}
          tx={tx}
        />
      )}

      {/* ── Tab: Acompanhamento ── */}
      {tab === 'acompanhamento' && <>

      {/* ── Aviso sem orçamento ── */}
      {!hasOrcamento && (
        <div className="panel mb-3.5 flex items-center gap-3 p-4" style={{ borderLeft: '3px solid #f59e0b' }}>
          <Icon name="info" size="text-[18px]" style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div>
            <div className="font-semibold text-[13px] text-text-base">Nenhuma meta cadastrada para {year}</div>
            <div className="text-[11px] text-text-3 mt-0.5">
              Acesse a aba <strong>Metas</strong> para definir receita esperada, limites de gastos e cenários.
            </div>
          </div>
        </div>
      )}

      {/* ── Alertas de estouro ── */}
      {totalAlerts > 0 && (
        <div className="panel mb-3.5 border border-red-200 dark:border-red-900/40">
          <div
            className="panel-hdr bg-red-50 dark:bg-red-900/15"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setAlertsCollapsed(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Icon name="warning" size="text-[18px]" style={{ color: '#ef4444' }} />
              <div>
                <div className="font-inter font-semibold text-[13px] text-fin-red">
                  {totalAlerts} alerta{totalAlerts !== 1 ? 's' : ''} de estouro de orçamento
                </div>
                <div className="text-[10px] text-text-3 mt-0.5">
                  Comparado à meta de {MES12[lastRealMes]} {year} (indicadores) e ao ritmo esperado da meta anual (categorias)
                </div>
              </div>
            </div>
            <Icon
              name={alertsCollapsed ? 'chevron_right' : 'expand_more'}
              size="text-[18px]"
              style={{ color: '#ef4444', flexShrink: 0 }}
            />
          </div>
          {!alertsCollapsed && (
            <div className="p-3 space-y-1.5">
              {kpiAlerts.map(k => (
                <div key={k.label} className="flex items-center justify-between gap-3 text-[11.5px] px-2.5 py-2 rounded bg-red-50/70 dark:bg-red-900/10">
                  <span className="text-text-base font-medium">{k.label}</span>
                  <span className="text-right">
                    <span className="text-fin-red font-semibold">{k.real}</span>
                    <span className="text-text-3"> vs meta {k.meta} · {k.delta}</span>
                  </span>
                </div>
              ))}
              {categoriaAlerts.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 text-[11.5px] px-2.5 py-2 rounded bg-red-50/70 dark:bg-red-900/10">
                  <span className="text-text-base font-medium truncate">{a.label}</span>
                  <span className="text-right whitespace-nowrap">
                    <span className="text-fin-red font-semibold">{fmtBrl(a.realizado)}</span>
                    <span className="text-text-3"> vs ritmo {fmtBrl(a.metaRitmo)} · +{a.pct.toFixed(0)}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── KPIs Meta vs Realizado ── */}
      {kpiCards.length > 0 && (
        <div className="flex gap-2.5 flex-wrap mb-3.5">
          {kpiCards.map((k, i) => (
            <div key={i} className={`kpi-card flex-1 min-w-[155px] ${k.good ? 'kc-g' : 'kc-r'}`}>
              <div className="text-[9.5px] uppercase tracking-[1px] text-text-3 mb-2 flex items-center gap-1">
                {k.label}
                {KPI_INFO[k.label] && (
                  <InfoPopover title={KPI_INFO[k.label].title} description={KPI_INFO[k.label].description} />
                )}
              </div>
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

      {/* ── Gráfico: Receita Bruta ── */}
      <div className="panel mb-3.5">
        <div className="panel-hdr">
          <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
            Receita Bruta — Realizado vs Orçado
            <InfoPopover
              title="Receita Bruta — Realizado vs Orçado"
              description={'Comparativo mensal entre três séries:\n\n• Realizado (verde): receita efetivamente obtida, com base nos lançamentos de Competência.\n• Orçado (cinza): meta de receita definida na aba Metas.\n• Cenário (cor variável): projeção calculada como Meta × variação % do cenário selecionado.\n\nA linha laranja tracejada representa o Ponto de Equilíbrio anual configurado.\n\nUse o seletor de cenário acima para alternar entre Pessimista, Moderado, Otimista e Muito Otimista.'}
            />
          </div>
          <span className="text-[9.5px] text-text-3 cursor-pointer"
            onClick={() => openModal('Receita Bruta — Realizado vs Orçado',
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orcAnualData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis tickFormatter={v => 'R$' + v + 'K'} {...axisProps} width={56} />
                  <RcTooltip content={<OrcTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: tc }} />
                  <Bar dataKey="Realizado" fill={GR} radius={[4,4,0,0]} />
                  <Bar dataKey="Orçado"    fill={GY} radius={[4,4,0,0]} />
                  <Bar dataKey={sc.label + ' (proj)'} fill={sc.color} radius={[4,4,0,0]} />
                  {breakeven && <ReferenceLine y={breakeven} stroke={OR} strokeDasharray="7 4" strokeWidth={2} label={{ value: 'Equilíbrio', fill: OR, fontSize: 10 }} />}
                </BarChart>
              </ResponsiveContainer>
            )}>⤢ ampliar</span>
        </div>
        <div className="p-4" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={orcAnualData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis tickFormatter={v => 'R$' + v + 'K'} {...axisProps} width={56} />
              <RcTooltip content={<OrcTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: tc }} />
              <Bar dataKey="Realizado" fill={GR} radius={[4,4,0,0]} />
              <Bar dataKey="Orçado"    fill={GY} radius={[4,4,0,0]} />
              <Bar dataKey={sc.label + ' (proj)'} fill={sc.color} radius={[4,4,0,0]} />
              {breakeven && <ReferenceLine y={breakeven} stroke={OR} strokeDasharray="7 4" strokeWidth={2} label={{ value: 'Equilíbrio', fill: OR, fontSize: 10 }} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Gráfico: Gastos por Categoria ── */}
      <div className="panel mb-3.5">
        <div className="panel-hdr">
          <div>
            <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
              Gastos por Categoria — Meta vs Realizado
              <InfoPopover
                title="Gastos por Categoria — Meta vs Realizado"
                description={'Compara a meta anual de cada grupo de gastos com o valor acumulado até agora no ano.\n\n• Cinza: meta definida na aba Metas.\n• Verde: realizado abaixo da meta (dentro do orçamento).\n• Vermelho: realizado acima da meta (estouro do orçamento).\n\nClique em uma barra para detalhar o grupo por categoria. Use "← Voltar" para subir um nível na hierarquia.'}
              />
            </div>
            {gastoStack.length > 1 && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <button onClick={() => setGastoStack(s => s.slice(0, -1))} className="text-[10px] text-accent underline cursor-pointer">← Voltar</button>
                <span className="text-[10px] text-text-3">› {gastoLabel}</span>
              </div>
            )}
          </div>
          <span className="text-[9.5px] text-text-3">Clique para detalhar</span>
        </div>
        <div className="p-4" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gastoData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis tickFormatter={v => 'R$' + v + 'K'} {...axisProps} width={56} />
              <RcTooltip content={<OrcTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: tc }} />
              <Bar dataKey="Meta" fill={GY} radius={[4,4,0,0]} />
              <Bar dataKey="Realizado" radius={[4,4,0,0]}
                onClick={(entry, index) => { if (gastoItems[index]?.hasChildren) setGastoStack(s => [...s, gastoItems[index].node.id]); }}
                style={{ cursor: 'pointer' }}>
                {gastoData.map((entry, i) => (
                  <Cell key={i} fill={entry._excede ? 'rgba(229,62,62,.8)' : 'rgba(109,191,69,.8)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tabela de acompanhamento ── */}
      {orcTable.length > 0 && (
        <div className="panel mb-3.5">
          <div className="panel-hdr">
            <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
              Acompanhamento Orçamentário — {MES12[lastRealMes]} {year}
              <InfoPopover
                title="Acompanhamento Orçamentário (Rolling Forecast)"
                description={'Tabela de controle do último mês com dados reais.\n\nColunas:\n• Orç. Mês: meta mensal definida.\n• Real. Mês: valor efetivamente realizado no mês.\n• Variação R$ / %: diferença entre realizado e orçado.\n• Orç. Ano: soma das metas mensais do ano inteiro.\n• Proj. Ano: realizado acumulado até o mês atual + orçado nos meses restantes (Rolling Forecast).\n• Status: indica se a linha está acima ou abaixo da meta (considerando se maior é melhor ou pior).'}
              />
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
                    <tr key={i} className="border-b border-slate-100 transition-colors"
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

      </> /* end tab: acompanhamento */}
    </div>
  );
}
