import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer } from '../lib/utils.js';
import {
  ComposedChart, LineChart, Bar, Line, Area, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { buildDRE } from '../utils/dreBuilder.js';
import { MONTHS, fmt, fmtK, fmtPct, pct, getAvailableMonths, linearTrend } from '../utils/formatters.js';
import DreTable from '../components/dre/DreTable.jsx';
import Icon from '../components/ui/Icon.jsx';
import ChartModal from '../components/ui/ChartModal.jsx';
import DrillChart from '../components/ui/DrillChart.jsx';
import InfoPopover from '../components/ui/InfoPopover.jsx';
import ChartFilterPicker from '../components/ui/ChartFilterPicker.jsx';
import ValuesBtn from '../components/ui/ValuesBtn.jsx';
import { calcCicloSeries } from '../utils/cicloCalc.js';
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
      <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5">{label}</div>
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
        <button
          key={idx}
          onClick={() => onChange(idx)}
          className={`subtab-btn py-2.5 px-4 text-[11.5px] font-semibold cursor-pointer border-0 border-b-2 transition-all bg-transparent -mb-px ${
            active === idx ? 'act text-accent border-accent' : 'text-text-3 border-transparent hover:text-text-base'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Caixa() {
  const { state, actions } = useApp();
  const { transactions, plano, saldosIniciais, filterState, darkMode } = state;
  const { canChart, canSubtab } = usePermissions();
  const [showPct, setShowPct] = useState(true);
  const [subTab, setSubTab] = useState(0);

  const subtabs = [
    canSubtab('caixa', 'subtab_overview') && { idx: 0, label: 'Visão Geral' },
    canSubtab('caixa', 'subtab_dre')      && { idx: 1, label: 'Demonstrativo' },
  ].filter(Boolean);
  const [filterCat, setFilterCat] = useState('');
  const [modalChart, setModalChart] = useState(null);
  const [showVRec,   setShowVRec]   = useState(false);
  const [showVFlow,  setShowVFlow]  = useState(false);
  const [showVAcum,  setShowVAcum]  = useState(false);
  const [showVCiclo, setShowVCiclo] = useState(false);
  const [showVMarg,  setShowVMarg]  = useState(false);

  const tx     = transactions.caixa;
  const txComp = transactions.competencia;

  // ── Global filter (used by KPI cascade, DRE table) ───────────────
  const filteredTx = useMemo(() => tx.filter(r => {
    const d = new Date(r.data + 'T12:00');
    return d.getFullYear() === filterState.year &&
      (filterState.months.size === 0 || filterState.months.has(d.getMonth())) &&
      (filterState.group === 'all' || r.grp === filterState.group);
  }), [tx, filterState]);

  const visMonths = useMemo(() => {
    if (filterState.months.size > 0) return [...filterState.months].sort((a, b) => a - b);
    const avail = getAvailableMonths(tx, filterState.year);
    return avail.length ? avail : [new Date().getMonth()];
  }, [tx, filterState]);

  const dre = useMemo(() =>
    buildDRE(filteredTx, plano, visMonths, 'caixa', filterState, saldosIniciais),
    [filteredTx, plano, visMonths, filterState, saldosIniciais]);

  const filteredTxComp = useMemo(() => txComp.filter(r => {
    const d = new Date(r.data + 'T12:00');
    return d.getFullYear() === filterState.year &&
      (filterState.months.size === 0 || filterState.months.has(d.getMonth())) &&
      (filterState.group === 'all' || r.grp === filterState.group);
  }), [txComp, filterState]);

  const dreComp = useMemo(() =>
    buildDRE(filteredTxComp, plano, visMonths, 'competencia', filterState, saldosIniciais),
    [filteredTxComp, plano, visMonths, filterState, saldosIniciais]);

  // ── Comparison year (YoY) ─────────────────────────────────────────
  const { compareYear } = filterState;

  const filteredTxPrev = useMemo(() => {
    if (!compareYear) return null;
    return tx.filter(r => {
      const d = new Date(r.data + 'T12:00');
      return d.getFullYear() === compareYear &&
        (filterState.months.size === 0 || filterState.months.has(d.getMonth())) &&
        (filterState.group === 'all' || r.grp === filterState.group);
    });
  }, [tx, compareYear, filterState.months, filterState.group]);

  const drePrev = useMemo(() => {
    if (!filteredTxPrev) return null;
    return buildDRE(filteredTxPrev, plano, visMonths, 'caixa', { ...filterState, year: compareYear }, saldosIniciais);
  }, [filteredTxPrev, plano, visMonths, filterState, compareYear, saldosIniciais]);

  const filteredTxPrevComp = useMemo(() => {
    if (!compareYear) return null;
    return txComp.filter(r => {
      const d = new Date(r.data + 'T12:00');
      return d.getFullYear() === compareYear &&
        (filterState.months.size === 0 || filterState.months.has(d.getMonth())) &&
        (filterState.group === 'all' || r.grp === filterState.group);
    });
  }, [txComp, compareYear, filterState.months, filterState.group]);

  const drePrevComp = useMemo(() => {
    if (!filteredTxPrevComp) return null;
    return buildDRE(filteredTxPrevComp, plano, visMonths, 'competencia', { ...filterState, year: compareYear }, saldosIniciais);
  }, [filteredTxPrevComp, plano, visMonths, filterState, compareYear, saldosIniciais]);

  const prevSaldo = drePrev ? drePrev.mSaldo.reduce((a, b) => a + b, 0) : null;

  // Helper: build cmp prop for CNode
  const cmpNode = (prev, positiveIsGood = true) =>
    compareYear && drePrev && prev != null ? { prev, year: compareYear, positiveIsGood } : null;

  const catOptions = useMemo(() => [...new Set(plano.map(p => p.cat))].sort(), [plano]);
  const totSaldo = dre.mSaldo.reduce((a, b) => a + b, 0);

  // ── Per-chart filter hooks ────────────────────────────────────────
  const recCF   = useChartFilter(tx, filterState);
  const flowCF  = useChartFilter(tx, filterState);
  const acumCF  = useChartFilter(tx, filterState);
  const cicloCF = useChartFilter(tx, filterState);
  const margCF  = useChartFilter(tx, filterState);
  const drillCF = useChartFilter(tx, filterState);

  const recDre = useMemo(() =>
    recCF.isOverriding
      ? buildDRE(recCF.effectiveTx, plano, recCF.effectiveVisMonths, 'caixa', filterState, saldosIniciais)
      : dre,
    [recCF.isOverriding, recCF.effectiveTx, recCF.effectiveVisMonths, plano, filterState, saldosIniciais, dre]);

  const flowDre = useMemo(() =>
    flowCF.isOverriding
      ? buildDRE(flowCF.effectiveTx, plano, flowCF.effectiveVisMonths, 'caixa', filterState, saldosIniciais)
      : dre,
    [flowCF.isOverriding, flowCF.effectiveTx, flowCF.effectiveVisMonths, plano, filterState, saldosIniciais, dre]);

  const acumDre = useMemo(() =>
    acumCF.isOverriding
      ? buildDRE(acumCF.effectiveTx, plano, acumCF.effectiveVisMonths, 'caixa', filterState, saldosIniciais)
      : dre,
    [acumCF.isOverriding, acumCF.effectiveTx, acumCF.effectiveVisMonths, plano, filterState, saldosIniciais, dre]);

  const margDreCaixa = useMemo(() =>
    margCF.isOverriding
      ? buildDRE(margCF.effectiveTx, plano, margCF.effectiveVisMonths, 'caixa', filterState, saldosIniciais)
      : dre,
    [margCF.isOverriding, margCF.effectiveTx, margCF.effectiveVisMonths, plano, filterState, saldosIniciais, dre]);

  const margEffTxComp = useMemo(() => {
    if (!margCF.isOverriding) return filteredTxComp;
    const y  = margCF.effectiveYear;
    const ms = margCF.override.months;
    return txComp.filter(r => {
      const d = new Date(r.data + 'T12:00');
      return d.getFullYear() === y &&
        (ms.size === 0 || ms.has(d.getMonth())) &&
        (filterState.group === 'all' || r.grp === filterState.group);
    });
  }, [margCF.isOverriding, margCF.effectiveYear, margCF.override, txComp, filteredTxComp, filterState.group]);

  const margDreComp = useMemo(() =>
    margCF.isOverriding
      ? buildDRE(margEffTxComp, plano, margCF.effectiveVisMonths, 'competencia', filterState, saldosIniciais)
      : dreComp,
    [margCF.isOverriding, margEffTxComp, margCF.effectiveVisMonths, plano, filterState, saldosIniciais, dreComp]);

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

  const flowChartData = useMemo(() => {
    const isOvr = flowCF.isOverriding;
    const vm = isOvr ? flowCF.effectiveVisMonths : visMonths;
    return vm.map((m, i) => ({
      month: MONTHS[m],
      Entradas: flowDre.mRec[i],
      'Saídas': flowDre.mCost[i] + flowDre.mDespOp[i] + flowDre.mDespNop[i],
      Saldo: flowDre.mSaldo[i],
      ...(!isOvr && drePrev ? {
        [`Entradas ${compareYear}`]: drePrev.mRec[i] ?? 0,
        [`Saídas ${compareYear}`]:   (drePrev.mCost[i] ?? 0) + (drePrev.mDespOp[i] ?? 0) + (drePrev.mDespNop[i] ?? 0),
        [`Saldo ${compareYear}`]:    drePrev.mSaldo[i] ?? 0,
      } : {}),
    }));
  }, [flowCF.isOverriding, flowCF.effectiveVisMonths, visMonths, flowDre, compareYear, drePrev]);

  const acumChartData = useMemo(() => {
    const isOvr = acumCF.isOverriding;
    const vm  = isOvr ? acumCF.effectiveVisMonths : visMonths;
    const arr = acumDre.mAcum;
    const a = arr[0] || 0, b = arr[arr.length - 1] || 0, n = arr.length;
    const tend = arr.map((_, i) => n > 1 ? +(a + (b - a) / (n - 1) * i).toFixed(0) : a);
    return vm.map((m, i) => ({
      month: MONTHS[m],
      Acumulado: arr[i],
      Tendência: tend[i],
      ...(!isOvr && drePrev ? { [`Acum. ${compareYear}`]: drePrev.mAcum[i] ?? 0 } : {}),
    }));
  }, [acumCF.isOverriding, acumCF.effectiveVisMonths, visMonths, acumDre, compareYear, drePrev]);

  const cicloSeries = useMemo(
    () => calcCicloSeries(tx, cicloCF.effectiveYear, cicloCF.effectiveVisMonths),
    [tx, cicloCF.effectiveYear, cicloCF.effectiveVisMonths]);

  const cicloSeriesPrev = useMemo(() => {
    if (!compareYear || cicloCF.isOverriding) return null;
    return calcCicloSeries(tx, compareYear, visMonths);
  }, [tx, compareYear, visMonths, cicloCF.isOverriding]);

  const cicloChartData = useMemo(() =>
    cicloCF.effectiveVisMonths.map((m, i) => ({
      month: MONTHS[m],
      'PMR — Recebimento': cicloSeries[i]?.pmr  ?? 0,
      'PMP — Pagamento':   cicloSeries[i]?.pmp  ?? 0,
      'Ciclo Financeiro':  cicloSeries[i]?.ciclo ?? 0,
      ...(cicloSeriesPrev ? {
        [`PMR ${compareYear}`]:   cicloSeriesPrev[i]?.pmr  ?? 0,
        [`PMP ${compareYear}`]:   cicloSeriesPrev[i]?.pmp  ?? 0,
        [`Ciclo ${compareYear}`]: cicloSeriesPrev[i]?.ciclo ?? 0,
      } : {}),
    })),
    [cicloCF.effectiveVisMonths, cicloSeries, cicloSeriesPrev, compareYear]);

  const moCaixaPct = useMemo(() =>
    margDreCaixa.mMgOp.map((v, i) => margDreCaixa.mRecOp[i] > 0 ? +(v / margDreCaixa.mRecOp[i] * 100).toFixed(1) : 0),
    [margDreCaixa]);

  const moCompPct = useMemo(() =>
    margDreComp.mMgOp.map((v, i) => margDreComp.mRecOp[i] > 0 ? +(v / margDreComp.mRecOp[i] * 100).toFixed(1) : 0),
    [margDreComp]);

  const margCompChartData = useMemo(() => {
    const isOvr = margCF.isOverriding;
    const vm = isOvr ? margCF.effectiveVisMonths : visMonths;
    return vm.map((m, i) => ({
      month: MONTHS[m],
      'Mg. Op. Caixa':       moCaixaPct[i],
      'Mg. Op. Competência': moCompPct[i],
      ...(!isOvr && drePrev && drePrevComp ? {
        [`Mg. Caixa ${compareYear}`]: drePrev.mRecOp[i] > 0
          ? +(drePrev.mMgOp[i] / drePrev.mRecOp[i] * 100).toFixed(1) : 0,
        [`Mg. Comp. ${compareYear}`]: drePrevComp.mRecOp[i] > 0
          ? +(drePrevComp.mMgOp[i] / drePrevComp.mRecOp[i] * 100).toFixed(1) : 0,
      } : {}),
    }));
  }, [margCF.isOverriding, margCF.effectiveVisMonths, visMonths, moCaixaPct, moCompPct, compareYear, drePrev, drePrevComp]);

  // ── Chart renders ─────────────────────────────────────────────────
  function renderRec(h) {
    const lbl = v => Math.abs(v) > 0.01 ? fmtK(v) : '';
    return (
      <ResponsiveContainer width="100%" height={h}>
        <LineChart data={recChartData} margin={{ top: showVRec ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={fmtK} {...axisProps} width={56} />
          <RcTooltip content={<ChartTip formatter={v => fmt(v)} />} />
          <Legend {...legendStyle} />
          <Line dataKey="Receita Bruta" type="monotone" stroke="rgba(16,185,129,1)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(16,185,129,1)' }} activeDot={{ r: 5 }}>
            {showVRec && <LabelList dataKey="Receita Bruta" position="top" formatter={lbl} style={{ fontSize: 11, fill: '#10b981' }} />}
          </Line>
          <Line dataKey="Tendência" type="monotone" stroke="rgba(59,130,246,.6)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
          {!recCF.isOverriding && drePrev && (
            <Line dataKey={`Receita Bruta ${compareYear}`} type="monotone" stroke="rgba(16,185,129,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  function renderFlow(h) {
    const lbl = v => Math.abs(v) > 0.01 ? fmtK(v) : '';
    return (
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={flowChartData} margin={{ top: showVFlow ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={fmtK} {...axisProps} width={56} />
          <RcTooltip content={<ChartTip formatter={v => fmt(v)} />} />
          <Legend {...legendStyle} />
          <Bar dataKey="Entradas" fill="rgba(16,185,129,.7)" radius={[4, 4, 0, 0]}>
            {showVFlow && <LabelList dataKey="Entradas" position="top" formatter={lbl} style={{ fontSize: 11, fill: '#10b981' }} />}
          </Bar>
          <Bar dataKey="Saídas" fill="rgba(239,68,68,.7)" radius={[4, 4, 0, 0]}>
            {showVFlow && <LabelList dataKey="Saídas" position="top" formatter={lbl} style={{ fontSize: 11, fill: '#ef4444' }} />}
          </Bar>
          <Line dataKey="Saldo" type="monotone" stroke="rgba(59,130,246,.9)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(59,130,246,1)' }} activeDot={{ r: 5 }}>
            {showVFlow && <LabelList dataKey="Saldo" position="top" formatter={lbl} style={{ fontSize: 11, fill: 'rgba(59,130,246,.9)' }} />}
          </Line>
          {!flowCF.isOverriding && drePrev && (
            <>
              <Bar dataKey={`Entradas ${compareYear}`} fill="rgba(16,185,129,.3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey={`Saídas ${compareYear}`} fill="rgba(239,68,68,.3)" radius={[4, 4, 0, 0]} />
              <Line dataKey={`Saldo ${compareYear}`} type="monotone" stroke="rgba(59,130,246,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  function renderAcum(h) {
    const lbl = v => Math.abs(v) > 0.01 ? fmtK(v) : '';
    return (
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={acumChartData} margin={{ top: showVAcum ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={fmtK} {...axisProps} width={56} />
          <RcTooltip content={<ChartTip formatter={v => fmt(v)} />} />
          <Legend {...legendStyle} />
          <Area dataKey="Acumulado" type="monotone" stroke="rgba(16,185,129,1)" fill="rgba(16,185,129,.12)" strokeWidth={2} dot={{ r: 5, fill: 'rgba(16,185,129,1)' }}>
            {showVAcum && <LabelList dataKey="Acumulado" position="top" formatter={lbl} style={{ fontSize: 11, fill: '#10b981' }} />}
          </Area>
          <Line dataKey="Tendência" type="monotone" stroke="rgba(59,130,246,.6)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
          {!acumCF.isOverriding && drePrev && (
            <Line dataKey={`Acum. ${compareYear}`} type="monotone" stroke="rgba(16,185,129,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  function renderCiclo(h) {
    const lbl = v => v > 0 ? `${Math.round(v)}d` : '';
    return (
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={cicloChartData} margin={{ top: showVCiclo ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} width={36} />
          <RcTooltip content={<ChartTip formatter={v => v != null ? `${v} dias` : 'N/A'} />} />
          <Legend {...legendStyle} />
          <Bar dataKey="PMR — Recebimento" fill="rgba(109,191,69,.7)" radius={[4, 4, 0, 0]}>
            {showVCiclo && <LabelList dataKey="PMR — Recebimento" position="top" formatter={lbl} style={{ fontSize: 11, fill: 'rgba(109,191,69,1)' }} />}
          </Bar>
          <Bar dataKey="PMP — Pagamento" fill="rgba(43,108,176,.7)" radius={[4, 4, 0, 0]}>
            {showVCiclo && <LabelList dataKey="PMP — Pagamento" position="top" formatter={lbl} style={{ fontSize: 11, fill: 'rgba(43,108,176,1)' }} />}
          </Bar>
          <Line dataKey="Ciclo Financeiro" type="monotone" stroke="#E53E3E" strokeWidth={2.5} dot={{ r: 4, fill: '#E53E3E' }} activeDot={{ r: 5 }}>
            {showVCiclo && <LabelList dataKey="Ciclo Financeiro" position="top" formatter={lbl} style={{ fontSize: 11, fill: '#E53E3E' }} />}
          </Line>
          {cicloSeriesPrev && (
            <>
              <Line dataKey={`PMR ${compareYear}`} type="monotone" stroke="rgba(109,191,69,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
              <Line dataKey={`PMP ${compareYear}`} type="monotone" stroke="rgba(43,108,176,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
              <Line dataKey={`Ciclo ${compareYear}`} type="monotone" stroke="rgba(229,62,62,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  function renderMargComp(h) {
    const lbl = v => v !== 0 ? v + '%' : '';
    return (
      <ResponsiveContainer width="100%" height={h}>
        <LineChart data={margCompChartData} margin={{ top: showVMarg ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={v => v + '%'} {...axisProps} width={40} />
          <RcTooltip content={<ChartTip formatter={v => v + '%'} />} />
          <Legend {...legendStyle} />
          <Line dataKey="Mg. Op. Caixa" type="monotone" stroke="#6DBF45" strokeWidth={2.5} dot={{ r: 4, fill: '#6DBF45' }} activeDot={{ r: 5 }}>
            {showVMarg && <LabelList dataKey="Mg. Op. Caixa" position="top" formatter={lbl} style={{ fontSize: 11, fill: '#6DBF45' }} />}
          </Line>
          <Line dataKey="Mg. Op. Competência" type="monotone" stroke="#2B6CB0" strokeWidth={2.5} dot={{ r: 4, fill: '#2B6CB0' }} activeDot={{ r: 5 }}>
            {showVMarg && <LabelList dataKey="Mg. Op. Competência" position="top" formatter={lbl} style={{ fontSize: 11, fill: '#2B6CB0' }} />}
          </Line>
          {!margCF.isOverriding && drePrev && drePrevComp && (
            <>
              <Line dataKey={`Mg. Caixa ${compareYear}`} type="monotone" stroke="rgba(109,191,69,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
              <Line dataKey={`Mg. Comp. ${compareYear}`} type="monotone" stroke="rgba(43,108,176,.4)" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  function openModal(title, element) {
    setModalChart({ title, element });
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
    const a = document.createElement('a'); a.href = url; a.download = `Caixa_${filterState.year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
      {modalChart && <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />}

      <SubtabBar active={subTab} onChange={setSubTab} tabs={subtabs} />

      {subTab === 0 && subtabs.some(t => t.idx === 0) ? (
        <>
          {/* ── Cascade ── */}
          <div className="kpi-cascade mb-3.5">
            <CNode label="Entrada Operacional" value={fmtK(dre.totRecOp)} rawValue={dre.totRecOp} sub={`${visMonths.length} mês(es)`} color="#10b981" cmp={cmpNode(drePrev?.totRecOp)} />
            <CSep symbol="−" />
            <CNode label="Custos Diretos" value={fmtK(dre.totCost)} rawValue={dre.totCost} sub={fmtPct(pct(dre.totCost, dre.totRecOp)) + ' da receita'} color="#ef4444" cmp={cmpNode(drePrev?.totCost, false)} />
            <CSep symbol="−" />
            <CNode label="Desp. Operacionais" value={fmtK(dre.totDespOp)} rawValue={dre.totDespOp} sub={fmtPct(pct(dre.totDespOp, dre.totRecOp)) + ' da receita'} color="#f59e0b" cmp={cmpNode(drePrev?.totDespOp, false)} />
            <CSep symbol="=" />
            <CNode result label="Caixa Operacional" value={fmtK(dre.totMgOp)} rawValue={dre.totMgOp} sub={fmtPct(pct(dre.totMgOp, dre.totRecOp)) + ' de margem'} color={dre.totMgOp >= 0 ? '#2563eb' : '#ef4444'} cmp={cmpNode(drePrev?.totMgOp)} />
            <CSep symbol="+" />
            <CNode label="Entradas Não Op." value={fmtK(dre.totEntNop)} rawValue={dre.totEntNop} sub={fmtPct(pct(dre.totEntNop, dre.totRecOp)) + ' da receita'} color="#10b981" cmp={cmpNode(drePrev?.totEntNop)} />
            <CSep symbol="−" />
            <CNode label="Saídas Não Op." value={fmtK(dre.totDespNop)} rawValue={dre.totDespNop} sub={fmtPct(pct(dre.totDespNop, dre.totRecOp)) + ' da receita'} color="#8b5cf6" cmp={cmpNode(drePrev?.totDespNop, false)} />
            <CSep symbol="=" />
            <CNode result label="Saldo do Período" value={fmtK(totSaldo)} rawValue={totSaldo} sub={totSaldo >= 0 ? 'Resultado positivo' : 'Resultado negativo'} color={totSaldo >= 0 ? '#10b981' : '#ef4444'}
              delta={dre.mSaldo.length > 1 ? fmtPct(pct(dre.mSaldo[dre.mSaldo.length - 1] - dre.mSaldo[dre.mSaldo.length - 2], Math.abs(dre.mSaldo[dre.mSaldo.length - 2] || 1))) + ' vs mês ant.' : undefined}
              deltaDir={dre.mSaldo.length > 1 && dre.mSaldo[dre.mSaldo.length - 1] >= dre.mSaldo[dre.mSaldo.length - 2] ? 'up' : 'down'}
              cmp={prevSaldo != null ? { prev: prevSaldo, year: compareYear, positiveIsGood: true } : null}
            />
          </div>

          {/* ── Chart: evolução da receita bruta ── */}
          {canChart('caixa', 'receita') && (
            <div className="panel mb-3.5">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                    Evolução da Receita Bruta
                    <InfoPopover title="Evolução da Receita Bruta" description={'Receita operacional mês a mês (linha verde), com linha de tendência (azul tracejada) calculada por regressão linear sobre os meses visíveis.\n\nRegime Caixa: considera a data efetiva do recebimento.'} />
                  </div>
                  <div className="text-[10px] text-text-3 mt-0.5">Receita bruta e linha de tendência</div>
                </div>
                <div className="flex items-center gap-2">
                  <ChartFilterPicker tx={tx} override={recCF.override} setOverride={recCF.setOverride} globalFilterState={filterState} />
                  <ValuesBtn show={showVRec} onToggle={() => setShowVRec(v => !v)} />
                  <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Evolução da Receita Bruta — Caixa', renderRec('100%'))}>⤢ ampliar</span>
                </div>
              </div>
              <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderRec('100%')}</div>
            </div>
          )}

          {/* ── Chart: resultado líquido ── */}
          {canChart('caixa', 'flow') && (
            <div className="panel mb-3.5">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                    Resultado Líquido — mês a mês
                    <InfoPopover title="Resultado Líquido — mês a mês" description={'Barras com Entradas (verde) e Saídas totais (vermelho) por mês, mais linha de Saldo Líquido (azul).\n\nRegime Caixa: considera a data efetiva do movimento financeiro.'} />
                  </div>
                  <div className="text-[10px] text-text-3 mt-0.5">Entradas, saídas e saldo líquido</div>
                </div>
                <div className="flex items-center gap-2">
                  <ChartFilterPicker tx={tx} override={flowCF.override} setOverride={flowCF.setOverride} globalFilterState={filterState} />
                  <ValuesBtn show={showVFlow} onToggle={() => setShowVFlow(v => !v)} />
                  <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Resultado Líquido — Caixa', renderFlow('100%'))}>⤢ ampliar</span>
                </div>
              </div>
              <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderFlow('100%')}</div>
            </div>
          )}

          {/* ── Chart: saldo acumulado ── */}
          {canChart('caixa', 'acum') && (
            <div className="panel mb-3.5">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                    Saldo Acumulado
                    <InfoPopover title="Saldo Acumulado" description={'Linha verde: posição de caixa acumulada mês a mês.\nLinha tracejada azul: tendência linear entre o primeiro e o último ponto visível.'} />
                  </div>
                  <div className="text-[10px] text-text-3 mt-0.5">Evolução com linha de tendência</div>
                </div>
                <div className="flex items-center gap-2">
                  <ChartFilterPicker tx={tx} override={acumCF.override} setOverride={acumCF.setOverride} globalFilterState={filterState} />
                  <ValuesBtn show={showVAcum} onToggle={() => setShowVAcum(v => !v)} />
                  <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Saldo Acumulado', renderAcum('100%'))}>⤢ ampliar</span>
                </div>
              </div>
              <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderAcum('100%')}</div>
            </div>
          )}

          {/* ── Chart: ciclo financeiro ── */}
          {canChart('caixa', 'ciclo') && (
            <div className="panel mb-3.5">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                    Ciclo Financeiro — PMR e PMP
                    <InfoPopover title="Ciclo Financeiro" description={'PMR: prazo médio (em dias) entre a Data de Emissão e a Data de Vencimento das receitas operacionais — quanto tempo, em média, até receber.\nPMP: mesmo cálculo, só para os Custos Diretos (custo de fornecedor/compras) — quanto tempo, em média, até pagar.\n\nMédia ponderada pelo valor de cada lançamento. Só entram lançamentos com Data de Emissão e Vencimento preenchidas.\n\nCiclo = PMR − PMP\nPositivo → recebe depois de precisar pagar (precisa de capital de giro).\nNegativo → recebe antes de precisar pagar os fornecedores.'} />
                  </div>
                  <div className="text-[10px] text-text-3 mt-0.5">Prazos médios de recebimento e pagamento</div>
                </div>
                <div className="flex items-center gap-2">
                  <ChartFilterPicker tx={tx} override={cicloCF.override} setOverride={cicloCF.setOverride} globalFilterState={filterState} />
                  <ValuesBtn show={showVCiclo} onToggle={() => setShowVCiclo(v => !v)} />
                  <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Ciclo Financeiro', renderCiclo('100%'))}>⤢ ampliar</span>
                </div>
              </div>
              <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderCiclo('100%')}</div>
            </div>
          )}

          {/* ── Chart: margem comparação ── */}
          {canChart('caixa', 'marg') && (
            <div className="panel mb-3.5">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                    Margem Operacional — Caixa vs Competência
                    <InfoPopover title="Margem Operacional — Caixa vs Competência" description={'Compara a Margem Operacional (%) nos dois regimes.\nDivergências indicam diferenças de timing entre o econômico e o financeiro.'} />
                  </div>
                  <div className="text-[10px] text-text-3 mt-0.5">Comparativo dos dois regimes</div>
                </div>
                <div className="flex items-center gap-2">
                  <ChartFilterPicker tx={tx} override={margCF.override} setOverride={margCF.setOverride} globalFilterState={filterState} />
                  <ValuesBtn show={showVMarg} onToggle={() => setShowVMarg(v => !v)} />
                  <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Margem Operacional — Caixa vs Competência', renderMargComp('100%'))}>⤢ ampliar</span>
                </div>
              </div>
              <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderMargComp('100%')}</div>
            </div>
          )}

          {/* ── Composição das saídas ── */}
          {canChart('caixa', 'drill') && (
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

      {subTab === 1 && (
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Demonstrativo do Fluxo de Caixa Estruturado (DFCE)</div>
              <div className="text-[10px] text-text-3 mt-0.5">Clique nos grupos para recolher · Clique nos itens para ver lançamentos</div>
            </div>
            <div className="flex gap-2 items-center flex-wrap justify-end">
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="text-[11px] border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ minWidth: 160 }}>
                <option value="">Todas as categorias</option>
                {catOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <label className="text-[11px] text-text-3 flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={showPct} onChange={e => setShowPct(e.target.checked)} />
                Mostrar %
              </label>
              <button className="btn btn-ghost btn-sm" onClick={exportDRE}>
                <Icon name="download" size="text-[14px]" /> Exportar
              </button>
            </div>
          </div>
          <DreTable dre={dre} showPct={showPct} filterCat={filterCat || null}
            onDrillItem={() => actions.setPage('lancamentos')}
            onDrillGroup={() => actions.setPage('lancamentos')} />
        </div>
      )}
    </motion.div>
  );
}
