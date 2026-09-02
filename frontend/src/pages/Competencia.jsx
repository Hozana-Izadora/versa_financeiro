import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer } from '../lib/utils.js';
import {
  ComposedChart, LineChart, Bar, Line, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { buildDRE } from '../utils/dreBuilder.js';
import { MONTHS, fmt, fmtK, fmtPct, pct, getAvailableMonths, linearTrend, matchesCostCenter } from '../utils/formatters.js';
import DreTable from '../components/dre/DreTable.jsx';
import Icon from '../components/ui/Icon.jsx';
import ChartModal from '../components/ui/ChartModal.jsx';
import DrillChart from '../components/ui/DrillChart.jsx';
import InfoPopover from '../components/ui/InfoPopover.jsx';
import ChartFilterPicker from '../components/ui/ChartFilterPicker.jsx';
import ValuesBtn from '../components/ui/ValuesBtn.jsx';
import MinimizeBtn from '../components/ui/MinimizeBtn.jsx';
import { useChartFilter } from '../hooks/useChartFilter.js';
import { usePermissions } from '../hooks/usePermissions.js';

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

const KPI_TONE = {
  '#10b981': 'green',
  '#ef4444': 'red',
  '#f59e0b': 'amber',
  '#2563eb': 'blue',
  '#8b5cf6': 'purple',
};

function CNode({ label, value, sub, color, result, delta, deltaDir, rawValue, cmp }) {
  const cmpDelta = cmp != null && rawValue != null && Math.abs(cmp.prev) > 0.01
    ? ((rawValue - cmp.prev) / Math.abs(cmp.prev) * 100) : null;
  const cmpUp = cmp != null && rawValue != null ? rawValue >= cmp.prev : null;
  const cmpGood = cmp != null && cmpUp != null ? (cmp.positiveIsGood !== false ? cmpUp : !cmpUp) : null;
  const tone = KPI_TONE[color];
  return (
    <div className={`kpi-card flex-1 min-w-0 ${result ? 'kpi-result' : ''} ${tone ? `kpi-tone-${tone}` : ''}`}>
      <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5 min-h-[3em]">{label}</div>
      <div className="font-inter font-bold text-[20px] tracking-tight mb-0.5" style={{ color }}>{value}</div>
      <div className="text-[11px] text-text-3">{sub}</div>
      {delta && (
        <div className={`text-[10px] font-semibold mt-0.5 ${deltaDir === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
          {deltaDir === 'up' ? '▲' : '▼'} {delta}
        </div>
      )}
      {cmp != null && rawValue != null && (
        <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-1 flex-wrap">
          <span className="text-[10px] font-mono text-text-3">{fmtK(cmp.prev)}</span>
          {cmpDelta != null && (
            <span className={`text-[10px] font-semibold ${cmpGood ? 'text-emerald-500' : 'text-red-500'}`}>
              {cmpUp ? '▲' : '▼'} {Math.abs(cmpDelta).toFixed(1)}%
            </span>
          )}
          <span className="ml-auto text-[9px] text-text-3 font-medium">{cmp.year}</span>
        </div>
      )}
    </div>
  );
}

function CSep({ symbol }) {
  return <div className="cascade-sep">{symbol}</div>;
}

function SubtabBar({ active, onChange, tabs }) {
  if (!tabs?.length) return null;
  return (
    <div className="subtab-bar flex bg-bg-2 border-b border-slate-100 px-4 lg:px-7 mb-4 -mx-4 lg:-mx-7 -mt-6">
      {tabs.map(({ idx, label }) => (
        <button key={idx} onClick={() => onChange(idx)}
          className={`subtab-btn py-2.5 px-4 text-[11.5px] font-semibold cursor-pointer border-0 border-b-2 transition-all bg-transparent -mb-px ${active === idx ? 'act text-accent border-accent' : 'text-text-3 border-transparent hover:text-text-base'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Competencia() {
  const { state, actions } = useApp();
  const { transactions, plano, saldosIniciais, filterState, darkMode } = state;
  const { canChart, canSubtab } = usePermissions();
  const [showPct, setShowPct] = useState(true);
  const [subTab, setSubTab] = useState(0);

  // Volta direto para a sub-aba do Demonstrativo ao retornar de um drill-down em Lançamentos.
  useEffect(() => {
    if (state.pendingSubTab == null) return;
    setSubTab(state.pendingSubTab);
    actions.dispatch({ type: 'SET_PENDING_SUBTAB', payload: null });
  }, [state.pendingSubTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const [modalChart, setModalChart] = useState(null);
  const [showVRec, setShowVRec] = useState(false);
  const [showVDre, setShowVDre] = useState(false);
  const [showVMg,  setShowVMg]  = useState(false);
  const [collapsedCharts, setCollapsedCharts] = useState(new Set());
  function toggleChartCollapse(key) {
    setCollapsedCharts(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const tx = transactions.competencia;

  const subtabs = [
    canSubtab('competencia', 'subtab_overview') && { idx: 0, label: 'Visão Geral' },
    canSubtab('competencia', 'subtab_dre')      && { idx: 1, label: 'Demonstrativo' },
  ].filter(Boolean);

  // ── Global filter (used by KPI cascade, DRE table) ───────────────
  const filteredTx = useMemo(() => tx.filter(r => {
    const d = new Date(r.data + 'T12:00');
    return d.getFullYear() === filterState.year &&
      (filterState.months.size === 0 || filterState.months.has(d.getMonth())) &&
      matchesCostCenter(r, filterState);
  }), [tx, filterState]);

  const visMonths = useMemo(() => {
    if (filterState.months.size > 0) return [...filterState.months].sort((a, b) => a - b);
    const avail = getAvailableMonths(tx, filterState.year);
    return avail.length ? avail : [new Date().getMonth()];
  }, [tx, filterState]);

  const dre = useMemo(() =>
    buildDRE(filteredTx, plano, visMonths, 'competencia', filterState, saldosIniciais),
    [filteredTx, plano, visMonths, filterState, saldosIniciais]);

  // ── Comparison year (YoY) ─────────────────────────────────────────
  const { compareYear } = filterState;

  const filteredTxPrev = useMemo(() => {
    if (!compareYear) return null;
    return tx.filter(r => {
      const d = new Date(r.data + 'T12:00');
      return d.getFullYear() === compareYear &&
        (filterState.months.size === 0 || filterState.months.has(d.getMonth())) &&
        matchesCostCenter(r, filterState);
    });
  }, [tx, compareYear, filterState.months, filterState.costCenter, filterState.costCenterField]);

  const drePrev = useMemo(() => {
    if (!filteredTxPrev) return null;
    return buildDRE(filteredTxPrev, plano, visMonths, 'competencia', { ...filterState, year: compareYear }, saldosIniciais);
  }, [filteredTxPrev, plano, visMonths, filterState, compareYear, saldosIniciais]);

  const cmpNode = (prev, positiveIsGood = true) =>
    compareYear && drePrev && prev != null ? { prev, year: compareYear, positiveIsGood } : null;

  // ── Per-chart filter hooks ────────────────────────────────────────
  const recCF      = useChartFilter(tx, filterState);
  const dreChartCF = useChartFilter(tx, filterState);
  const mgChartCF  = useChartFilter(tx, filterState);
  const drillCF    = useChartFilter(tx, filterState);

  const recDre = useMemo(() =>
    recCF.isOverriding
      ? buildDRE(recCF.effectiveTx, plano, recCF.effectiveVisMonths, 'competencia', filterState, saldosIniciais)
      : dre,
    [recCF.isOverriding, recCF.effectiveTx, recCF.effectiveVisMonths, plano, filterState, saldosIniciais, dre]);

  const dreChartDre = useMemo(() =>
    dreChartCF.isOverriding
      ? buildDRE(dreChartCF.effectiveTx, plano, dreChartCF.effectiveVisMonths, 'competencia', filterState, saldosIniciais)
      : dre,
    [dreChartCF.isOverriding, dreChartCF.effectiveTx, dreChartCF.effectiveVisMonths, plano, filterState, saldosIniciais, dre]);

  const mgChartDre = useMemo(() =>
    mgChartCF.isOverriding
      ? buildDRE(mgChartCF.effectiveTx, plano, mgChartCF.effectiveVisMonths, 'competencia', filterState, saldosIniciais)
      : dre,
    [mgChartCF.isOverriding, mgChartCF.effectiveTx, mgChartCF.effectiveVisMonths, plano, filterState, saldosIniciais, dre]);

  // ── Shared chart style props ──────────────────────────────────────
  const gc = darkMode ? '#1e2d42' : 'rgba(0,0,0,0.06)';
  const tc = darkMode ? '#8aa3be' : '#94a3b8';
  const axisProps  = { tick: { fill: tc, fontSize: 11 }, axisLine: false, tickLine: false };
  const gridProps  = { strokeDasharray: '3 3', stroke: gc, vertical: false };
  const legendStyle = { wrapperStyle: { fontSize: 11, color: tc } };

  // ── Chart data ────────────────────────────────────────────────────
  const recChartData = useMemo(() => {
    const isOvr = recCF.isOverriding;
    const vm  = isOvr ? recCF.effectiveVisMonths : visMonths;
    const arr = recDre.mRecOp;
    const tend = linearTrend(arr);
    return vm.map((m, i) => ({
      month: MONTHS[m],
      'Receita Bruta': arr[i],
      Tendência: tend[i],
      ...(!isOvr && drePrev ? { [`Receita Bruta ${compareYear}`]: drePrev.mRecOp[i] ?? 0 } : {}),
    }));
  }, [recCF.isOverriding, recCF.effectiveVisMonths, visMonths, recDre, compareYear, drePrev]);

  const dreChartData = useMemo(() => {
    const isOvr = dreChartCF.isOverriding;
    const vm = isOvr ? dreChartCF.effectiveVisMonths : visMonths;
    return vm.map((m, i) => ({
      month: MONTHS[m],
      Receita:       dreChartDre.mRec[i],
      'Custos+Desp': dreChartDre.mCost[i] + dreChartDre.mDespOp[i] + dreChartDre.mDespNop[i],
      'Lucro Líq.':  dreChartDre.mLL[i],
      ...(!isOvr && drePrev ? {
        [`Receita ${compareYear}`]:       drePrev.mRec[i] ?? 0,
        [`Custos+Desp ${compareYear}`]:   (drePrev.mCost[i] ?? 0) + (drePrev.mDespOp[i] ?? 0) + (drePrev.mDespNop[i] ?? 0),
        [`Lucro Líq. ${compareYear}`]:    drePrev.mLL[i] ?? 0,
      } : {}),
    }));
  }, [dreChartCF.isOverriding, dreChartCF.effectiveVisMonths, visMonths, dreChartDre, compareYear, drePrev]);

  const mbPct = useMemo(() =>
    mgChartDre.mMgB.map((v, i)  => mgChartDre.mRecLiq[i] > 0 ? +(v / mgChartDre.mRecLiq[i] * 100).toFixed(1) : 0),
    [mgChartDre]);

  const moPct = useMemo(() =>
    mgChartDre.mMgOp.map((v, i) => mgChartDre.mRecLiq[i] > 0 ? +(v / mgChartDre.mRecLiq[i] * 100).toFixed(1) : 0),
    [mgChartDre]);

  const llPct = useMemo(() =>
    mgChartDre.mLL.map((v, i)   => mgChartDre.mRecLiq[i] > 0 ? +(v / mgChartDre.mRecLiq[i] * 100).toFixed(1) : 0),
    [mgChartDre]);

  const prevMbPct = useMemo(() =>
    drePrev ? drePrev.mMgB.map((v, i) => drePrev.mRecLiq[i] > 0 ? +(v / drePrev.mRecLiq[i] * 100).toFixed(1) : 0) : null,
    [drePrev]);
  const prevMoPct = useMemo(() =>
    drePrev ? drePrev.mMgOp.map((v, i) => drePrev.mRecLiq[i] > 0 ? +(v / drePrev.mRecLiq[i] * 100).toFixed(1) : 0) : null,
    [drePrev]);
  const prevLlPct = useMemo(() =>
    drePrev ? drePrev.mLL.map((v, i) => drePrev.mRecLiq[i] > 0 ? +(v / drePrev.mRecLiq[i] * 100).toFixed(1) : 0) : null,
    [drePrev]);

  const mgChartData = useMemo(() => {
    const isOvr = mgChartCF.isOverriding;
    const vm = isOvr ? mgChartCF.effectiveVisMonths : visMonths;
    return vm.map((m, i) => ({
      month: MONTHS[m],
      'Mg. Bruta %': mbPct[i],
      'Mg. Op. %':   moPct[i],
      'Mg. Líq. %':  llPct[i],
      ...(!isOvr && prevMbPct ? {
        [`Mg. Bruta ${compareYear}%`]: prevMbPct[i] ?? 0,
        [`Mg. Op. ${compareYear}%`]:   prevMoPct[i] ?? 0,
        [`Mg. Líq. ${compareYear}%`]:  prevLlPct[i] ?? 0,
      } : {}),
    }));
  }, [mgChartCF.isOverriding, mgChartCF.effectiveVisMonths, visMonths, mbPct, moPct, llPct, compareYear, prevMbPct, prevMoPct, prevLlPct]);

  // ── Chart renders ─────────────────────────────────────────────────
  function renderRec(h) {
    const lbl = v => Math.abs(v) > 0.01 ? fmtK(v) : '';
    return (
      <ResponsiveContainer key={String(showVRec)} width="100%" height={h}>
        <LineChart data={recChartData} margin={{ top: showVRec ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={fmtK} {...axisProps} width={56} />
          <RcTooltip content={<ChartTip formatter={v => fmt(v)} />} />
          <Legend {...legendStyle} />
          <Line dataKey="Receita Bruta" type="monotone" stroke="rgba(16,185,129,1)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(16,185,129,1)' }} activeDot={{ r: 5 }}>
            {showVRec && <LabelList dataKey="Receita Bruta" position="top" formatter={lbl} style={{ fontSize: 13, fill: '#10b981' }} />}
          </Line>
          <Line dataKey="Tendência" type="monotone" stroke="rgba(59,130,246,.6)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
          {!recCF.isOverriding && drePrev && (
            <Line dataKey={`Receita Bruta ${compareYear}`} type="monotone" stroke="rgba(16,185,129,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  function renderDreChart(h) {
    const lbl = v => Math.abs(v) > 0.01 ? fmtK(v) : '';
    return (
      <ResponsiveContainer key={String(showVDre)} width="100%" height={h}>
        <ComposedChart data={dreChartData} margin={{ top: showVDre ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={fmtK} {...axisProps} width={56} />
          <RcTooltip content={<ChartTip formatter={v => fmt(v)} />} />
          <Legend {...legendStyle} />
          <Bar dataKey="Receita" fill="rgba(16,185,129,.7)" radius={[4, 4, 0, 0]}>
            {showVDre && <LabelList dataKey="Receita" position="top" formatter={lbl} style={{ fontSize: 13, fill: '#10b981' }} />}
          </Bar>
          <Bar dataKey="Custos+Desp" fill="rgba(239,68,68,.6)" radius={[4, 4, 0, 0]}>
            {showVDre && <LabelList dataKey="Custos+Desp" position="top" formatter={lbl} style={{ fontSize: 13, fill: '#ef4444' }} />}
          </Bar>
          <Line dataKey="Lucro Líq." type="monotone" stroke="rgba(139,92,246,.9)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(139,92,246,1)' }} activeDot={{ r: 5 }}>
            {showVDre && <LabelList dataKey="Lucro Líq." position="top" formatter={lbl} style={{ fontSize: 13, fill: 'rgba(139,92,246,.9)' }} />}
          </Line>
          {!dreChartCF.isOverriding && drePrev && (
            <>
              <Bar dataKey={`Receita ${compareYear}`} fill="rgba(16,185,129,.3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey={`Custos+Desp ${compareYear}`} fill="rgba(239,68,68,.3)" radius={[4, 4, 0, 0]} />
              <Line dataKey={`Lucro Líq. ${compareYear}`} type="monotone" stroke="rgba(139,92,246,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  function renderMgChart(h) {
    const lbl = v => v !== 0 ? v + '%' : '';
    return (
      <ResponsiveContainer key={String(showVMg)} width="100%" height={h}>
        <LineChart data={mgChartData} margin={{ top: showVMg ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={v => v + '%'} {...axisProps} width={40} />
          <RcTooltip content={<ChartTip formatter={v => v + '%'} />} />
          <Legend {...legendStyle} />
          <Line dataKey="Mg. Bruta %" type="monotone" stroke="rgba(16,185,129,1)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(16,185,129,1)' }} activeDot={{ r: 5 }}>
            {showVMg && <LabelList dataKey="Mg. Bruta %" position="top" formatter={lbl} style={{ fontSize: 13, fill: 'rgba(16,185,129,1)' }} />}
          </Line>
          <Line dataKey="Mg. Op. %" type="monotone" stroke="rgba(6,182,212,1)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(6,182,212,1)' }} activeDot={{ r: 5 }}>
            {showVMg && <LabelList dataKey="Mg. Op. %" position="top" formatter={lbl} style={{ fontSize: 13, fill: 'rgba(6,182,212,1)' }} />}
          </Line>
          <Line dataKey="Mg. Líq. %" type="monotone" stroke="rgba(139,92,246,1)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(139,92,246,1)' }} activeDot={{ r: 5 }}>
            {showVMg && <LabelList dataKey="Mg. Líq. %" position="top" formatter={lbl} style={{ fontSize: 13, fill: 'rgba(139,92,246,1)' }} />}
          </Line>
          {!mgChartCF.isOverriding && prevMbPct && (
            <>
              <Line dataKey={`Mg. Bruta ${compareYear}%`} type="monotone" stroke="rgba(16,185,129,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
              <Line dataKey={`Mg. Op. ${compareYear}%`} type="monotone" stroke="rgba(6,182,212,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
              <Line dataKey={`Mg. Líq. ${compareYear}%`} type="monotone" stroke="rgba(139,92,246,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  function openModal(title, element, opts) {
    setModalChart({ title, element, ...opts });
  }

  function exportDRE() {
    const rows = [['Descrição', ...visMonths.map(m => MONTHS[m]), 'Total']];
    dre.rows.forEach(row => {
      if (row.type === 'section') return;
      rows.push([row.label, ...row.monthValues.map(v => v.toFixed(2)), row.total.toFixed(2)]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `DRE_${filterState.year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
      {modalChart && <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />}

      <SubtabBar active={subTab} onChange={setSubTab} tabs={subtabs} />

      {subTab === 0 && subtabs.some(t => t.idx === 0) ? (
        <>
          {/* ── Cascade: DRE waterfall ── */}
          <div className="kpi-cascade mb-3.5">
            <CNode label="Receita Operacional" value={fmtK(dre.totRecOp)} rawValue={dre.totRecOp} sub={`${visMonths.length} mês(es)`} color="#10b981" cmp={cmpNode(drePrev?.totRecOp)} />
            {dre.totDeducao > 0 && <>
              <CSep symbol="−" />
              <CNode label="Deduções de Receita" value={fmtK(dre.totDeducao)} rawValue={dre.totDeducao} sub={fmtPct(pct(dre.totDeducao, dre.totRecLiq)) + ' da receita'} color="#fbbf24" cmp={cmpNode(drePrev?.totDeducao, false)} />
              <CSep symbol="=" />
              <CNode result label="Receita Líquida" value={fmtK(dre.totRecLiq)} rawValue={dre.totRecLiq} sub={fmtPct(pct(dre.totRecLiq, dre.totRecOp)) + ' da receita bruta'} color="#10b981" cmp={cmpNode(drePrev?.totRecLiq)} />
            </>}
            <CSep symbol="−" />
            <CNode label="Custos Diretos" value={fmtK(dre.totCost)} rawValue={dre.totCost} sub={fmtPct(pct(dre.totCost, dre.totRecLiq)) + ' da receita'} color="#ef4444" cmp={cmpNode(drePrev?.totCost, false)} />
            <CSep symbol="=" />
            <CNode result label="Margem Bruta" value={fmtK(dre.totMgB)} rawValue={dre.totMgB} sub={fmtPct(pct(dre.totMgB, dre.totRecLiq)) + ' de margem'} color={dre.totMgB >= 0 ? '#10b981' : '#ef4444'} cmp={cmpNode(drePrev?.totMgB)} />
            <CSep symbol="−" />
            <CNode label="Desp. Operacionais" value={fmtK(dre.totDespOp)} rawValue={dre.totDespOp} sub={fmtPct(pct(dre.totDespOp, dre.totRecLiq)) + ' da receita'} color="#f59e0b" cmp={cmpNode(drePrev?.totDespOp, false)} />
            <CSep symbol="=" />
            <CNode result label="Resultado Operacional (EBIT)" value={fmtK(dre.totMgOp)} rawValue={dre.totMgOp} sub={fmtPct(pct(dre.totMgOp, dre.totRecLiq)) + ' de margem op.'} color={dre.totMgOp >= 0 ? '#2563eb' : '#ef4444'} cmp={cmpNode(drePrev?.totMgOp)} />
            <CSep symbol="+" />
            <CNode label="Entradas Não Op." value={fmtK(dre.totEntNop)} rawValue={dre.totEntNop} sub={fmtPct(pct(dre.totEntNop, dre.totRecLiq)) + ' da receita'} color="#10b981" cmp={cmpNode(drePrev?.totEntNop)} />
            <CSep symbol="−" />
            <CNode label="Desp. Não Operacionais" value={fmtK(dre.totDespNop)} rawValue={dre.totDespNop} sub={fmtPct(pct(dre.totDespNop, dre.totRecLiq)) + ' da receita'} color="#8b5cf6" cmp={cmpNode(drePrev?.totDespNop, false)} />
            <CSep symbol="=" />
            <CNode result label="Lucro Líquido" value={fmtK(dre.totLL)} rawValue={dre.totLL} sub={fmtPct(pct(dre.totLL, dre.totRecLiq)) + ' de margem líquida'} color={dre.totLL >= 0 ? '#10b981' : '#ef4444'}
              delta={dre.mLL.length > 1 ? fmtPct(pct(dre.mLL[dre.mLL.length - 1] - dre.mLL[dre.mLL.length - 2], Math.abs(dre.mLL[dre.mLL.length - 2] || 1))) + ' vs mês ant.' : undefined}
              deltaDir={dre.mLL.length > 1 && dre.mLL[dre.mLL.length - 1] >= dre.mLL[dre.mLL.length - 2] ? 'up' : 'down'}
              cmp={cmpNode(drePrev?.totLL)}
            />
          </div>

          {/* ── Chart: evolução da receita bruta ── */}
          {canChart('competencia', 'receita') && (
            <div className="panel mb-3.5">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                    Evolução da Receita Bruta
                    <InfoPopover title="Evolução da Receita Bruta" description={'Receita operacional mês a mês (linha verde), com linha de tendência (azul tracejada) calculada por regressão linear sobre os meses visíveis.\n\nRegime Competência: reconhece a receita na data do fato gerador.'} />
                  </div>
                  <div className="text-[10px] text-text-3 mt-0.5">Receita bruta e linha de tendência</div>
                </div>
                <div className="flex items-center gap-2">
                  <ChartFilterPicker tx={tx} override={recCF.override} setOverride={recCF.setOverride} globalFilterState={filterState} />
                  <ValuesBtn show={showVRec} onToggle={() => setShowVRec(v => !v)} />
                  <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Evolução da Receita Bruta — Competência', renderRec('100%'))}>⤢ ampliar</span>
                  <MinimizeBtn collapsed={collapsedCharts.has('rec')} onToggle={() => toggleChartCollapse('rec')} />
                </div>
              </div>
              {!collapsedCharts.has('rec') && (
                <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderRec('100%')}</div>
              )}
            </div>
          )}

          {/* ── Chart: resultado mensal ── */}
          {canChart('competencia', 'dre_chart') && (
            <div className="panel mb-3.5">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                    Resultado Operacional — mês a mês
                    <InfoPopover title="Resultado Operacional — mês a mês" description={'Receita (verde) e Custos+Despesas totais (vermelho) por mês, mais linha de Lucro Líquido (roxo).\n\nRegime Competência: reconhece receitas e despesas na data do fato gerador.'} />
                  </div>
                  <div className="text-[10px] text-text-3 mt-0.5">Evolução mensal do resultado econômico</div>
                </div>
                <div className="flex items-center gap-2">
                  <ChartFilterPicker tx={tx} override={dreChartCF.override} setOverride={dreChartCF.setOverride} globalFilterState={filterState} />
                  <ValuesBtn show={showVDre} onToggle={() => setShowVDre(v => !v)} />
                  <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Resultado Operacional — Competência', renderDreChart('100%'))}>⤢ ampliar</span>
                  <MinimizeBtn collapsed={collapsedCharts.has('dre_chart')} onToggle={() => toggleChartCollapse('dre_chart')} />
                </div>
              </div>
              {!collapsedCharts.has('dre_chart') && (
                <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderDreChart('100%')}</div>
              )}
            </div>
          )}

          {/* ── Chart: evolução das margens ── */}
          {canChart('competencia', 'mg_chart') && (
            <div className="panel mb-3.5">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                    Evolução das Margens
                    <InfoPopover title="Evolução das Margens (%)" description={'Mg. Bruta % = (Receita − Custos) ÷ Receita\nMg. Op. % = (Mg. Bruta − Desp. Op.) ÷ Receita\nMg. Líq. % = Lucro Líquido ÷ Receita'} />
                  </div>
                  <div className="text-[10px] text-text-3 mt-0.5">Margem bruta, operacional e líquida %</div>
                </div>
                <div className="flex items-center gap-2">
                  <ChartFilterPicker tx={tx} override={mgChartCF.override} setOverride={mgChartCF.setOverride} globalFilterState={filterState} />
                  <ValuesBtn show={showVMg} onToggle={() => setShowVMg(v => !v)} />
                  <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Evolução das Margens', renderMgChart('100%'))}>⤢ ampliar</span>
                  <MinimizeBtn collapsed={collapsedCharts.has('mg_chart')} onToggle={() => toggleChartCollapse('mg_chart')} />
                </div>
              </div>
              {!collapsedCharts.has('mg_chart') && (
                <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderMgChart('100%')}</div>
              )}
            </div>
          )}

          {/* ── Composição das saídas ── */}
          {canChart('competencia', 'drill') && (
            <DrillChart
              transactions={drillCF.isOverriding ? drillCF.effectiveTx : filteredTx}
              visMonths={drillCF.isOverriding ? drillCF.effectiveVisMonths : visMonths}
              year={drillCF.effectiveYear}
              darkMode={darkMode}
              plano={plano}
              filterOverride={drillCF.override}
              onFilterOverride={drillCF.setOverride}
              globalFilterState={filterState}
              tx={tx}
            />
          )}
        </>
      ) : null}

      {subTab === 1 && subtabs.some(t => t.idx === 1) && (
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">DRE Gerencial — Demonstrativo Completo</div>
              <div className="text-[10px] text-text-3 mt-0.5">Clique para expandir/recolher · duplo clique para ver lançamentos</div>
            </div>
            <div className="flex gap-1.5 items-center">
              <label className="text-[11px] text-text-3 flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={showPct} onChange={e => setShowPct(e.target.checked)} />
                Mostrar %
              </label>
              <button className="btn btn-ghost btn-sm" onClick={exportDRE}>
                <Icon name="download" size="text-[14px]" /> Exportar
              </button>
              <span
                className="text-[9.5px] text-text-3 cursor-pointer"
                onClick={() => openModal('Demonstrativo — Competência', (
                  <DreTable dre={dre} showPct={showPct} regime="Competência"
                    onDrillItem={actions.goToLancamentos}
                    onDrillGroup={actions.goToLancamentos}
                    maxHeight="100%" />
                ), { wide: true })}
              >⤢ ampliar</span>
            </div>
          </div>
          <DreTable dre={dre} showPct={showPct} regime="Competência"
            onDrillItem={actions.goToLancamentos}
            onDrillGroup={actions.goToLancamentos} />
        </div>
      )}
    </motion.div>
  );
}
