import React, { useState, useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { useApp } from '../context/AppContext.jsx';
import { buildDRE } from '../utils/dreBuilder.js';
import { MONTHS, fmt, fmtK, fmtPct, pct, getAvailableMonths } from '../utils/formatters.js';
import KpiCard from '../components/ui/KpiCard.jsx';
import DreTable from '../components/dre/DreTable.jsx';
import Icon from '../components/ui/Icon.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const chartOpts = (unit) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#475569', font: { family: 'Outfit', size: 11 } } },
    tooltip: { callbacks: { label: ctx => ` ${unit === '%' ? ctx.raw + '%' : fmt(ctx.raw)}` } },
  },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
    y: { ticks: { color: '#94a3b8', callback: v => unit === '%' ? v + '%' : fmtK(v) }, grid: { color: 'rgba(0,0,0,0.06)' } },
  },
});

export default function Caixa() {
  const { state, actions } = useApp();
  const { transactions, plano, saldosIniciais, filterState } = state;
  const [showPct, setShowPct] = useState(true);

  const tx = transactions.caixa;
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

  const labels = visMonths.map(m => MONTHS[m]);
  const totSaldo = dre.mSaldo.reduce((a, b) => a + b, 0);
  const lastAcum = dre.mAcum[dre.mAcum.length - 1] || 0;

  const kpis = [
    { label: 'Total de Entradas', value: fmtK(dre.totRec), sub: `${visMonths.length} mês(es)`, icon: 'arrow_downward_alt', colorClass: 'kc-g' },
    { label: 'Total de Saídas', value: fmtK(dre.totCost + dre.totDespOp + dre.totDespNop), sub: 'Custos + Despesas', icon: 'arrow_upward_alt', colorClass: 'kc-r' },
    { label: 'Saldo do Período', value: fmtK(totSaldo), sub: totSaldo >= 0 ? 'Positivo' : 'Negativo', icon: 'balance', colorClass: totSaldo >= 0 ? 'kc-g' : 'kc-r' },
    { label: 'Saldo Acumulado', value: fmtK(lastAcum), sub: `Acumulado ${filterState.year}`, icon: 'trending_up', colorClass: 'kc-b' },
    { label: 'Margem Bruta', value: fmtPct(pct(dre.totMgB, dre.totRec)), sub: fmtK(dre.totMgB), icon: 'bar_chart', colorClass: 'kc-c' },
    { label: 'Margem Operacional', value: fmtPct(pct(dre.totMgOp, dre.totRec)), sub: fmtK(dre.totMgOp), icon: 'gps_fixed', colorClass: 'kc-p' },
  ];

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
      { label: 'Acumulado', data: dre.mAcum, borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,.1)', tension: .4, fill: true, pointBackgroundColor: 'rgba(16,185,129,1)', pointRadius: 5 },
      { label: 'Saldo Mês', data: dre.mSaldo, borderColor: 'rgba(59,130,246,.6)', backgroundColor: 'transparent', tension: .4, borderDash: [4, 4], pointRadius: 3 },
    ],
  };

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
      {/* KPIs */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-[3fr_2fr] gap-3 mb-3.5">
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Fluxo de Caixa Mensal</div>
              <div className="text-[10px] text-text-3 mt-0.5">Entradas, saídas e saldo do período</div>
            </div>
          </div>
          <div className="p-4" style={{ height: 252 }}>
            <Bar data={flowData} options={chartOpts('R$')} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Saldo Acumulado</div>
              <div className="text-[10px] text-text-3 mt-0.5">Evolução com saldos iniciais</div>
            </div>
          </div>
          <div className="p-4" style={{ height: 252 }}>
            <Line data={acumData} options={chartOpts('R$')} />
          </div>
        </div>
      </div>

      {/* DRE */}
      <div className="panel">
        <div className="panel-hdr">
          <div>
            <div className="font-inter font-semibold text-[13px]">Demonstrativo de Fluxo de Caixa — Análise Horizontal</div>
            <div className="text-[10px] text-text-3 mt-0.5">Clique nas categorias para expandir · Clique nos itens para ver lançamentos</div>
          </div>
          <div className="flex gap-1.5 items-center">
            <label className="text-[11px] text-text-3 flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={showPct} onChange={e => setShowPct(e.target.checked)} />
              Mostrar %
            </label>
            <button className="btn btn-ghost btn-sm" onClick={exportDRE}><Icon name="download" size="text-[14px]" /> Exportar</button>
          </div>
        </div>
        <DreTable
          dre={dre}
          showPct={showPct}
          onDrillItem={(tipo, mov) => { actions.setPage('lancamentos'); }}
          onDrillGroup={(grp, mov) => { actions.setPage('lancamentos'); }}
        />
      </div>
    </div>
  );
}
