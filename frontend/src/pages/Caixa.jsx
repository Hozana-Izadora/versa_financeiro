import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer } from '../lib/utils.js';
import {
  ComposedChart, LineChart, Bar, Line, Area,
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
import { calcCicloSeries } from '../utils/cicloCalc.js';

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
      style={{
        borderRadius: first ? '8px 0 0 8px' : last ? '0 8px 8px 0' : '0',
        borderRight: last ? undefined : 'none',
      }}
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

function SubtabBar({ active, onChange }) {
  return (
    <div className="subtab-bar flex bg-bg-2 border-b border-slate-100 px-4 lg:px-7 mb-4 -mx-4 lg:-mx-7 -mt-6">
      {['Visão Geral', 'Demonstrativo'].map((label, i) => (
        <button
          key={label}
          onClick={() => onChange(i)}
          className={`subtab-btn py-2.5 px-4 text-[11.5px] font-semibold cursor-pointer border-0 border-b-2 transition-all bg-transparent -mb-px ${
            active === i ? 'act text-accent border-accent' : 'text-text-3 border-transparent hover:text-text-base'
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
  const [showPct, setShowPct] = useState(true);
  const [subTab, setSubTab] = useState(0);
  const [filterCat, setFilterCat] = useState('');
  const [modalChart, setModalChart] = useState(null);

  const tx = transactions.caixa;
  const txComp = transactions.competencia;

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

  const dre = useMemo(() => buildDRE(filteredTx, plano, visMonths, 'caixa', filterState, saldosIniciais),
    [filteredTx, plano, visMonths, filterState, saldosIniciais]);

  const filteredTxComp = useMemo(() => txComp.filter(r => {
    const d = new Date(r.data + 'T12:00');
    return d.getFullYear() === filterState.year &&
      (filterState.months.size === 0 || filterState.months.has(d.getMonth())) &&
      (filterState.group === 'all' || r.grp === filterState.group);
  }), [txComp, filterState]);

  const dreComp = useMemo(() => buildDRE(filteredTxComp, plano, visMonths, 'competencia', filterState, saldosIniciais),
    [filteredTxComp, plano, visMonths, filterState, saldosIniciais]);

  const catOptions = useMemo(() => [...new Set(plano.map(p => p.cat))].sort(), [plano]);

  const labels = visMonths.map(m => MONTHS[m]);
  const totSaldo = dre.mSaldo.reduce((a, b) => a + b, 0);

  const gc = darkMode ? '#1e2d42' : 'rgba(0,0,0,0.06)';
  const tc = darkMode ? '#8aa3be' : '#94a3b8';
  const axisProps = { tick: { fill: tc, fontSize: 11 }, axisLine: false, tickLine: false };
  const gridProps = { strokeDasharray: '3 3', stroke: gc, vertical: false };
  const legendStyle = { wrapperStyle: { fontSize: 11, color: tc } };

  // ── Chart data ───────────────────────────────────────────────────
  const flowChartData = useMemo(() => labels.map((month, i) => ({
    month,
    Entradas: dre.mRec[i],
    'Saídas': dre.mCost[i] + dre.mDespOp[i] + dre.mDespNop[i],
    Saldo: dre.mSaldo[i],
  })), [labels, dre]);

  const acumTend = useMemo(() => {
    const a = dre.mAcum[0] || 0, b = dre.mAcum[dre.mAcum.length - 1] || 0, n = dre.mAcum.length;
    return dre.mAcum.map((_, i) => n > 1 ? +(a + (b - a) / (n - 1) * i).toFixed(0) : a);
  }, [dre.mAcum]);

  const acumChartData = useMemo(() => labels.map((month, i) => ({
    month, Acumulado: dre.mAcum[i], 'Tendência': acumTend[i],
  })), [labels, dre.mAcum, acumTend]);

  const cicloSeries = useMemo(
    () => calcCicloSeries(tx, filterState.year, visMonths),
    [tx, filterState.year, visMonths]
  );

  const cicloChartData = useMemo(() => labels.map((month, i) => ({
    month,
    'PMR — Recebimento': cicloSeries[i]?.pmr ?? 0,
    'PMP — Pagamento':   cicloSeries[i]?.pmp ?? 0,
    'Ciclo de Caixa':    cicloSeries[i]?.ciclo ?? 0,
  })), [labels, cicloSeries]);

  const moCaixaPct = useMemo(() => dre.mMgOp.map((v, i) => dre.mRec[i] > 0 ? +(v / dre.mRec[i] * 100).toFixed(1) : 0), [dre]);
  const moCompPct  = useMemo(() => dreComp.mMgOp.map((v, i) => dreComp.mRec[i] > 0 ? +(v / dreComp.mRec[i] * 100).toFixed(1) : 0), [dreComp]);

  const margCompChartData = useMemo(() => labels.map((month, i) => ({
    month, 'Mg. Op. Caixa': moCaixaPct[i], 'Mg. Op. Competência': moCompPct[i],
  })), [labels, moCaixaPct, moCompPct]);

  // ── Chart renders ────────────────────────────────────────────────
  function renderFlow(h) {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={flowChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={fmtK} {...axisProps} width={56} />
          <RcTooltip content={<ChartTip formatter={v => fmt(v)} />} />
          <Legend {...legendStyle} />
          <Bar dataKey="Entradas" fill="rgba(16,185,129,.7)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Saídas" fill="rgba(239,68,68,.7)" radius={[4, 4, 0, 0]} />
          <Line dataKey="Saldo" type="monotone" stroke="rgba(59,130,246,.9)" strokeWidth={2} dot={{ r: 4, fill: 'rgba(59,130,246,1)' }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  function renderAcum(h) {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={acumChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={fmtK} {...axisProps} width={56} />
          <RcTooltip content={<ChartTip formatter={v => fmt(v)} />} />
          <Legend {...legendStyle} />
          <Area dataKey="Acumulado" type="monotone" stroke="rgba(16,185,129,1)" fill="rgba(16,185,129,.12)" strokeWidth={2} dot={{ r: 5, fill: 'rgba(16,185,129,1)' }} />
          <Line dataKey="Tendência" type="monotone" stroke="rgba(59,130,246,.6)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  function renderCiclo(h) {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={cicloChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} width={36} />
          <RcTooltip content={<ChartTip formatter={v => `dia ${v ?? 'N/A'}`} />} />
          <Legend {...legendStyle} />
          <Bar dataKey="PMR — Recebimento" fill="rgba(109,191,69,.7)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="PMP — Pagamento"   fill="rgba(43,108,176,.7)"  radius={[4, 4, 0, 0]} />
          <Line dataKey="Ciclo de Caixa" type="monotone" stroke="#E53E3E" strokeWidth={2.5} dot={{ r: 4, fill: '#E53E3E' }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  function renderMargComp(h) {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <LineChart data={margCompChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={v => v + '%'} {...axisProps} width={40} />
          <RcTooltip content={<ChartTip formatter={v => v + '%'} />} />
          <Legend {...legendStyle} />
          <Line dataKey="Mg. Op. Caixa"       type="monotone" stroke="#6DBF45" strokeWidth={2.5} dot={{ r: 4, fill: '#6DBF45' }} activeDot={{ r: 5 }} />
          <Line dataKey="Mg. Op. Competência" type="monotone" stroke="#2B6CB0" strokeWidth={2.5} dot={{ r: 4, fill: '#2B6CB0' }} activeDot={{ r: 5 }} />
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

      <SubtabBar active={subTab} onChange={setSubTab} />

      {subTab === 0 ? (
        <>
          {/* ── Cascade: fluxo completo numa única linha ── */}
          <div className="kpi-cascade mb-3.5">
            <CNode first label="Entradas / Receita" value={fmtK(dre.totRec)} sub={`${visMonths.length} mês(es)`} color="#10b981" />
            <CSep symbol="−" />
            <CNode label="Custos Diretos" value={fmtK(dre.totCost)} sub={fmtPct(pct(dre.totCost, dre.totRec)) + ' da receita'} color="#ef4444" />
            <CSep symbol="−" />
            <CNode label="Desp. Operacionais" value={fmtK(dre.totDespOp)} sub={fmtPct(pct(dre.totDespOp, dre.totRec)) + ' da receita'} color="#f59e0b" />
            <CSep symbol="=" />
            <CNode result label="Caixa Operacional" value={fmtK(dre.totMgOp)} sub={fmtPct(pct(dre.totMgOp, dre.totRec)) + ' de margem'} color={dre.totMgOp >= 0 ? '#2563eb' : '#ef4444'} />
            <CSep symbol="+" />
            <CNode label="Entradas Não Op." value={fmtK(dre.totEntNop)} sub={fmtPct(pct(dre.totEntNop, dre.totRec)) + ' da receita'} color="#10b981" />
            <CSep symbol="−" />
            <CNode label="Saídas Não Op." value={fmtK(dre.totDespNop)} sub={fmtPct(pct(dre.totDespNop, dre.totRec)) + ' da receita'} color="#8b5cf6" />
            <CSep symbol="=" />
            <CNode last result label="Saldo do Período" value={fmtK(totSaldo)} sub={totSaldo >= 0 ? 'Resultado positivo' : 'Resultado negativo'} color={totSaldo >= 0 ? '#10b981' : '#ef4444'}
              delta={dre.mSaldo.length > 1 ? fmtPct(pct(dre.mSaldo[dre.mSaldo.length - 1] - dre.mSaldo[dre.mSaldo.length - 2], Math.abs(dre.mSaldo[dre.mSaldo.length - 2] || 1))) + ' vs mês ant.' : undefined}
              deltaDir={dre.mSaldo.length > 1 && dre.mSaldo[dre.mSaldo.length - 1] >= dre.mSaldo[dre.mSaldo.length - 2] ? 'up' : 'down'}
            />
          </div>

          {/* ── Chart: resultado líquido ── */}
          <div className="panel mb-3.5">
            <div className="panel-hdr">
              <div>
                <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                  Resultado Líquido — mês a mês
                  <InfoPopover title="Resultado Líquido — mês a mês" description={'Barras com Entradas (verde) e Saídas totais (vermelho) por mês, mais linha de Saldo Líquido (azul).\n\nRegime Caixa: considera a data efetiva do movimento financeiro.'} />
                </div>
                <div className="text-[10px] text-text-3 mt-0.5">Entradas, saídas e saldo líquido</div>
              </div>
              <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Resultado Líquido — Caixa', renderFlow('100%'))}>⤢ ampliar</span>
            </div>
            <div className="p-4" style={{ height: 280 }}>{renderFlow(280)}</div>
          </div>

          {/* ── Chart: saldo acumulado ── */}
          <div className="panel mb-3.5">
            <div className="panel-hdr">
              <div>
                <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                  Saldo Acumulado
                  <InfoPopover title="Saldo Acumulado" description={'Linha verde: posição de caixa acumulada mês a mês.\nLinha tracejada azul: tendência linear entre o primeiro e o último ponto visível.'} />
                </div>
                <div className="text-[10px] text-text-3 mt-0.5">Evolução com linha de tendência</div>
              </div>
              <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Saldo Acumulado', renderAcum('100%'))}>⤢ ampliar</span>
            </div>
            <div className="p-4" style={{ height: 280 }}>{renderAcum(280)}</div>
          </div>

          {/* ── Chart: ciclo financeiro ── */}
          <div className="panel mb-3.5">
            <div className="panel-hdr">
              <div>
                <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                  Ciclo Financeiro — PMR, PMP e Ciclo de Caixa
                  <InfoPopover title="Ciclo Financeiro" description={'PMR: dia médio de recebimento · PMP: dia médio de pagamento\nCiclo = PMP − PMR (positivo → recebe antes de pagar)'} />
                </div>
                <div className="text-[10px] text-text-3 mt-0.5">Prazos médios de recebimento e pagamento</div>
              </div>
              <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Ciclo Financeiro', renderCiclo('100%'))}>⤢ ampliar</span>
            </div>
            <div className="p-4" style={{ height: 280 }}>{renderCiclo(280)}</div>
          </div>

          {/* ── Chart: margem comparação ── */}
          <div className="panel mb-3.5">
            <div className="panel-hdr">
              <div>
                <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                  Margem Operacional — Caixa vs Competência
                  <InfoPopover title="Margem Operacional — Caixa vs Competência" description={'Compara a Margem Operacional (%) nos dois regimes.\nDivergências indicam diferenças de timing entre o econômico e o financeiro.'} />
                </div>
                <div className="text-[10px] text-text-3 mt-0.5">Comparativo dos dois regimes</div>
              </div>
              <span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Margem Operacional — Caixa vs Competência', renderMargComp('100%'))}>⤢ ampliar</span>
            </div>
            <div className="p-4" style={{ height: 280 }}>{renderMargComp(280)}</div>
          </div>

          {/* ── Composição das saídas ── */}
          <DrillChart transactions={filteredTx} visMonths={visMonths} year={filterState.year} darkMode={darkMode} plano={plano} />
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
