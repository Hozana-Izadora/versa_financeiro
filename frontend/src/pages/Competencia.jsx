import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer } from '../lib/utils.js';
import {
  ComposedChart, LineChart, Bar, Line, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { buildDRE } from '../utils/dreBuilder.js';
import { MONTHS, fmt, fmtK, fmtPct, pct, getAvailableMonths } from '../utils/formatters.js';
import DreTable from '../components/dre/DreTable.jsx';
import Icon from '../components/ui/Icon.jsx';
import ChartModal from '../components/ui/ChartModal.jsx';
import DrillChart from '../components/ui/DrillChart.jsx';
import InfoPopover from '../components/ui/InfoPopover.jsx';
import ChartFilterPicker from '../components/ui/ChartFilterPicker.jsx';
import ValuesBtn from '../components/ui/ValuesBtn.jsx';
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

function CNode({ label, value, sub, color, result, first, last, delta, deltaDir }) {
  return (
    <div
      className={`kpi-card flex-1 min-w-0 ${result ? 'kpi-result' : ''}`}
      style={{ borderRadius: first ? '8px 0 0 8px' : last ? '0 8px 8px 0' : '0', borderRight: last ? undefined : 'none' }}
    >
      <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5">{label}</div>
      <div className="font-inter font-bold text-[20px] tracking-tight mb-0.5" style={{ color }}>{value}</div>
      <div className="text-[11px] text-text-3">{sub}</div>
      {delta && (
        <div className={`text-[10px] font-semibold mt-0.5 ${deltaDir === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
          {deltaDir === 'up' ? '▲' : '▼'} {delta}
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
  const [modalChart, setModalChart] = useState(null);
  const [showVDre, setShowVDre] = useState(false);
  const [showVMg,  setShowVMg]  = useState(false);

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
      (filterState.group === 'all' || r.grp === filterState.group);
  }), [tx, filterState]);

  const visMonths = useMemo(() => {
    if (filterState.months.size > 0) return [...filterState.months].sort((a, b) => a - b);
    const avail = getAvailableMonths(tx, filterState.year);
    return avail.length ? avail : [new Date().getMonth()];
  }, [tx, filterState]);

  const dre = useMemo(() =>
    buildDRE(filteredTx, plano, visMonths, 'competencia', filterState, saldosIniciais),
    [filteredTx, plano, visMonths, filterState, saldosIniciais]);

  // ── Per-chart filter hooks ────────────────────────────────────────
  const dreChartCF = useChartFilter(tx, filterState);
  const mgChartCF  = useChartFilter(tx, filterState);
  const drillCF    = useChartFilter(tx, filterState);

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
  const dreChartData = useMemo(() => {
    const vm = dreChartCF.isOverriding ? dreChartCF.effectiveVisMonths : visMonths;
    return vm.map((m, i) => ({
      month: MONTHS[m],
      Receita:       dreChartDre.mRec[i],
      'Custos+Desp': dreChartDre.mCost[i] + dreChartDre.mDespOp[i] + dreChartDre.mDespNop[i],
      'Lucro Líq.':  dreChartDre.mLL[i],
    }));
  }, [dreChartCF.isOverriding, dreChartCF.effectiveVisMonths, visMonths, dreChartDre]);

  const mbPct = useMemo(() =>
    mgChartDre.mMgB.map((v, i)  => mgChartDre.mRec[i] > 0 ? +(v / mgChartDre.mRec[i] * 100).toFixed(1) : 0),
    [mgChartDre]);

  const moPct = useMemo(() =>
    mgChartDre.mMgOp.map((v, i) => mgChartDre.mRec[i] > 0 ? +(v / mgChartDre.mRec[i] * 100).toFixed(1) : 0),
    [mgChartDre]);

  const llPct = useMemo(() =>
    mgChartDre.mLL.map((v, i)   => mgChartDre.mRec[i] > 0 ? +(v / mgChartDre.mRec[i] * 100).toFixed(1) : 0),
    [mgChartDre]);

  const mgChartData = useMemo(() => {
    const vm = mgChartCF.isOverriding ? mgChartCF.effectiveVisMonths : visMonths;
    return vm.map((m, i) => ({
      month: MONTHS[m],
      'Mg. Bruta %': mbPct[i],
      'Mg. Op. %':   moPct[i],
      'Mg. Líq. %':  llPct[i],
    }));
  }, [mgChartCF.isOverriding, mgChartCF.effectiveVisMonths, visMonths, mbPct, moPct, llPct]);

  // ── Chart renders ─────────────────────────────────────────────────
  function renderDreChart(h) {
    const lbl = v => Math.abs(v) > 0.01 ? fmtK(v) : '';
    return (
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={dreChartData} margin={{ top: showVDre ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={fmtK} {...axisProps} width={56} />
          <RcTooltip content={<ChartTip formatter={v => fmt(v)} />} />
          <Legend {...legendStyle} />
          <Bar dataKey="Receita" fill="rgba(16,185,129,.7)" radius={[4, 4, 0, 0]}>
            {showVDre && <LabelList dataKey="Receita" position="top" formatter={lbl} style={{ fontSize: 9, fill: '#10b981' }} />}
          </Bar>
          <Bar dataKey="Custos+Desp" fill="rgba(239,68,68,.6)" radius={[4, 4, 0, 0]}>
            {showVDre && <LabelList dataKey="Custos+Desp" position="top" formatter={lbl} style={{ fontSize: 9, fill: '#ef4444' }} />}
          </Bar>
          <Line dataKey="Lucro Líq." type="monotone" stroke="rgba(139,92,246,.9)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(139,92,246,1)' }} activeDot={{ r: 5 }}>
            {showVDre && <LabelList dataKey="Lucro Líq." position="top" formatter={lbl} style={{ fontSize: 9, fill: 'rgba(139,92,246,.9)' }} />}
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  function renderMgChart(h) {
    const lbl = v => v !== 0 ? v + '%' : '';
    return (
      <ResponsiveContainer width="100%" height={h}>
        <LineChart data={mgChartData} margin={{ top: showVMg ? 22 : 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={v => v + '%'} {...axisProps} width={40} />
          <RcTooltip content={<ChartTip formatter={v => v + '%'} />} />
          <Legend {...legendStyle} />
          <Line dataKey="Mg. Bruta %" type="monotone" stroke="rgba(16,185,129,1)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(16,185,129,1)' }} activeDot={{ r: 5 }}>
            {showVMg && <LabelList dataKey="Mg. Bruta %" position="top" formatter={lbl} style={{ fontSize: 9, fill: 'rgba(16,185,129,1)' }} />}
          </Line>
          <Line dataKey="Mg. Op. %" type="monotone" stroke="rgba(6,182,212,1)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(6,182,212,1)' }} activeDot={{ r: 5 }}>
            {showVMg && <LabelList dataKey="Mg. Op. %" position="top" formatter={lbl} style={{ fontSize: 9, fill: 'rgba(6,182,212,1)' }} />}
          </Line>
          <Line dataKey="Mg. Líq. %" type="monotone" stroke="rgba(139,92,246,1)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(139,92,246,1)' }} activeDot={{ r: 5 }}>
            {showVMg && <LabelList dataKey="Mg. Líq. %" position="top" formatter={lbl} style={{ fontSize: 9, fill: 'rgba(139,92,246,1)' }} />}
          </Line>
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
            <CNode first label="Receita Bruta" value={fmtK(dre.totRec)} sub={`${visMonths.length} mês(es)`} color="#10b981" />
            <CSep symbol="−" />
            <CNode label="Custos Diretos" value={fmtK(dre.totCost)} sub={fmtPct(pct(dre.totCost, dre.totRec)) + ' da receita'} color="#ef4444" />
            <CSep symbol="=" />
            <CNode result label="Margem Bruta" value={fmtK(dre.totMgB)} sub={fmtPct(pct(dre.totMgB, dre.totRec)) + ' de margem'} color={dre.totMgB >= 0 ? '#10b981' : '#ef4444'} />
            <CSep symbol="−" />
            <CNode label="Desp. Operacionais" value={fmtK(dre.totDespOp)} sub={fmtPct(pct(dre.totDespOp, dre.totRec)) + ' da receita'} color="#f59e0b" />
            <CSep symbol="=" />
            <CNode result label="EBIT" value={fmtK(dre.totMgOp)} sub={fmtPct(pct(dre.totMgOp, dre.totRec)) + ' de margem op.'} color={dre.totMgOp >= 0 ? '#2563eb' : '#ef4444'} />
            <CSep symbol="−" />
            <CNode label="Desp. Não Operacionais" value={fmtK(dre.totDespNop)} sub={fmtPct(pct(dre.totDespNop, dre.totRec)) + ' da receita'} color="#8b5cf6" />
            <CSep symbol="=" />
            <CNode last result label="Lucro Líquido" value={fmtK(dre.totLL)} sub={fmtPct(pct(dre.totLL, dre.totRec)) + ' de margem líquida'} color={dre.totLL >= 0 ? '#10b981' : '#ef4444'}
              delta={dre.mLL.length > 1 ? fmtPct(pct(dre.mLL[dre.mLL.length - 1] - dre.mLL[dre.mLL.length - 2], Math.abs(dre.mLL[dre.mLL.length - 2] || 1))) + ' vs mês ant.' : undefined}
              deltaDir={dre.mLL.length > 1 && dre.mLL[dre.mLL.length - 1] >= dre.mLL[dre.mLL.length - 2] ? 'up' : 'down'}
            />
          </div>

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
                </div>
              </div>
              <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderDreChart('100%')}</div>
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
                </div>
              </div>
              <div className="p-4 h-[200px] sm:h-[260px] lg:h-[300px]">{renderMgChart('100%')}</div>
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
              <div className="text-[10px] text-text-3 mt-0.5">Clique nos grupos para recolher · Clique nos itens para ver lançamentos</div>
            </div>
            <div className="flex gap-1.5 items-center">
              <label className="text-[11px] text-text-3 flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={showPct} onChange={e => setShowPct(e.target.checked)} />
                Mostrar %
              </label>
              <button className="btn btn-ghost btn-sm" onClick={exportDRE}>
                <Icon name="download" size="text-[14px]" /> Exportar
              </button>
            </div>
          </div>
          <DreTable dre={dre} showPct={showPct}
            onDrillItem={() => actions.setPage('lancamentos')}
            onDrillGroup={() => actions.setPage('lancamentos')} />
        </div>
      )}
    </motion.div>
  );
}
