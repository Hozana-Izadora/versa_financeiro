import React, { useState, useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { useApp } from '../context/AppContext.jsx';
import { buildDRE } from '../utils/dreBuilder.js';
import { MONTHS, fmt, fmtK, fmtPct, pct, getAvailableMonths } from '../utils/formatters.js';
import KpiCard from '../components/ui/KpiCard.jsx';
import DreTable from '../components/dre/DreTable.jsx';
import Icon from '../components/ui/Icon.jsx';
import ChartModal from '../components/ui/ChartModal.jsx';
import DrillChart from '../components/ui/DrillChart.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

function CNode({ label, value, sub, color, result, first, last }) {
  return (
    <div
      className={`kpi-card flex-1 min-w-0 ${result ? 'kpi-result' : ''}`}
      style={{ borderRadius: first ? '8px 0 0 8px' : last ? '0 8px 8px 0' : '0', borderRight: last ? undefined : 'none' }}
    >
      <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5">{label}</div>
      <div className="font-inter font-bold text-[20px] tracking-tight mb-0.5" style={{ color }}>{value}</div>
      <div className="text-[11px] text-text-3">{sub}</div>
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
        <button key={label} onClick={() => onChange(i)}
          className={`subtab-btn py-2.5 px-4 text-[11.5px] font-semibold cursor-pointer border-0 border-b-2 transition-all bg-transparent -mb-px ${active === i ? 'act text-accent border-accent' : 'text-text-3 border-transparent hover:text-text-base'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Competencia() {
  const { state, actions } = useApp();
  const { transactions, plano, saldosIniciais, filterState, darkMode } = state;
  const [showPct, setShowPct] = useState(true);
  const [subTab, setSubTab] = useState(0);
  const [modalChart, setModalChart] = useState(null);

  const tx = transactions.competencia;
  const filteredTx = useMemo(() => tx.filter(r => {
    const d = new Date(r.data + 'T12:00');
    const yOk = d.getFullYear() === filterState.year;
    const mOk = filterState.months.size === 0 || filterState.months.has(d.getMonth());
    const gOk = filterState.group === 'all' || r.grp === filterState.group;
    return yOk && mOk && gOk;
  }), [tx, filterState]);

  const visMonths = useMemo(() => {
    if (filterState.months.size > 0) return [...filterState.months].sort((a, b) => a - b);
    const avail = getAvailableMonths(tx, filterState.year);
    return avail.length ? avail : [new Date().getMonth()];
  }, [tx, filterState]);

  const dre = useMemo(() => buildDRE(filteredTx, plano, visMonths, 'competencia', filterState, saldosIniciais),
    [filteredTx, plano, visMonths, filterState, saldosIniciais]);

  const labels = visMonths.map(m => MONTHS[m]);
  const gc = darkMode ? '#1e2d42' : 'rgba(0,0,0,0.06)';
  const tc = darkMode ? '#8aa3be' : '#94a3b8';

  function chartOpts(unit) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: darkMode ? '#c4d4e4' : '#475569', font: { family: 'Outfit', size: 11 } } },
        tooltip: { backgroundColor: '#1C1C1C', titleColor: '#fff', bodyColor: '#aaa', padding: 9, cornerRadius: 5, callbacks: { label: ctx => ` ${unit === '%' ? ctx.raw + '%' : fmt(ctx.raw)}` } },
      },
      scales: {
        x: { ticks: { color: tc, font: { size: 11 } }, grid: { color: gc } },
        y: { ticks: { color: tc, callback: v => unit === '%' ? v + '%' : fmtK(v) }, grid: { color: gc } },
      },
    };
  }

  const margins = [
    { pctVal: fmtPct(pct(dre.totMgB, dre.totRec)), label: 'Margem Bruta', val: fmtK(dre.totMgB), color: '#10b981', w: Math.min(100, Math.max(0, pct(dre.totMgB, dre.totRec))) },
    { pctVal: fmtPct(pct(dre.totMgOp, dre.totRec)), label: 'Margem Operacional', val: fmtK(dre.totMgOp), color: '#06b6d4', w: Math.min(100, Math.max(0, pct(dre.totMgOp, dre.totRec))) },
    { pctVal: fmtPct(pct(dre.totLL, dre.totRec)), label: 'Margem Líquida', val: fmtK(dre.totLL), color: '#8b5cf6', w: Math.min(100, Math.max(0, pct(dre.totLL, dre.totRec))) },
    { pctVal: fmtPct(pct(dre.totCost, dre.totRec)), label: '% Custo s/ Receita', val: fmtK(dre.totCost), color: '#ef4444', w: Math.min(100, Math.max(0, pct(dre.totCost, dre.totRec))) },
  ];

  const dreChartData = {
    labels,
    datasets: [
      { label: 'Receita', data: dre.mRec, backgroundColor: 'rgba(16,185,129,.7)', borderRadius: 4, borderSkipped: false },
      { label: 'Custos+Desp', data: dre.mCost.map((v, i) => v + dre.mDespOp[i] + dre.mDespNop[i]), backgroundColor: 'rgba(239,68,68,.6)', borderRadius: 4, borderSkipped: false },
      { label: 'Lucro Líq.', data: dre.mLL, type: 'line', borderColor: 'rgba(139,92,246,.9)', backgroundColor: 'rgba(139,92,246,.08)', tension: .4, fill: true, pointRadius: 4 },
    ],
  };

  const mbPct = dre.mMgB.map((v, i) => dre.mRec[i] > 0 ? +(v / dre.mRec[i] * 100).toFixed(1) : 0);
  const moPct = dre.mMgOp.map((v, i) => dre.mRec[i] > 0 ? +(v / dre.mRec[i] * 100).toFixed(1) : 0);
  const llPct = dre.mLL.map((v, i) => dre.mRec[i] > 0 ? +(v / dre.mRec[i] * 100).toFixed(1) : 0);

  const mgData = {
    labels,
    datasets: [
      { label: 'Mg. Bruta %',   data: mbPct, borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,.08)', tension: .4, fill: false, pointRadius: 4 },
      { label: 'Mg. Op. %',    data: moPct, borderColor: 'rgba(6,182,212,1)', backgroundColor: 'rgba(6,182,212,.08)', tension: .4, fill: false, pointRadius: 4 },
      { label: 'Mg. Líq. %',  data: llPct, borderColor: 'rgba(139,92,246,1)', backgroundColor: 'rgba(139,92,246,.08)', tension: .4, fill: false, pointRadius: 4 },
    ],
  };

  function openModal(type, data, options, title) {
    setModalChart({ type, data, options, title });
  }

  function exportDRE() {
    const rows = [['Descrição', ...visMonths.map(m => MONTHS[m]), 'Total']];
    dre.rows.forEach(row => {
      if (row.type === 'section') return;
      rows.push([row.label, ...row.monthValues.map(v => v.toFixed(2)), row.total.toFixed(2)]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `DRE_${filterState.year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ani">
      {modalChart && <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />}

      <SubtabBar active={subTab} onChange={setSubTab} />

      {subTab === 0 ? (
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
            <CNode last result label="EBIT" value={fmtK(dre.totMgOp)} sub={fmtPct(pct(dre.totMgOp, dre.totRec)) + ' de margem op.'} color={dre.totMgOp >= 0 ? '#2563eb' : '#ef4444'} />
          </div>

          {/* ── KPI cards ── */}
          <div className="grid grid-cols-3 gap-3 mb-3.5">
            <KpiCard label="Desp. Não Operacionais" value={fmtK(dre.totDespNop)} sub={fmtPct(pct(dre.totDespNop, dre.totRec)) + ' da receita'} icon="money_off" colorClass="kc-p" />
            <KpiCard label="Lucro Líquido" value={fmtK(dre.totLL)} sub={fmtPct(pct(dre.totLL, dre.totRec)) + ' de margem líquida'} icon="diamond" colorClass={dre.totLL >= 0 ? 'kc-g' : 'kc-r'}
              delta={dre.mLL.length > 1 ? fmtPct(pct(dre.mLL[dre.mLL.length - 1] - dre.mLL[dre.mLL.length - 2], Math.abs(dre.mLL[dre.mLL.length - 2] || 1))) + ' vs mês ant.' : undefined}
              deltaDir={dre.mLL.length > 1 && dre.mLL[dre.mLL.length - 1] >= dre.mLL[dre.mLL.length - 2] ? 'up' : 'down'}
            />
            {/* <KpiCard label="Margem Operacional" value={fmtPct(pct(dre.totMgOp, dre.totRec))} sub={`EBIT ${fmtK(dre.totMgOp)}`} icon="gps_fixed" colorClass="kc-c"
              delta={moPct.length > 1 ? (moPct[moPct.length - 1] - moPct[moPct.length - 2]).toFixed(1) + 'pp vs mês ant.' : undefined}
              deltaDir={moPct.length > 1 && moPct[moPct.length - 1] >= moPct[moPct.length - 2] ? 'up' : 'down'}
            /> */}
          </div>

          {/* ── Margin cards ── */}
          <div className="grid grid-cols-4 gap-2.5 mb-3.5">
            {margins.map((m, i) => (
              <div key={i} className="bg-card border border-slate-100 rounded-card px-4 py-3.5 text-center">
                <div className="font-inter font-black text-[28px] mb-0.5" style={{ color: m.color }}>{m.pctVal}</div>
                <div className="text-[9.5px] uppercase tracking-widest text-text-3">{m.label}</div>
                <div className="text-xs text-text-2 mt-0.5 font-mono">{m.val}</div>
                <div className="h-[3px] bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.w}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Charts: resultado mensal + evolução das margens ── */}
          <div className="grid grid-cols-[3fr_2fr] gap-3 mb-3.5">
            <div className="panel">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px]">Resultado Operacional — mês a mês</div>
                  <div className="text-[10px] text-text-3 mt-0.5">Evolução mensal do resultado econômico</div>
                </div>
                <span className="text-[9.5px] text-text-3">⤢ clique para ampliar</span>
              </div>
              <div className="p-4 cursor-zoom-in" style={{ height: 252 }}
                onClick={() => openModal('bar', dreChartData, chartOpts('R$'), 'Resultado Operacional — Competência')}>
                <Bar data={dreChartData} options={chartOpts('R$')} />
              </div>
            </div>
            <div className="panel">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px]">Evolução das Margens</div>
                  <div className="text-[10px] text-text-3 mt-0.5">Margem bruta, operacional e líquida %</div>
                </div>
              </div>
              <div className="p-4 cursor-zoom-in" style={{ height: 252 }}
                onClick={() => openModal('line', mgData, chartOpts('%'), 'Evolução das Margens')}>
                <Line data={mgData} options={chartOpts('%')} />
              </div>
            </div>
          </div>

          {/* ── Composição das saídas com drill-down ── */}
          <DrillChart
            transactions={filteredTx}
            visMonths={visMonths}
            year={filterState.year}
            darkMode={darkMode}
          />
        </>
      ) : null}

      {subTab === 1 && (
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
          <DreTable
            dre={dre}
            showPct={showPct}
            onDrillItem={() => actions.setPage('lancamentos')}
            onDrillGroup={() => actions.setPage('lancamentos')}
          />
        </div>
      )}
    </div>
  );
}
