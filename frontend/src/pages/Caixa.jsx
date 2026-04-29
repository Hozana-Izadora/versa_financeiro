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
      style={{
        borderRadius: first ? '8px 0 0 8px' : last ? '0 8px 8px 0' : '0',
        borderRight: last ? undefined : 'none',
      }}
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

// Subtab bar
function SubtabBar({ active, onChange }) {
  return (
    <div className="subtab-bar flex bg-bg-2 border-b border-slate-100 px-4 lg:px-7 mb-4 -mx-4 lg:-mx-7 -mt-6">
      {['Visão Geral', 'Demonstrativo'].map((label, i) => (
        <button
          key={label}
          onClick={() => onChange(i)}
          className={`subtab-btn py-2.5 px-4 text-[11.5px] font-semibold cursor-pointer border-0 border-b-2 transition-all bg-transparent -mb-px ${
            active === i
              ? 'act text-accent border-accent'
              : 'text-text-3 border-transparent hover:text-text-base'
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

  const dre = useMemo(() => buildDRE(filteredTx, plano, visMonths, 'caixa', filterState, saldosIniciais),
    [filteredTx, plano, visMonths, filterState, saldosIniciais]);

  // Build comparison DRE for competência (for the Margem comparison chart)
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
  const lastAcum = dre.mAcum[dre.mAcum.length - 1] || 0;

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

  const flowData = {
    labels,
    datasets: [
      { label: 'Entradas', data: dre.mRec, backgroundColor: 'rgba(16,185,129,.7)', borderRadius: 4, borderSkipped: false },
      { label: 'Saídas', data: dre.mCost.map((v, i) => v + dre.mDespOp[i] + dre.mDespNop[i]), backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 4, borderSkipped: false },
      { label: 'Saldo', data: dre.mSaldo, type: 'line', borderColor: 'rgba(59,130,246,.9)', backgroundColor: 'rgba(59,130,246,.08)', tension: .4, fill: true, pointBackgroundColor: 'rgba(59,130,246,1)', pointRadius: 4 },
    ],
  };

  const acumData = {
    labels,
    datasets: [
      { label: 'Acumulado', data: dre.mAcum, backgroundColor: 'rgba(16,185,129,.15)', borderColor: 'rgba(16,185,129,1)', tension: .4, fill: true, pointBackgroundColor: 'rgba(16,185,129,1)', pointRadius: 5 },
      { label: 'Tendência', data: (() => { const a = dre.mAcum[0] || 0, b = dre.mAcum[dre.mAcum.length - 1] || 0, n = dre.mAcum.length; return dre.mAcum.map((_, i) => n > 1 ? +(a + (b - a) / (n - 1) * i).toFixed(0) : a); })(), borderColor: 'rgba(59,130,246,.6)', backgroundColor: 'transparent', tension: .4, borderDash: [4, 4], pointRadius: 3 },
    ],
  };

  // Ciclo Financeiro (static demo data — PMR/PMP requires external data)
  const cicloLabels = labels.length >= 3 ? labels.slice(-Math.min(6, labels.length)) : labels;
  const cicloLen = cicloLabels.length;
  const cicloData = {
    labels: cicloLabels,
    datasets: [
      { label: 'PMR — Prazo Médio Recebimento (dias)', data: [28, 26, 24, 25, 23, 22].slice(-cicloLen), backgroundColor: 'rgba(109,191,69,.7)', borderRadius: 4 },
      { label: 'PMP — Prazo Médio Pagamento (dias)',   data: [35, 34, 36, 35, 37, 38].slice(-cicloLen), backgroundColor: 'rgba(43,108,176,.7)', borderRadius: 4 },
      { label: 'Ciclo de Caixa (dias)', data: [18, 16, 14, 15, 12, 10].slice(-cicloLen), type: 'line', borderColor: '#E53E3E', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#E53E3E', tension: .4, fill: false },
    ],
  };
  const cicloOpts = { ...chartOpts('%'), scales: { ...chartOpts('%').scales, y: { ...chartOpts('%').scales.y, ticks: { color: tc, callback: v => v + 'd' } } }, plugins: { ...chartOpts('%').plugins, tooltip: { ...chartOpts('%').plugins.tooltip, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} dias` } } } };

  // Margem Operacional Caixa vs Competência
  const moCaixaPct = dre.mMgOp.map((v, i) => dre.mRec[i] > 0 ? +(v / dre.mRec[i] * 100).toFixed(1) : 0);
  const moCompPct  = dreComp.mMgOp.map((v, i) => dreComp.mRec[i] > 0 ? +(v / dreComp.mRec[i] * 100).toFixed(1) : 0);
  const margCompData = {
    labels,
    datasets: [
      { label: 'Margem Op. Caixa',       data: moCaixaPct, borderColor: '#6DBF45', backgroundColor: 'rgba(109,191,69,.08)', tension: .4, fill: true, pointRadius: 4, pointBackgroundColor: '#6DBF45', borderWidth: 2.5 },
      { label: 'Margem Op. Competência', data: moCompPct,  borderColor: '#2B6CB0', backgroundColor: 'rgba(43,108,176,.06)', tension: .4, fill: true, pointRadius: 4, pointBackgroundColor: '#2B6CB0', borderWidth: 2.5 },
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
    const a = document.createElement('a'); a.href = url; a.download = `Caixa_${filterState.year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ani">
      {modalChart && <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />}

      <SubtabBar active={subTab} onChange={setSubTab} />

      {subTab === 0 ? (
        <>
          {/* ── Cascade: fluxo operacional ── */}
          <div className="kpi-cascade mb-3.5">
            <CNode first label="Entradas / Receita" value={fmtK(dre.totRec)} sub={`${visMonths.length} mês(es)`} color="#10b981" />
            <CSep symbol="−" />
            <CNode label="Custos Diretos" value={fmtK(dre.totCost)} sub={fmtPct(pct(dre.totCost, dre.totRec)) + ' da receita'} color="#ef4444" />
            <CSep symbol="−" />
            <CNode label="Despesas Operacionais" value={fmtK(dre.totDespOp)} sub={fmtPct(pct(dre.totDespOp, dre.totRec)) + ' da receita'} color="#f59e0b" />
            <CSep symbol="=" />
            <CNode last result label="Caixa Operacional" value={fmtK(dre.totMgOp)} sub={fmtPct(pct(dre.totMgOp, dre.totRec)) + ' de margem'} color={dre.totMgOp >= 0 ? '#2563eb' : '#ef4444'} />
          </div>

          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5">
            <KpiCard label="Entradas Não Operacionais" value={fmtK(dre.totEntNop)} sub={fmtPct(pct(dre.totEntNop, dre.totRec)) + ' da receita'} icon="add_circle" colorClass="kc-g" />
            <KpiCard label="Saídas Não Operacionais" value={fmtK(dre.totDespNop)} sub={fmtPct(pct(dre.totDespNop, dre.totRec)) + ' da receita'} icon="money_off" colorClass="kc-p" />
            <KpiCard label="Saldo do Período" value={fmtK(totSaldo)} sub={totSaldo >= 0 ? 'Resultado positivo' : 'Resultado negativo'} icon="balance" colorClass={totSaldo >= 0 ? 'kc-g' : 'kc-r'}
              delta={dre.mSaldo.length > 1 ? fmtPct(pct(dre.mSaldo[dre.mSaldo.length - 1] - dre.mSaldo[dre.mSaldo.length - 2], Math.abs(dre.mSaldo[dre.mSaldo.length - 2] || 1))) + ' vs mês ant.' : undefined}
              deltaDir={dre.mSaldo.length > 1 && dre.mSaldo[dre.mSaldo.length - 1] >= dre.mSaldo[dre.mSaldo.length - 2] ? 'up' : 'down'}
            />
            <KpiCard label="Saldo Acumulado" value={fmtK(lastAcum)} sub={`Acumulado ${filterState.year}`} icon="trending_up" colorClass="kc-b"
              delta={lastAcum >= 0 ? 'Saldo positivo' : 'Saldo negativo'} deltaDir={lastAcum >= 0 ? 'up' : 'down'}
            />
          </div>

          {/* ── Charts: fluxo mensal + acumulado ── */}
          <div className="grid grid-cols-[3fr_2fr] gap-3 mb-3.5">
            <div className="panel">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px]">Resultado Líquido — mês a mês</div>
                  <div className="text-[10px] text-text-3 mt-0.5">Entradas, saídas e saldo líquido</div>
                </div>
                <span className="text-[9.5px] text-text-3">⤢ clique para ampliar</span>
              </div>
              <div className="p-4 cursor-zoom-in" style={{ height: 252 }}
                onClick={() => openModal('bar', flowData, chartOpts('R$'), 'Resultado Líquido — Caixa')}>
                <Bar data={flowData} options={chartOpts('R$')} />
              </div>
            </div>
            <div className="panel">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px]">Saldo Acumulado</div>
                  <div className="text-[10px] text-text-3 mt-0.5">Evolução com linha de tendência</div>
                </div>
              </div>
              <div className="p-4 cursor-zoom-in" style={{ height: 252 }}
                onClick={() => openModal('line', acumData, chartOpts('R$'), 'Saldo Acumulado')}>
                <Line data={acumData} options={chartOpts('R$')} />
              </div>
            </div>
          </div>

          {/* ── Ciclo Financeiro + Margem comparação ── */}
          <div className="grid grid-cols-2 gap-3 mb-3.5">
            <div className="panel">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px]">Ciclo Financeiro — PMR, PMP e Ciclo de Caixa</div>
                  <div className="text-[10px] text-text-3 mt-0.5">Prazos médios de recebimento e pagamento</div>
                </div>
              </div>
              <div className="p-4 cursor-zoom-in" style={{ height: 230 }}
                onClick={() => openModal('bar', cicloData, cicloOpts, 'Ciclo Financeiro — PMR, PMP e Ciclo de Caixa')}>
                <Bar data={cicloData} options={cicloOpts} />
              </div>
            </div>
            <div className="panel">
              <div className="panel-hdr">
                <div>
                  <div className="font-inter font-semibold text-[13px]">Margem Operacional — Caixa vs Competência</div>
                  <div className="text-[10px] text-text-3 mt-0.5">Comparativo dos dois regimes</div>
                </div>
              </div>
              <div className="p-4 cursor-zoom-in" style={{ height: 230 }}
                onClick={() => openModal('line', margCompData, chartOpts('%'), 'Margem Operacional — Caixa vs Competência')}>
                <Line data={margCompData} options={chartOpts('%')} />
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
              <div className="font-inter font-semibold text-[13px]">Demonstrativo do Fluxo de Caixa Estruturado (DFCE)</div>
              <div className="text-[10px] text-text-3 mt-0.5">Clique nos grupos para recolher · Clique nos itens para ver lançamentos</div>
            </div>
            <div className="flex gap-2 items-center flex-wrap justify-end">
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                className="text-[11px] border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ minWidth: 160 }}
              >
                <option value="">Todas as categorias</option>
                {catOptions.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
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
          <DreTable
            dre={dre}
            showPct={showPct}
            filterCat={filterCat || null}
            onDrillItem={() => actions.setPage('lancamentos')}
            onDrillGroup={() => actions.setPage('lancamentos')}
          />
        </div>
      )}
    </div>
  );
}
